import { z } from "zod";

export const eventCreateSchema = z.object({
  venueId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().min(1)
});

export const eventUpdateSchema = z
  .object({
    venueId: z.string().uuid().optional(),
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required"
  });
