import { and, desc, eq, gte, lte, ne, type SQL } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "../db/client";
import { env } from "../lib/env";
import { customers, dailyEntries, invoiceItems, invoices, payments, products } from "../schema";
import type { AuthUser } from "../types";

type GenerateInvoiceInput = {
  customerId: number;
  startDate: string;
  endDate: string;
};

type ProductUnit = "LITER" | "ML" | "KG" | "GRAM" | "PIECE";

type InvoiceDraftItem = {
  productId: number;
  productName: string;
  unit: ProductUnit;
  quantity: number;
  price: number;
  amount: number;
};

type InvoiceQuery = {
  customerId?: number;
  status?: "UNPAID" | "PARTIAL" | "PAID" | "VOID";
  startDate?: string;
  endDate?: string;
};

function invoiceNumber(customerId: number) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 17);
  const suffix = crypto.randomUUID().slice(0, 8).toUpperCase();
  return `INV-${stamp}-C${customerId}-${suffix}`;
}

export async function listInvoices(query: InvoiceQuery) {
  const conditions: SQL[] = [];

  if (query.customerId) conditions.push(eq(invoices.customerId, query.customerId));
  if (query.status) conditions.push(eq(invoices.status, query.status));
  if (query.startDate) conditions.push(gte(invoices.startDate, query.startDate));
  if (query.endDate) conditions.push(lte(invoices.endDate, query.endDate));

  return db
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
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(invoices.createdAt));
}

function assertInvoiceAccess(invoice: { customerId: number }, authUser?: AuthUser) {
  if (!authUser || authUser.role === "ADMIN") {
    return;
  }

  if (!authUser.customerId || authUser.customerId !== invoice.customerId) {
    throw new HTTPException(403, { message: "Invoice not found" });
  }
}

export async function getInvoiceById(invoiceId: number, authUser?: AuthUser) {
  const [invoice] = await db
    .select({
      id: invoices.id,
      customerId: invoices.customerId,
      invoiceNumber: invoices.invoiceNumber,
      startDate: invoices.startDate,
      endDate: invoices.endDate,
      totalAmount: invoices.totalAmount,
      paidAmount: invoices.paidAmount,
      pendingAmount: invoices.pendingAmount,
      status: invoices.status,
      pdfUrl: invoices.pdfUrl,
      createdAt: invoices.createdAt,
      customerName: customers.name,
      customerPhone: customers.phone,
      customerAddress: customers.address,
    })
    .from(invoices)
    .innerJoin(customers, eq(customers.id, invoices.customerId))
    .where(eq(invoices.id, invoiceId))
    .limit(1);

  if (!invoice) {
    throw new HTTPException(404, { message: "Invoice not found" });
  }

  assertInvoiceAccess(invoice, authUser);

  const items = await db
    .select({
      id: invoiceItems.id,
      productId: invoiceItems.productId,
      productName: products.name,
      unit: invoiceItems.unit,
      quantity: invoiceItems.quantity,
      price: invoiceItems.price,
      amount: invoiceItems.amount,
    })
    .from(invoiceItems)
    .innerJoin(products, eq(products.id, invoiceItems.productId))
    .where(eq(invoiceItems.invoiceId, invoiceId));

  const invoicePayments = await db
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, invoiceId))
    .orderBy(desc(payments.paymentDate));

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    startDate: invoice.startDate,
    endDate: invoice.endDate,
    totalAmount: invoice.totalAmount,
    paidAmount: invoice.paidAmount,
    pendingAmount: invoice.pendingAmount,
    status: invoice.status,
    pdfUrl: invoice.pdfUrl,
    createdAt: invoice.createdAt,
    customer: {
      id: invoice.customerId,
      name: invoice.customerName,
      phone: invoice.customerPhone,
      address: invoice.customerAddress,
    },
    items,
    payments: invoicePayments,
  };
}

async function buildInvoiceDraft(input: GenerateInvoiceInput) {
  const [customer] = await db.select().from(customers).where(eq(customers.id, input.customerId)).limit(1);

  if (!customer) {
    throw new HTTPException(404, { message: "Customer not found" });
  }

  const [existingInvoice] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      and(
        eq(invoices.customerId, input.customerId),
        ne(invoices.status, "VOID"),
        lte(invoices.startDate, input.endDate),
        gte(invoices.endDate, input.startDate),
      ),
    )
    .limit(1);

  if (existingInvoice) {
    throw new HTTPException(409, { message: "An invoice already exists for an overlapping date range" });
  }

  const entryRows = await db
    .select({
      productId: dailyEntries.productId,
      productName: products.name,
      unit: dailyEntries.unit,
      quantity: dailyEntries.quantity,
      price: dailyEntries.price,
    })
    .from(dailyEntries)
    .innerJoin(products, eq(products.id, dailyEntries.productId))
    .where(
      and(
        eq(dailyEntries.customerId, input.customerId),
        gte(dailyEntries.entryDate, input.startDate),
        lte(dailyEntries.entryDate, input.endDate),
      ),
    );

  if (entryRows.length === 0) {
    throw new HTTPException(400, { message: "No delivery entries found for this date range" });
  }

  const groupedItems = new Map<string, InvoiceDraftItem>();

  for (const entry of entryRows) {
    const key = `${entry.productId}:${entry.unit}:${entry.price}`;
    const current = groupedItems.get(key) ?? {
      productId: entry.productId,
      productName: entry.productName,
      unit: entry.unit as ProductUnit,
      quantity: 0,
      price: entry.price,
      amount: 0,
    };

    current.quantity += entry.quantity;
    current.amount += entry.quantity * entry.price;
    groupedItems.set(key, current);
  }

  const items = [...groupedItems.values()].map((item) => ({
    ...item,
    quantity: Number(item.quantity.toFixed(3)),
    amount: Number(item.amount.toFixed(2)),
  }));
  const totalAmount = Number(items.reduce((sum, item) => sum + item.amount, 0).toFixed(2));

  return {
    customer,
    startDate: input.startDate,
    endDate: input.endDate,
    totalAmount,
    pendingAmount: totalAmount,
    items,
  };
}

export async function previewInvoice(input: GenerateInvoiceInput) {
  const draft = await buildInvoiceDraft(input);

  return {
    startDate: draft.startDate,
    endDate: draft.endDate,
    totalAmount: draft.totalAmount,
    pendingAmount: draft.pendingAmount,
    customer: {
      id: draft.customer.id,
      name: draft.customer.name,
      phone: draft.customer.phone,
      address: draft.customer.address,
    },
    items: draft.items,
  };
}

export async function generateInvoice(input: GenerateInvoiceInput) {
  const draft = await buildInvoiceDraft(input);

  const [invoice] = await db
    .insert(invoices)
    .values({
      customerId: input.customerId,
      invoiceNumber: invoiceNumber(input.customerId),
      startDate: input.startDate,
      endDate: input.endDate,
      totalAmount: draft.totalAmount,
      pendingAmount: draft.pendingAmount,
      status: "UNPAID",
    })
    .returning();

  await db.insert(invoiceItems).values(
    draft.items.map((item) => ({
      invoiceId: invoice.id,
      productId: item.productId,
      unit: item.unit,
      quantity: item.quantity,
      price: item.price,
      amount: item.amount,
    })),
  );

  const pdfUrl = `${env.appUrl.replace(/\/$/, "")}/invoices/${invoice.id}/pdf`;
  await db.update(invoices).set({ pdfUrl }).where(eq(invoices.id, invoice.id));

  return getInvoiceById(invoice.id);
}

export async function voidInvoice(invoiceId: number) {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);

  if (!invoice) {
    throw new HTTPException(404, { message: "Invoice not found" });
  }

  if (invoice.status !== "VOID") {
    await db.update(invoices).set({ status: "VOID", pendingAmount: 0 }).where(eq(invoices.id, invoiceId));
  }

  return getInvoiceById(invoiceId);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMoney(value: number) {
  return `Rs. ${Number(value).toFixed(2)}`;
}

export function renderInvoiceHtml(invoice: Awaited<ReturnType<typeof getInvoiceById>>) {
  const rows = invoice.items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.productName)}</td>
          <td>${escapeHtml(item.unit)}</td>
          <td>${item.quantity}</td>
          <td>${formatMoney(item.price)}</td>
          <td>${formatMoney(item.amount)}</td>
        </tr>
      `,
    )
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; color: #1f2937; margin: 40px; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #111827; padding-bottom: 18px; }
          h1 { margin: 0; font-size: 28px; }
          h2 { margin: 24px 0 8px; font-size: 16px; }
          p { margin: 4px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 24px; }
          th, td { border-bottom: 1px solid #e5e7eb; padding: 10px 8px; text-align: left; }
          th { background: #f9fafb; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
          .totals { margin-left: auto; margin-top: 24px; width: 280px; }
          .totals div { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
          .status { display: inline-block; margin-top: 8px; padding: 4px 8px; background: #f3f4f6; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>Dairy Invoice</h1>
            <p>${escapeHtml(invoice.invoiceNumber)}</p>
            <span class="status">${escapeHtml(invoice.status)}</span>
          </div>
          <div>
            <p><strong>Period</strong></p>
            <p>${escapeHtml(invoice.startDate)} to ${escapeHtml(invoice.endDate)}</p>
          </div>
        </div>

        <h2>Customer</h2>
        <p><strong>${escapeHtml(invoice.customer.name)}</strong></p>
        <p>${escapeHtml(invoice.customer.phone)}</p>
        <p>${escapeHtml(invoice.customer.address)}</p>

        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Unit</th>
              <th>Quantity</th>
              <th>Price</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="totals">
          <div><span>Total</span><strong>${formatMoney(invoice.totalAmount)}</strong></div>
          <div><span>Paid</span><strong>${formatMoney(invoice.paidAmount)}</strong></div>
          <div><span>Pending</span><strong>${formatMoney(invoice.pendingAmount)}</strong></div>
        </div>
      </body>
    </html>
  `;
}

export async function generateInvoicePdf(invoice: Awaited<ReturnType<typeof getInvoiceById>>) {
  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(renderInvoiceHtml(invoice), { waitUntil: "domcontentloaded" });
    return await page.pdf({ format: "A4", printBackground: true });
  } finally {
    await browser.close();
  }
}

export async function getInvoicePdf(invoiceId: number, authUser?: AuthUser) {
  const invoice = await getInvoiceById(invoiceId, authUser);
  const pdf = await generateInvoicePdf(invoice);

  return {
    pdf,
    filename: `${invoice.invoiceNumber}.pdf`,
  };
}
