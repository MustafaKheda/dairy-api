import { and, desc, eq, gt, gte, lte, ne, sql, type SQL } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "../db/client";
import { customers, dailyEntries, invoices, payments, products } from "../schema";
import type { AuthUser } from "../types";
import { monthRange, today } from "../utils/date";
import type {
  customerSummaryQuerySchema,
  dashboardQuerySchema,
  customerLedgerQuerySchema,
  dailySalesQuerySchema,
  monthlySalesQuerySchema,
} from "../validators/reports";

function money(value: unknown) {
  return Number(Number(value ?? 0).toFixed(2));
}

function quantity(value: unknown) {
  return Number(Number(value ?? 0).toFixed(3));
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
  const conditions: SQL[] = [];

  if (query.customerId) conditions.push(eq(customers.id, query.customerId));

  const customerRows = await db
    .select()
    .from(customers)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(customers.name);

  const deliveryRows = await db
    .select({
      customerId: dailyEntries.customerId,
      deliveredAmount: sql<number>`coalesce(sum(${dailyEntries.quantity} * ${dailyEntries.price}), 0)`,
      deliveredQuantity: sql<number>`coalesce(sum(${dailyEntries.quantity}), 0)`,
    })
    .from(dailyEntries)
    .groupBy(dailyEntries.customerId);

  const invoiceRows = await db
    .select({
      customerId: invoices.customerId,
      invoiceTotal: sql<number>`coalesce(sum(${invoices.totalAmount}), 0)`,
      paidAmount: sql<number>`coalesce(sum(${invoices.paidAmount}), 0)`,
      pendingAmount: sql<number>`coalesce(sum(${invoices.pendingAmount}), 0)`,
    })
    .from(invoices)
    .where(ne(invoices.status, "VOID"))
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
  const month = monthRange(query.month);
  const customerFilter = query.customerId ? eq(dailyEntries.customerId, query.customerId) : undefined;
  const invoiceCustomerFilter = query.customerId ? eq(invoices.customerId, query.customerId) : undefined;

  const [customerTotals] = await db
    .select({ totalCustomers: sql<number>`count(${customers.id})` })
    .from(customers)
    .where(
      query.customerId
        ? and(eq(customers.status, "ACTIVE"), eq(customers.id, query.customerId))
        : eq(customers.status, "ACTIVE"),
    );

  const [dailyTotals] = await db
    .select({
      totalAmount: sql<number>`coalesce(sum(${dailyEntries.quantity} * ${dailyEntries.price}), 0)`,
      entryCount: sql<number>`count(${dailyEntries.id})`,
      customerCount: sql<number>`count(distinct ${dailyEntries.customerId})`,
    })
    .from(dailyEntries)
    .where(and(eq(dailyEntries.entryDate, query.date), ...(customerFilter ? [customerFilter] : [])));

  const [monthlyTotals] = await db
    .select({
      totalAmount: sql<number>`coalesce(sum(${dailyEntries.quantity} * ${dailyEntries.price}), 0)`,
      entryCount: sql<number>`count(${dailyEntries.id})`,
      customerCount: sql<number>`count(distinct ${dailyEntries.customerId})`,
    })
    .from(dailyEntries)
    .where(
      and(
        gte(dailyEntries.entryDate, month.startDate),
        lte(dailyEntries.entryDate, month.endDate),
        ...(customerFilter ? [customerFilter] : []),
      ),
    );

  const invoiceBaseConditions: SQL[] = [ne(invoices.status, "VOID")];
  if (invoiceCustomerFilter) invoiceBaseConditions.push(invoiceCustomerFilter);

  const [invoiceTotals] = await db
    .select({
      invoiceTotal: sql<number>`coalesce(sum(${invoices.totalAmount}), 0)`,
      paidAmount: sql<number>`coalesce(sum(${invoices.paidAmount}), 0)`,
      pendingAmount: sql<number>`coalesce(sum(${invoices.pendingAmount}), 0)`,
    })
    .from(invoices)
    .where(and(...invoiceBaseConditions));

  const statusRows = await db
    .select({
      status: invoices.status,
      count: sql<number>`count(${invoices.id})`,
      amount: sql<number>`coalesce(sum(${invoices.totalAmount}), 0)`,
    })
    .from(invoices)
    .where(invoiceCustomerFilter)
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

  const paymentConditions: SQL[] = [
    gte(payments.paymentDate, month.startDate),
    lte(payments.paymentDate, month.endDate),
    ne(invoices.status, "VOID"),
  ];
  if (invoiceCustomerFilter) paymentConditions.push(invoiceCustomerFilter);

  const [paymentTotals] = await db
    .select({ receivedAmount: sql<number>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
    .where(and(...paymentConditions));

  const agingRows = await db
    .select({
      id: invoices.id,
      endDate: invoices.endDate,
      pendingAmount: invoices.pendingAmount,
    })
    .from(invoices)
    .where(and(...invoiceBaseConditions, gt(invoices.pendingAmount, 0)));

  const agingBuckets = [
    { label: "0-30 Days", min: 0, max: 30, count: 0, amount: 0 },
    { label: "31-60 Days", min: 31, max: 60, count: 0, amount: 0 },
    { label: "61-90 Days", min: 61, max: 90, count: 0, amount: 0 },
    { label: ">90 Days", min: 91, max: Number.POSITIVE_INFINITY, count: 0, amount: 0 },
  ];
  const now = new Date(`${query.date}T00:00:00.000Z`);

  for (const row of agingRows) {
    const ageDays = Math.max(
      0,
      Math.floor((now.getTime() - new Date(`${row.endDate}T00:00:00.000Z`).getTime()) / 86_400_000),
    );
    const bucket = agingBuckets.find((item) => ageDays >= item.min && ageDays <= item.max) ?? agingBuckets[0];
    bucket.count += 1;
    bucket.amount = money(bucket.amount + row.pendingAmount);
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
    .where(customerFilter)
    .orderBy(desc(dailyEntries.entryDate), desc(dailyEntries.id))
    .limit(5);

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
    .where(invoiceCustomerFilter)
    .orderBy(desc(invoices.createdAt), desc(invoices.id))
    .limit(5);

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
    .where(invoiceCustomerFilter)
    .orderBy(desc(payments.paymentDate), desc(payments.id))
    .limit(5);

  return {
    date: query.date,
    month: query.month,
    customerId: query.customerId ?? null,
    totalCustomers: Number(customerTotals?.totalCustomers ?? 0),
    dailySales: money(dailyTotals?.totalAmount),
    monthlyRevenue: money(monthlyTotals?.totalAmount),
    pendingPayments: money(invoiceTotals?.pendingAmount),
    invoiceTotal: money(invoiceTotals?.invoiceTotal),
    paidAmount: money(invoiceTotals?.paidAmount),
    paymentReceived: money(paymentTotals?.receivedAmount),
    daily: {
      totalAmount: money(dailyTotals?.totalAmount),
      entryCount: Number(dailyTotals?.entryCount ?? 0),
      customerCount: Number(dailyTotals?.customerCount ?? 0),
    },
    monthly: {
      startDate: month.startDate,
      endDate: month.endDate,
      totalAmount: money(monthlyTotals?.totalAmount),
      entryCount: Number(monthlyTotals?.entryCount ?? 0),
      customerCount: Number(monthlyTotals?.customerCount ?? 0),
    },
    invoiceStatusCounts: statusCounts,
    paymentAging: agingBuckets.map(({ label, count, amount }) => ({ label, count, amount })),
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
