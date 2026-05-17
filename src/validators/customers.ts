import { z } from "zod";
import { optionalBooleanQuery, phoneSchema } from "./common";

export const customerLocationSchema = z
  .object({
    address: z.string().trim().max(500).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    locationLabel: z.string().trim().max(255).optional(),
    googleLocation: z.string().trim().max(1000).optional(),
    googlePlaceId: z.string().trim().max(255).optional(),
    googleFormattedAddress: z.string().trim().max(500).optional(),
    googleMapsUrl: z.string().trim().url().max(1000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one location field is required",
  });

export const customerCreateSchema = z.object({
  name: z.string().trim().min(1),
  phone: phoneSchema,
  password: z.string().min(6).optional(),
  address: z.string().trim().max(500).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  locationLabel: z.string().trim().max(255).optional(),
  googleLocation: z.string().trim().max(1000).optional(),
  googlePlaceId: z.string().trim().max(255).optional(),
  googleFormattedAddress: z.string().trim().max(500).optional(),
  googleMapsUrl: z.string().trim().url().max(1000).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const customerUpdateSchema = customerCreateSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field is required",
});

export const customerPasswordUpdateSchema = z.object({
  password: z.string().min(6),
});

export const customerQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  includeInactive: optionalBooleanQuery,
});
