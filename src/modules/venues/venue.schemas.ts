import { z } from "zod";

export const venueCreateSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1)
});

export const venueUpdateSchema = venueCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one field is required" }
);
