import { z } from "zod";
import { dateRangeSchema, dateSchema, idSchema } from "./common";

export const invoiceGenerateSchema = dateRangeSchema.extend({
  customerId: idSchema,
});

export const invoiceQuerySchema = z.object({
  customerId: idSchema.optional(),
  status: z.enum(["UNPAID", "PARTIAL", "PAID", "VOID"]).optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
});
