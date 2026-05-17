import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "../db/client";
import { customers, invoices, payments } from "../schema";
import type { paymentCreateSchema, paymentQuerySchema } from "../validators/payments";

type PaymentQuery = typeof paymentQuerySchema._output & {
  customerId?: number;
};

export async function listPayments(query: PaymentQuery) {
  const conditions: SQL[] = [];

  if (query.invoiceId) conditions.push(eq(payments.invoiceId, query.invoiceId));
  if (query.customerId) conditions.push(eq(invoices.customerId, query.customerId));
  if (query.startDate) conditions.push(gte(payments.paymentDate, query.startDate));
  if (query.endDate) conditions.push(lte(payments.paymentDate, query.endDate));

  return db
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
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(payments.paymentDate), desc(payments.id));
}

export async function createPayment(input: typeof paymentCreateSchema._output) {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, input.invoiceId)).limit(1);

  if (!invoice) {
    throw new HTTPException(404, { message: "Invoice not found" });
  }

  if (invoice.status === "VOID") {
    throw new HTTPException(400, { message: "Cannot add payment to a void invoice" });
  }

  if (input.amount > invoice.pendingAmount) {
    throw new HTTPException(400, { message: "Payment amount cannot exceed the pending invoice amount" });
  }

  const [payment] = await db.insert(payments).values(input).returning();
  const updatedInvoice = await refreshInvoicePaymentStatus(input.invoiceId);

  return { payment, invoice: updatedInvoice };
}

export async function refreshInvoicePaymentStatus(invoiceId: number) {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);

  if (!invoice) {
    throw new HTTPException(404, { message: "Invoice not found" });
  }

  const [paymentTotal] = await db
    .select({
      paidAmount: sql<number>`coalesce(sum(${payments.amount}), 0)`,
    })
    .from(payments)
    .where(eq(payments.invoiceId, invoiceId));

  const paidAmount = Number(paymentTotal?.paidAmount ?? 0);
  const pendingAmount = Math.max(invoice.totalAmount - paidAmount, 0);
  const status = paidAmount <= 0 ? "UNPAID" : pendingAmount <= 0 ? "PAID" : "PARTIAL";

  const [updated] = await db
    .update(invoices)
    .set({ paidAmount, pendingAmount, status })
    .where(eq(invoices.id, invoiceId))
    .returning();

  return updated;
}
