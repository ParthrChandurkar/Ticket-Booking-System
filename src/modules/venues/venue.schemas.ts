import { z } from "zod";

export const venueCreateSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1)
});

export const venueUpdateSchema = venueCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one field is required" }
);

export const seatLayoutCreateSchema = z.object({
  seats: z.array(
    z.object({
      rowLabel: z.string().min(1),
      seatNumber: z.number().int().positive(),
      category: z.string().min(1)
    })
  ).min(1)
});
