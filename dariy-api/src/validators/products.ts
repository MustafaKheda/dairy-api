import { z } from "zod";
import { optionalBooleanQuery } from "./common";

export const productUnitSchema = z.enum(["LITER", "ML", "KG", "GRAM", "PIECE"]);

export const productCreateSchema = z.object({
  name: z.string().trim().min(1),
  price: z.coerce.number().positive(),
  unit: productUnitSchema,
  isActive: z.boolean().default(true),
});

export const productUpdateSchema = productCreateSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field is required",
});

export const productQuerySchema = z.object({
  search: z.string().trim().optional(),
  includeInactive: optionalBooleanQuery,
});
