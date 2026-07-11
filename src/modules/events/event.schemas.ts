import { z } from "zod";

const nonEmptyString = (field: string) =>
  z.string().trim().min(1, `${field} is required`);

export const eventCreateSchema = z.object({
  venueId: z.string().uuid(),
  title: nonEmptyString("Event title"),
  description: nonEmptyString("Event description")
});

export const eventUpdateSchema = z
  .object({
    venueId: z.string().uuid().optional(),
    title: nonEmptyString("Event title").optional(),
    description: nonEmptyString("Event description").optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required"
  });
