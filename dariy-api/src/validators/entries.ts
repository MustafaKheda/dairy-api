import { z } from "zod";
import { dateSchema, idSchema } from "./common";

export const sessionSchema = z.enum(["MORNING", "EVENING"]);
export const entryUnitSchema = z.enum(["LITER", "ML", "KG", "GRAM", "PIECE"]);

export const entryCreateSchema = z.object({
  customerId: idSchema,
  productId: idSchema,
  unit: entryUnitSchema.optional(),
  quantity: z.coerce.number().positive(),
  session: sessionSchema,
  entryDate: dateSchema,
  price: z.coerce.number().positive().optional(),
});

export const entryUpdateSchema = entryCreateSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field is required",
});

export const entryQuerySchema = z.object({
  customerId: idSchema.optional(),
  productId: idSchema.optional(),
  session: sessionSchema.optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
});
