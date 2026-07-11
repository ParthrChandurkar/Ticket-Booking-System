import { z } from "zod";

const nonEmptyString = (field: string) =>
  z.string().trim().min(1, `${field} is required`);

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[0-9]/, "Password must include a number");

export const registerSchema = z.object({
  name: nonEmptyString("Name"),
  email: z.string().trim().email("Email must be valid").toLowerCase(),
  password: passwordSchema
});

export const organiserRegisterSchema = registerSchema.extend({
  organiserSignupCode: nonEmptyString("Organiser signup code")
});

export const loginSchema = z.object({
  email: z.string().trim().email("Email must be valid").toLowerCase(),
  password: z.string().min(1, "Password is required")
});

export const refreshSchema = z.object({
  refreshToken: nonEmptyString("Refresh token")
});
