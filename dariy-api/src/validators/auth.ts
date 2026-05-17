import { z } from "zod";
import { phoneSchema } from "./common";

export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(6),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(6),
    newPassword: z.string().min(6),
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  });
