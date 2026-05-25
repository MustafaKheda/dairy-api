import { and, desc, eq, gt, gte, lte, ne, sql, type SQL } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "../db/client.js";
import { customers, dailyEntries, invoices, payments, products } from "../schema/index.js";
import type { AuthUser } from "../types.js";
import { monthRange, today } from "../utils/date.js";
import type {
  customerSummaryQuerySchema,
  dashboardQuerySchema,
  customerLedgerQuerySchema,
  dailySalesQuerySchema,
  monthlySalesQuerySchema,
} from "../validators/reports.js";

function money(value: unknown) {
  return Number(Number(value ?? 0).toFixed(2));
}

function quantity(value: unknown) {
  return Number(Number(value ?? 0).toFixed(3));
}

function invoiceOverlapConditions(startDate: string, endDate: string): SQL[] {
  return [lte(invoices.startDate, endDate), gte(invoices.endDate, startDate)];
}

export async function getDailySalesReport(query: typeof dailySalesQuerySchema._output) {
  const rows = await db
    .select({
      productId: dailyEntries.productId,
      productName: products.name,
      quantity: sql<number>`coalesce(sum(${dailyEntries.quantity}), 0)`,
      amount: sql<number>`coalesce(sum(${dailyEntries.quantity} * ${dailyEntries.price}), 0)`,
    })
    .from(dailyEntries)
    .innerJoin(products, eq(products.id, dailyEntries.productId))
    .where(eq(dailyEntries.entryDate, query.date))
    .groupBy(dailyEntries.productId, products.name);

  const [totals] = await db
    .select({
      totalAmount: sql<number>`coalesce(sum(${dailyEntries.quantity} * ${dailyEntries.price}), 0)`,
      entryCount: sql<number>`count(${dailyEntries.id})`,
      customerCount: sql<number>`count(distinct ${dailyEntries.customerId})`,
    })
    .from(dailyEntries)
    .where(eq(dailyEntries.entryDate, query.date));

  return {
    date: query.date,
    products: rows.map((row) => ({
      ...row,
      quantity: Number(row.quantity),
      amount: Number(Number(row.amount).toFixed(2)),
    })),
    totals: {
      totalAmount: Number(Number(totals?.totalAmount ?? 0).toFixed(2)),
      entryCount: Number(totals?.entryCount ?? 0),
      customerCount: Number(totals?.customerCount ?? 0),
    },
  };
}

export async function getMonthlySalesReport(query: typeof monthlySalesQuerySchema._output) {
  const range = monthRange(query.month);
  const rows = await db
    .select({
      date: dailyEntries.entryDate,
      amount: sql<number>`coalesce(sum(${dailyEntries.quantity} * ${dailyEntries.price}), 0)`,
      quantity: sql<number>`coalesce(sum(${dailyEntries.quantity}), 0)`,
      entryCount: sql<number>`count(${dailyEntries.id})`,
    })
    .from(dailyEntries)
    .where(and(gte(dailyEntries.entryDate, range.startDate), lte(dailyEntries.entryDate, range.endDate)))
    .groupBy(dailyEntries.entryDate)
    .orderBy(dailyEntries.entryDate);

  const totalAmount = rows.reduce((sum, row) => sum + Number(row.amount), 0);

  return {
    month: query.month,
    startDate: range.startDate,
    endDate: range.endDate,
    days: rows.map((row) => ({
      ...row,
      quantity: Number(row.quantity),
      amount: Number(Number(row.amount).toFixed(2)),
      entryCount: Number(row.entryCount),
    })),
    totalAmount: Number(totalAmount.toFixed(2)),
  };
}

export async function getCustomerSummaryReport(query: typeof customerSummaryQuerySchema._output) {
  const useDateRange = Boolean(query.startDate && query.endDate);
  const customerConditions: SQL[] = [];

  if (query.customerId) customerConditions.push(eq(customers.id, query.customerId));

  const customerRows = await db
    .select()
    .from(customers)
    .where(customerConditions.length ? and(...customerConditions) : undefined)
    .orderBy(customers.name);

  const deliveryConditions: SQL[] = [];
  if (useDateRange) {
    deliveryConditions.push(gte(dailyEntries.entryDate, query.startDate!));
    deliveryConditions.push(lte(dailyEntries.entryDate, query.endDate!));
  }
  if (query.customerId) deliveryConditions.push(eq(dailyEntries.customerId, query.customerId));

  const deliveryRows = await db
    .select({
      customerId: dailyEntries.customerId,
      deliveredAmount: sql<number>`coalesce(sum(${dailyEntries.quantity} * ${dailyEntries.price}), 0)`,
      deliveredQuantity: sql<number>`coalesce(sum(${dailyEntries.quantity}), 0)`,
    })
    .from(dailyEntries)
    .where(deliveryConditions.length ? and(...deliveryConditions) : undefined)
    .groupBy(dailyEntries.customerId);

  const invoiceConditions: SQL[] = [ne(invoices.status, "VOID")];
  if (useDateRange) invoiceConditions.push(...invoiceOverlapConditions(query.startDate!, query.endDate!));
  if (query.customerId) invoiceConditions.push(eq(invoices.customerId, query.customerId));

  const invoiceRows = await db
    .select({
      customerId: invoices.customerId,
      invoiceTotal: sql<number>`coalesce(sum(${invoices.totalAmount}), 0)`,
      paidAmount: sql<number>`coalesce(sum(${invoices.paidAmount}), 0)`,
      pendingAmount: sql<number>`coalesce(sum(${invoices.pendingAmount}), 0)`,
    })
    .from(invoices)
    .where(and(...invoiceConditions))
    .groupBy(invoices.customerId);

  const deliveries = new Map(deliveryRows.map((row) => [row.customerId, row]));
  const invoiceTotals = new Map(invoiceRows.map((row) => [row.customerId, row]));

  return customerRows.map((customer) => {
    const delivery = deliveries.get(customer.id);
    const invoice = invoiceTotals.get(customer.id);

    return {
      customer,
      deliveredQuantity: Number(delivery?.deliveredQuantity ?? 0),
      deliveredAmount: Number(Number(delivery?.deliveredAmount ?? 0).toFixed(2)),
      invoiceTotal: Number(Number(invoice?.invoiceTotal ?? 0).toFixed(2)),
      paidAmount: Number(Number(invoice?.paidAmount ?? 0).toFixed(2)),
      pendingAmount: Number(Number(invoice?.pendingAmount ?? 0).toFixed(2)),
    };
  });
}

export async function getDashboardReport(query: typeof dashboardQuerySchema._output) {
  const useDateRange = Boolean(query.startDate && query.endDate);
  const month = monthRange(query.month);
  const rangeStart = useDateRange ? query.startDate! : month.startDate;
  const rangeEnd = useDateRange ? query.endDate! : month.endDate;
  const dailyDate = useDateRange ? query.endDate! : query.date;
  const agingDate = useDateRange ? query.endDate! : query.date;
  const customerFilter = query.customerId ? eq(dailyEntries.customerId, query.customerId) : undefined;
  const invoiceCustomerFilter = query.customerId ? eq(invoices.customerId, query.customerId) : undefined;
  const entryRangeStart = useDateRange ? rangeStart : query.date < month.startDate ? query.date : month.startDate;
  const entryRangeEnd = useDateRange ? rangeEnd : query.date > month.endDate ? query.date : month.endDate;

  const [customerTotals] = await db
    .select({ totalCustomers: sql<number>`count(${customers.id})` })
    .from(customers)
    .where(
      query.customerId
        ? and(eq(customers.status, "ACTIVE"), eq(customers.id, query.customerId))
        : eq(customers.status, "ACTIVE"),
    );

  const [entryTotals] = await db
    .select({
      dailyAmount: sql<number>`coalesce(sum(case when ${dailyEntries.entryDate} = ${dailyDate} then ${dailyEntries.quantity} * ${dailyEntries.price} else 0 end), 0)`,
      dailyEntryCount: sql<number>`coalesce(sum(case when ${dailyEntries.entryDate} = ${dailyDate} then 1 else 0 end), 0)`,
      dailyCustomerCount: sql<number>`count(distinct case when ${dailyEntries.entryDate} = ${dailyDate} then ${dailyEntries.customerId} end)`,
      monthlyAmount: sql<number>`coalesce(sum(case when ${dailyEntries.entryDate} >= ${rangeStart} and ${dailyEntries.entryDate} <= ${rangeEnd} then ${dailyEntries.quantity} * ${dailyEntries.price} else 0 end), 0)`,
      monthlyEntryCount: sql<number>`coalesce(sum(case when ${dailyEntries.entryDate} >= ${rangeStart} and ${dailyEntries.entryDate} <= ${rangeEnd} then 1 else 0 end), 0)`,
      monthlyCustomerCount: sql<number>`count(distinct case when ${dailyEntries.entryDate} >= ${rangeStart} and ${dailyEntries.entryDate} <= ${rangeEnd} then ${dailyEntries.customerId} end)`,
    })
    .from(dailyEntries)
    .where(
      and(
        gte(dailyEntries.entryDate, entryRangeStart),
        lte(dailyEntries.entryDate, entryRangeEnd),
        ...(customerFilter ? [customerFilter] : []),
      ),
    );

  const invoiceBaseConditions: SQL[] = [ne(invoices.status, "VOID")];
  if (invoiceCustomerFilter) invoiceBaseConditions.push(invoiceCustomerFilter);
  if (useDateRange) invoiceBaseConditions.push(...invoiceOverlapConditions(rangeStart, rangeEnd));

  const statusRows = await db
    .select({
      status: invoices.status,
      count: sql<number>`count(${invoices.id})`,
      amount: sql<number>`coalesce(sum(${invoices.totalAmount}), 0)`,
      paidAmount: sql<number>`coalesce(sum(${invoices.paidAmount}), 0)`,
      pendingAmount: sql<number>`coalesce(sum(${invoices.pendingAmount}), 0)`,
    })
    .from(invoices)
    .where(invoiceBaseConditions.length ? and(...invoiceBaseConditions) : undefined)
    .groupBy(invoices.status);

  const statusCounts = {
    UNPAID: { count: 0, amount: 0 },
    PARTIAL: { count: 0, amount: 0 },
    PAID: { count: 0, amount: 0 },
    VOID: { count: 0, amount: 0 },
  };

  for (const row of statusRows) {
    statusCounts[row.status] = {
      count: Number(row.count),
      amount: money(row.amount),
    };
  }

  const invoiceTotals = statusRows.reduce(
    (total, row) => {
      if (row.status === "VOID") {
        return total;
      }

      return {
        invoiceTotal: money(total.invoiceTotal + Number(row.amount)),
        paidAmount: money(total.paidAmount + Number(row.paidAmount)),
        pendingAmount: money(total.pendingAmount + Number(row.pendingAmount)),
      };
    },
    { invoiceTotal: 0, paidAmount: 0, pendingAmount: 0 },
  );

  const paymentConditions: SQL[] = [
    gte(payments.paymentDate, rangeStart),
    lte(payments.paymentDate, rangeEnd),
    ne(invoices.status, "VOID"),
  ];
  if (invoiceCustomerFilter) paymentConditions.push(invoiceCustomerFilter);

  const [paymentTotals] = await db
    .select({ receivedAmount: sql<number>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
    .where(and(...paymentConditions));

  const ageBucket = sql<string>`
    case
      when max(0, cast(julianday(${agingDate}) - julianday(${invoices.endDate}) as integer)) <= 30 then '0-30 Days'
      when max(0, cast(julianday(${agingDate}) - julianday(${invoices.endDate}) as integer)) <= 60 then '31-60 Days'
      when max(0, cast(julianday(${agingDate}) - julianday(${invoices.endDate}) as integer)) <= 90 then '61-90 Days'
      else '>90 Days'
    end
  `;
  const agingRows = await db
    .select({
      label: ageBucket,
      count: sql<number>`count(${invoices.id})`,
      amount: sql<number>`coalesce(sum(${invoices.pendingAmount}), 0)`,
    })
    .from(invoices)
    .where(and(...invoiceBaseConditions, gt(invoices.pendingAmount, 0)))
    .groupBy(ageBucket);

  const agingBuckets = [
    { label: "0-30 Days", count: 0, amount: 0 },
    { label: "31-60 Days", count: 0, amount: 0 },
    { label: "61-90 Days", count: 0, amount: 0 },
    { label: ">90 Days", count: 0, amount: 0 },
  ];

  for (const row of agingRows) {
    const bucket = agingBuckets.find((item) => item.label === row.label);
    if (!bucket) continue;
    bucket.count = Number(row.count);
    bucket.amount = money(row.amount);
  }

  const recentEntryConditions: SQL[] = [];
  if (customerFilter) recentEntryConditions.push(customerFilter);
  if (useDateRange) {
    recentEntryConditions.push(gte(dailyEntries.entryDate, rangeStart));
    recentEntryConditions.push(lte(dailyEntries.entryDate, rangeEnd));
  }

  const recentEntries = await db
    .select({
      id: dailyEntries.id,
      customerId: dailyEntries.customerId,
      customerName: customers.name,
      productId: dailyEntries.productId,
      productName: products.name,
      unit: dailyEntries.unit,
      quantity: dailyEntries.quantity,
      session: dailyEntries.session,
      entryDate: dailyEntries.entryDate,
      price: dailyEntries.price,
      amount: sql<number>`${dailyEntries.quantity} * ${dailyEntries.price}`,
      createdAt: dailyEntries.createdAt,
    })
    .from(dailyEntries)
    .innerJoin(customers, eq(customers.id, dailyEntries.customerId))
    .innerJoin(products, eq(products.id, dailyEntries.productId))
    .where(recentEntryConditions.length ? and(...recentEntryConditions) : undefined)
    .orderBy(desc(dailyEntries.entryDate), desc(dailyEntries.id))
    .limit(5);

  const recentInvoiceConditions: SQL[] = [];
  if (invoiceCustomerFilter) recentInvoiceConditions.push(invoiceCustomerFilter);
  if (useDateRange) recentInvoiceConditions.push(...invoiceOverlapConditions(rangeStart, rangeEnd));

  const recentInvoices = await db
    .select({
      id: invoices.id,
      customerId: invoices.customerId,
      customerName: customers.name,
      invoiceNumber: invoices.invoiceNumber,
      startDate: invoices.startDate,
      endDate: invoices.endDate,
      totalAmount: invoices.totalAmount,
      paidAmount: invoices.paidAmount,
      pendingAmount: invoices.pendingAmount,
      status: invoices.status,
      pdfUrl: invoices.pdfUrl,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .innerJoin(customers, eq(customers.id, invoices.customerId))
    .where(recentInvoiceConditions.length ? and(...recentInvoiceConditions) : undefined)
    .orderBy(desc(invoices.createdAt), desc(invoices.id))
    .limit(5);

  const recentPaymentConditions: SQL[] = [];
  if (invoiceCustomerFilter) recentPaymentConditions.push(invoiceCustomerFilter);
  if (useDateRange) {
    recentPaymentConditions.push(gte(payments.paymentDate, rangeStart));
    recentPaymentConditions.push(lte(payments.paymentDate, rangeEnd));
  }

  const recentPayments = await db
    .select({
      id: payments.id,
      invoiceId: payments.invoiceId,
      invoiceNumber: invoices.invoiceNumber,
      customerId: invoices.customerId,
      customerName: customers.name,
      amount: payments.amount,
      paymentDate: payments.paymentDate,
      paymentMethod: payments.paymentMethod,
      notes: payments.notes,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
    .innerJoin(customers, eq(customers.id, invoices.customerId))
    .where(recentPaymentConditions.length ? and(...recentPaymentConditions) : undefined)
    .orderBy(desc(payments.paymentDate), desc(payments.id))
    .limit(5);

  return {
    date: dailyDate,
    month: query.month,
    startDate: useDateRange ? rangeStart : null,
    endDate: useDateRange ? rangeEnd : null,
    customerId: query.customerId ?? null,
    totalCustomers: Number(customerTotals?.totalCustomers ?? 0),
    dailySales: money(entryTotals?.dailyAmount),
    monthlyRevenue: money(entryTotals?.monthlyAmount),
    pendingPayments: money(invoiceTotals.pendingAmount),
    invoiceTotal: money(invoiceTotals.invoiceTotal),
    paidAmount: money(invoiceTotals.paidAmount),
    paymentReceived: money(paymentTotals?.receivedAmount),
    daily: {
      totalAmount: money(entryTotals?.dailyAmount),
      entryCount: Number(entryTotals?.dailyEntryCount ?? 0),
      customerCount: Number(entryTotals?.dailyCustomerCount ?? 0),
    },
    monthly: {
      startDate: rangeStart,
      endDate: rangeEnd,
      totalAmount: money(entryTotals?.monthlyAmount),
      entryCount: Number(entryTotals?.monthlyEntryCount ?? 0),
      customerCount: Number(entryTotals?.monthlyCustomerCount ?? 0),
    },
    invoiceStatusCounts: statusCounts,
    paymentAging: agingBuckets,
    recentEntries: recentEntries.map((entry) => ({ ...entry, amount: money(entry.amount) })),
    recentInvoices,
    recentPayments,
  };
}

export async function getCustomerLedgerReport(query: typeof customerLedgerQuerySchema._output, authUser: AuthUser) {
  const fallbackRange = monthRange(today().slice(0, 7));
  const startDate = query.startDate ?? fallbackRange.startDate;
  const endDate = query.endDate ?? fallbackRange.endDate;
  const customerId = authUser.role === "CUSTOMER" ? authUser.customerId : query.customerId;

  if (!customerId) {
    throw new HTTPException(authUser.role === "CUSTOMER" ? 403 : 400, {
      message:
        authUser.role === "CUSTOMER"
          ? "Customer account is not linked to a customer profile"
          : "Customer is required for customer ledger",
    });
  }

  const [customer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);

  if (!customer) {
    throw new HTTPException(404, { message: "Customer not found" });
  }

  const entryConditions: SQL[] = [gte(dailyEntries.entryDate, startDate), lte(dailyEntries.entryDate, endDate)];
  entryConditions.push(eq(dailyEntries.customerId, customerId));

  const entries = await db
    .select({
      id: dailyEntries.id,
      customerId: dailyEntries.customerId,
      customerName: customers.name,
      productId: dailyEntries.productId,
      productName: products.name,
      unit: dailyEntries.unit,
      quantity: dailyEntries.quantity,
      session: dailyEntries.session,
      entryDate: dailyEntries.entryDate,
      price: dailyEntries.price,
      amount: sql<number>`${dailyEntries.quantity} * ${dailyEntries.price}`,
      createdAt: dailyEntries.createdAt,
    })
    .from(dailyEntries)
    .innerJoin(customers, eq(customers.id, dailyEntries.customerId))
    .innerJoin(products, eq(products.id, dailyEntries.productId))
    .where(and(...entryConditions))
    .orderBy(desc(dailyEntries.entryDate), desc(dailyEntries.id));

  const productTotals = await db
    .select({
      productId: dailyEntries.productId,
      productName: products.name,
      unit: dailyEntries.unit,
      quantity: sql<number>`coalesce(sum(${dailyEntries.quantity}), 0)`,
      amount: sql<number>`coalesce(sum(${dailyEntries.quantity} * ${dailyEntries.price}), 0)`,
    })
    .from(dailyEntries)
    .innerJoin(products, eq(products.id, dailyEntries.productId))
    .where(and(...entryConditions))
    .groupBy(dailyEntries.productId, products.name, dailyEntries.unit)
    .orderBy(products.name);

  const invoiceConditions: SQL[] = [
    eq(invoices.customerId, customerId),
    ne(invoices.status, "VOID"),
    lte(invoices.startDate, endDate),
    gte(invoices.endDate, startDate),
  ];

  const relatedInvoices = await db
    .select({
      id: invoices.id,
      customerId: invoices.customerId,
      customerName: customers.name,
      invoiceNumber: invoices.invoiceNumber,
      startDate: invoices.startDate,
      endDate: invoices.endDate,
      totalAmount: invoices.totalAmount,
      paidAmount: invoices.paidAmount,
      pendingAmount: invoices.pendingAmount,
      status: invoices.status,
      pdfUrl: invoices.pdfUrl,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .innerJoin(customers, eq(customers.id, invoices.customerId))
    .where(and(...invoiceConditions))
    .orderBy(desc(invoices.createdAt), desc(invoices.id));

  const billedEntryIds = new Set<number>();
  for (const invoice of relatedInvoices) {
    for (const entry of entries) {
      if (entry.entryDate >= invoice.startDate && entry.entryDate <= invoice.endDate) {
        billedEntryIds.add(entry.id);
      }
    }
  }

  const totalAmount = money(entries.reduce((total, entry) => total + Number(entry.amount), 0));
  const billedAmount = money(
    entries.reduce((total, entry) => (billedEntryIds.has(entry.id) ? total + Number(entry.amount) : total), 0),
  );
  const invoiceTotal = money(relatedInvoices.reduce((total, invoice) => total + invoice.totalAmount, 0));
  const paidAmount = money(relatedInvoices.reduce((total, invoice) => total + invoice.paidAmount, 0));
  const pendingAmount = money(relatedInvoices.reduce((total, invoice) => total + invoice.pendingAmount, 0));

  return {
    customer,
    startDate,
    endDate,
    entries: entries.map((entry) => ({
      ...entry,
      amount: money(entry.amount),
      isBilled: billedEntryIds.has(entry.id),
    })),
    productTotals: productTotals.map((item) => ({
      ...item,
      quantity: quantity(item.quantity),
      amount: money(item.amount),
    })),
    totalAmount,
    billedAmount,
    unbilledAmount: money(totalAmount - billedAmount),
    invoiceSummary: {
      invoiceTotal,
      paidAmount,
      pendingAmount,
      invoiceCount: relatedInvoices.length,
    },
    invoices: relatedInvoices,
  };
}
