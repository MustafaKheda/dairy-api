import { and, desc, eq, gte, lte, ne, type SQL } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import PDFDocument from "pdfkit";
import { db } from "../db/client.js";
import { env } from "../lib/env.js";
import { customers, dailyEntries, invoiceItems, invoices, payments, products } from "../schema/index.js";
import type { AuthUser } from "../types.js";

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

function formatMoney(value: number) {
  return `Rs. ${Number(value).toFixed(2)}`;
}

function drawKeyValue(doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number) {
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#6b7280").text(label.toUpperCase(), x, y);
  doc.font("Helvetica").fontSize(11).fillColor("#111827").text(value, x, y + 14, { width: 220 });
}

function drawTableHeader(doc: PDFKit.PDFDocument, y: number) {
  doc.rect(50, y, 495, 24).fill("#f3f4f6");
  doc.fillColor("#374151").font("Helvetica-Bold").fontSize(9);
  doc.text("Product", 60, y + 8, { width: 170 });
  doc.text("Unit", 235, y + 8, { width: 70 });
  doc.text("Qty", 305, y + 8, { width: 60, align: "right" });
  doc.text("Price", 375, y + 8, { width: 70, align: "right" });
  doc.text("Amount", 465, y + 8, { width: 70, align: "right" });
}

function addPageIfNeeded(doc: PDFKit.PDFDocument, y: number) {
  if (y <= 720) {
    return y;
  }

  doc.addPage();
  drawTableHeader(doc, 50);
  return 82;
}

export function generateInvoicePdf(invoice: Awaited<ReturnType<typeof getInvoiceById>>) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.font("Helvetica-Bold").fontSize(24).fillColor("#111827").text("Dairy Invoice", 50, 48);
    doc.font("Helvetica").fontSize(10).fillColor("#4b5563").text(invoice.invoiceNumber, 50, 78);
    doc
      .roundedRect(460, 50, 85, 24, 4)
      .fill("#f3f4f6")
      .fillColor("#111827")
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(invoice.status, 460, 57, { width: 85, align: "center" });

    doc.moveTo(50, 112).lineTo(545, 112).lineWidth(1.5).strokeColor("#111827").stroke();

    drawKeyValue(doc, "Period", `${invoice.startDate} to ${invoice.endDate}`, 50, 136);
    drawKeyValue(doc, "Customer", invoice.customer.name, 300, 136);
    drawKeyValue(doc, "Phone", invoice.customer.phone, 50, 186);
    drawKeyValue(doc, "Address", invoice.customer.address ?? "", 300, 186);

    let y = 252;
    drawTableHeader(doc, y);
    y += 34;

    for (const item of invoice.items) {
      y = addPageIfNeeded(doc, y);

      doc.font("Helvetica").fontSize(10).fillColor("#111827");
      doc.text(item.productName, 60, y, { width: 170 });
      doc.text(item.unit, 235, y, { width: 70 });
      doc.text(String(item.quantity), 305, y, { width: 60, align: "right" });
      doc.text(formatMoney(item.price), 375, y, { width: 70, align: "right" });
      doc.text(formatMoney(item.amount), 465, y, { width: 70, align: "right" });
      y += Math.max(24, doc.heightOfString(item.productName, { width: 170 }) + 10);
      doc.moveTo(50, y - 5).lineTo(545, y - 5).lineWidth(0.5).strokeColor("#e5e7eb").stroke();
    }

    y = addPageIfNeeded(doc, y + 20);
    const totalsX = 335;
    const totals = [
      ["Total", invoice.totalAmount],
      ["Paid", invoice.paidAmount],
      ["Pending", invoice.pendingAmount],
    ] as const;

    for (const [label, value] of totals) {
      doc.font("Helvetica").fontSize(11).fillColor("#374151").text(label, totalsX, y, { width: 90 });
      doc.font("Helvetica-Bold").fillColor("#111827").text(formatMoney(value), 425, y, { width: 110, align: "right" });
      y += 24;
    }

    doc.end();
  });
}

export async function getInvoicePdf(invoiceId: number, authUser?: AuthUser) {
  const invoice = await getInvoiceById(invoiceId, authUser);
  const pdf = await generateInvoicePdf(invoice);

  return {
    pdf,
    filename: `${invoice.invoiceNumber}.pdf`,
  };
}
