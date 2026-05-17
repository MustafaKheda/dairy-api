import { z } from "zod";
import { dateSchema, idSchema, monthSchema } from "./common";
import { today } from "../utils/date";

export const dashboardQuerySchema = z.object({
  date: dateSchema.default(today),
  month: monthSchema.default(() => today().slice(0, 7)),
  customerId: idSchema.optional(),
});

export const dailySalesQuerySchema = z.object({
  date: dateSchema.default(today),
});

export const monthlySalesQuerySchema = z.object({
  month: monthSchema,
});

export const customerSummaryQuerySchema = z.object({
  customerId: idSchema.optional(),
});

export const customerLedgerQuerySchema = z
  .object({
    customerId: idSchema.optional(),
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
  })
  .refine((value) => !value.startDate || !value.endDate || value.startDate <= value.endDate, {
    message: "Start date must be before or equal to end date",
    path: ["endDate"],
  });
