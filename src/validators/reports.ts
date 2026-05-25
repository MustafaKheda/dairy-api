import { z } from "zod";
import { dateSchema, idSchema, monthSchema } from "./common.js";
import { today } from "../utils/date.js";

export const dashboardQuerySchema = z
  .object({
    date: dateSchema.default(today),
    month: monthSchema.default(() => today().slice(0, 7)),
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
    customerId: idSchema.optional(),
  })
  .refine((value) => !value.startDate || !value.endDate || value.startDate <= value.endDate, {
    message: "Start date must be before or equal to end date",
    path: ["endDate"],
  })
  .refine((value) => Boolean(value.startDate) === Boolean(value.endDate), {
    message: "startDate and endDate must be provided together",
    path: ["endDate"],
  });

export const dailySalesQuerySchema = z.object({
  date: dateSchema.default(today),
});

export const monthlySalesQuerySchema = z.object({
  month: monthSchema,
});

export const customerSummaryQuerySchema = z
  .object({
    customerId: idSchema.optional(),
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
  })
  .refine((value) => !value.startDate || !value.endDate || value.startDate <= value.endDate, {
    message: "Start date must be before or equal to end date",
    path: ["endDate"],
  })
  .refine((value) => Boolean(value.startDate) === Boolean(value.endDate), {
    message: "startDate and endDate must be provided together",
    path: ["endDate"],
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
