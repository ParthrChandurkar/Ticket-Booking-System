import { z } from "zod";

export const showCreateSchema = z.object({
  date: z.coerce.date(),
  time: z.string().min(1),
  categoryPrices: z
    .array(
      z.object({
        category: z.string().min(1),
        price: z.number().positive()
      })
    )
    .optional()
});
