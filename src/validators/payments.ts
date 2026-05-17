import { z } from "zod";
import { dateSchema, idSchema } from "./common.js";
import { today } from "../utils/date.js";

export const paymentMethodSchema = z.enum(["CASH", "UPI", "BANK_TRANSFER", "CARD", "OTHER"]);

export const paymentCreateSchema = z.object({
  invoiceId: idSchema,
  amount: z.coerce.number().positive(),
  paymentDate: dateSchema.default(today),
  paymentMethod: paymentMethodSchema.default("CASH"),
  notes: z.string().trim().max(500).optional(),
});

export const paymentQuerySchema = z.object({
  invoiceId: idSchema.optional(),
  customerId: idSchema.optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
});
