import { z } from "zod";

const nonEmptyString = (field: string) =>
  z.string().trim().min(1, `${field} is required`);

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export const showCreateSchema = z.object({
  date: z.coerce
    .date({ invalid_type_error: "Date must be valid" })
    .refine((date) => date.getTime() > Date.now(), "Date must be in the future"),
  time: z.string().trim().regex(timePattern, "Time must be in HH:mm format"),
  categoryPrices: z
    .array(
      z.object({
        category: nonEmptyString("Category"),
        price: z.number({
          required_error: "Price is required",
          invalid_type_error: "Price must be a number"
        }).positive("Price must be positive")
      })
    )
    .min(1, "At least one category price is required")
});
