import { z } from "zod";

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{10,15}$/, "Phone number must contain 10 to 15 digits");

export const idSchema = z.coerce.number().int().positive();

export const idParamSchema = z.object({
  id: idSchema,
});

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }, "Invalid date");

export const monthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Month must use YYYY-MM format")
  .refine((value) => {
    const [year, month] = value.split("-").map(Number);
    return year >= 1 && month >= 1 && month <= 12;
  }, "Invalid month");

export const dateRangeSchema = z
  .object({
    startDate: dateSchema,
    endDate: dateSchema,
  })
  .refine((value) => value.startDate <= value.endDate, {
    message: "Start date must be before or equal to end date",
    path: ["endDate"],
  });

export const optionalBooleanQuery = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .optional();
