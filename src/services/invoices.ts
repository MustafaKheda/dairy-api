import { and, desc, eq, gte, lte, ne, sql, type SQL } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
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

function formatInvoiceNumber(sequence: number) {
  return `INV-${String(sequence).padStart(4, "0")}`;
}

async function nextInvoiceNumber() {
  const [row] = await db
    .select({ next: sql<number>`coalesce(max(${invoices.id}), 0) + 1` })
    .from(invoices);

  return formatInvoiceNumber(Number(row?.next ?? 1));
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
      invoiceNumber: await nextInvoiceNumber(),
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

const PDF = {
  margin: 50,
  contentRight: 545,
  contentWidth: 495,
  primary: "#14532d",
  primaryLight: "#dcfce7",
  text: "#111827",
  textMuted: "#6b7280",
  border: "#e5e7eb",
  rowAlt: "#f9fafb",
  footerY: 800,
  tableBottom: 680,
} as const;

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  PAID: { bg: "#dcfce7", text: "#166534", label: "Paid" },
  UNPAID: { bg: "#fee2e2", text: "#991b1b", label: "Unpaid" },
  PARTIAL: { bg: "#fef3c7", text: "#92400e", label: "Partial" },
  VOID: { bg: "#f3f4f6", text: "#4b5563", label: "Void" },
};

function formatMoney(value: number) {
  return `Rs. ${Number(value).toFixed(2)}`;
}

function formatPdfDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
}

function drawLabelValue(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  y: number,
  width = 200,
) {
  doc.font("Helvetica-Bold").fontSize(8).fillColor(PDF.textMuted).text(label.toUpperCase(), x, y);
  doc.font("Helvetica").fontSize(11).fillColor(PDF.text).text(value || "—", x, y + 12, { width });
}

function drawStatusBadge(doc: PDFKit.PDFDocument, status: string, x: number, y: number) {
  const style = STATUS_STYLE[status] ?? { bg: "#f3f4f6", text: PDF.text, label: status };
  const badgeW = 88;
  const badgeH = 26;

  doc.roundedRect(x, y, badgeW, badgeH, 6).fill(style.bg);
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(style.text)
    .text(style.label, x, y + 8, { width: badgeW, align: "center" });
}

function drawPageHeader(doc: PDFKit.PDFDocument, invoice: Awaited<ReturnType<typeof getInvoiceById>>) {
  const headerH = 88;

  doc.rect(0, 0, doc.page.width, headerH).fill(PDF.primary);

  doc
    .font("Helvetica-Bold")
    .fontSize(20)
    .fillColor("#ffffff")
    .text("Dairy Management", PDF.margin, 28);
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#bbf7d0")
    .text("Invoice & billing statement", PDF.margin, 54);

  const invoiceBlockX = 360;
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#bbf7d0").text("INVOICE", invoiceBlockX, 28);
  doc.font("Helvetica-Bold").fontSize(16).fillColor("#ffffff").text(invoice.invoiceNumber, invoiceBlockX, 44);
  drawStatusBadge(doc, invoice.status, PDF.contentRight - 88, 30);

  return headerH + 20;
}

function drawInfoPanels(doc: PDFKit.PDFDocument, invoice: Awaited<ReturnType<typeof getInvoiceById>>, y: number) {
  const panelH = 118;
  const gap = 16;
  const panelW = (PDF.contentWidth - gap) / 2;
  const leftX = PDF.margin;
  const rightX = leftX + panelW + gap;
  const innerW = panelW - 28;

  for (const [x, title] of [
    [leftX, "Bill To"],
    [rightX, "Invoice Details"],
  ] as const) {
    doc.roundedRect(x, y, panelW, panelH, 8).lineWidth(1).strokeColor(PDF.border).stroke();
    doc.font("Helvetica-Bold").fontSize(9).fillColor(PDF.primary).text(title, x + 14, y + 14);
  }

  drawLabelValue(doc, "Customer", invoice.customer.name, leftX + 14, y + 34, innerW);
  drawLabelValue(doc, "Phone", invoice.customer.phone, leftX + 14, y + 62, innerW);
  if (invoice.customer.address) {
    drawLabelValue(doc, "Address", invoice.customer.address, leftX + 14, y + 90, innerW);
  }

  drawLabelValue(
    doc,
    "Billing period",
    `${formatPdfDate(invoice.startDate)} – ${formatPdfDate(invoice.endDate)}`,
    rightX + 14,
    y + 34,
    innerW,
  );
  drawLabelValue(doc, "Issued on", formatPdfDate(invoice.createdAt), rightX + 14, y + 62, innerW);
  drawLabelValue(doc, "Status", STATUS_STYLE[invoice.status]?.label ?? invoice.status, rightX + 14, y + 90, innerW);

  return y + panelH + 24;
}

function drawTableHeader(doc: PDFKit.PDFDocument, y: number) {
  const col = { product: 60, unit: 235, qty: 310, price: 385, amount: 470 };

  doc.roundedRect(PDF.margin, y, PDF.contentWidth, 28, 6).fill(PDF.primaryLight);
  doc.fillColor(PDF.primary).font("Helvetica-Bold").fontSize(9);
  doc.text("PRODUCT", col.product, y + 10, { width: 165 });
  doc.text("UNIT", col.unit, y + 10, { width: 65 });
  doc.text("QTY", col.qty, y + 10, { width: 55, align: "right" });
  doc.text("PRICE", col.price, y + 10, { width: 70, align: "right" });
  doc.text("AMOUNT", col.amount, y + 10, { width: 65, align: "right" });

  return { y: y + 36, col };
}

function drawTableRow(
  doc: PDFKit.PDFDocument,
  item: Awaited<ReturnType<typeof getInvoiceById>>["items"][number],
  y: number,
  col: ReturnType<typeof drawTableHeader>["col"],
  rowIndex: number,
) {
  const rowH = Math.max(28, doc.heightOfString(item.productName, { width: 165 }) + 14);

  if (rowIndex % 2 === 1) {
    doc.rect(PDF.margin, y - 4, PDF.contentWidth, rowH).fill(PDF.rowAlt);
  }

  doc.font("Helvetica").fontSize(10).fillColor(PDF.text);
  doc.text(item.productName, col.product, y, { width: 165 });
  doc.fillColor(PDF.textMuted).text(item.unit, col.unit, y, { width: 65 });
  doc.fillColor(PDF.text).text(String(item.quantity), col.qty, y, { width: 55, align: "right" });
  doc.text(formatMoney(item.price), col.price, y, { width: 70, align: "right" });
  doc.font("Helvetica-Bold").text(formatMoney(item.amount), col.amount, y, { width: 65, align: "right" });

  return y + rowH;
}

function drawTotalsBox(
  doc: PDFKit.PDFDocument,
  invoice: Awaited<ReturnType<typeof getInvoiceById>>,
  y: number,
) {
  const boxW = 240;
  const boxX = PDF.contentRight - boxW;
  const rows = [
    { label: "Subtotal", value: invoice.totalAmount, bold: false },
    { label: "Paid", value: invoice.paidAmount, bold: false },
    { label: "Balance due", value: invoice.pendingAmount, bold: true },
  ] as const;
  const boxH = 24 + rows.length * 28 + 12;

  doc.roundedRect(boxX, y, boxW, boxH, 8).lineWidth(1).strokeColor(PDF.border).stroke();

  let rowY = y + 16;
  for (const row of rows) {
    const isDue = row.bold && invoice.pendingAmount > 0;
    doc
      .font(row.bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(row.bold ? 11 : 10)
      .fillColor(isDue ? "#991b1b" : PDF.textMuted)
      .text(row.label, boxX + 16, rowY, { width: 90 });
    doc
      .font("Helvetica-Bold")
      .fontSize(row.bold ? 12 : 10)
      .fillColor(isDue ? "#991b1b" : PDF.text)
      .text(formatMoney(row.value), boxX + 16, rowY, { width: boxW - 32, align: "right" });
    rowY += 28;
  }

  return y + boxH + 16;
}

function drawPageFooters(doc: PDFKit.PDFDocument, invoiceNumber: string) {
  const range = doc.bufferedPageRange();
  const generated = formatPdfDate(new Date().toISOString());

  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc
      .moveTo(PDF.margin, PDF.footerY - 8)
      .lineTo(PDF.contentRight, PDF.footerY - 8)
      .lineWidth(0.5)
      .strokeColor(PDF.border)
      .stroke();
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(PDF.textMuted)
      .text(`Generated ${generated}`, PDF.margin, PDF.footerY, { width: 280 });
    doc.text(`${invoiceNumber}  ·  Page ${i - range.start + 1} of ${range.count}`, PDF.margin, PDF.footerY, {
      width: PDF.contentWidth,
      align: "right",
    });
  }
}

function drawContinuationBanner(doc: PDFKit.PDFDocument, invoiceNumber: string) {
  doc.rect(0, 0, doc.page.width, 44).fill(PDF.primaryLight);
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(PDF.primary)
    .text(`${invoiceNumber} — continued`, PDF.margin, 16);
  return 58;
}

function addPageIfNeeded(
  doc: PDFKit.PDFDocument,
  y: number,
  invoiceNumber: string,
) {
  if (y <= PDF.tableBottom) {
    return y;
  }

  doc.addPage();
  return drawTableHeader(doc, drawContinuationBanner(doc, invoiceNumber)).y;
}

export function generateInvoicePdf(invoice: Awaited<ReturnType<typeof getInvoiceById>>) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: PDF.margin, bufferPages: true });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    let y = drawPageHeader(doc, invoice);
    y = drawInfoPanels(doc, invoice, y);

    let { y: tableY, col } = drawTableHeader(doc, y);

    invoice.items.forEach((item, index) => {
      tableY = addPageIfNeeded(doc, tableY, invoice.invoiceNumber);
      tableY = drawTableRow(doc, item, tableY, col, index);
    });

    tableY = addPageIfNeeded(doc, tableY + 24, invoice.invoiceNumber);
    drawTotalsBox(doc, invoice, tableY);
    drawPageFooters(doc, invoice.invoiceNumber);

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
