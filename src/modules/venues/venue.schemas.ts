import { z } from "zod";

const nonEmptyString = (field: string) =>
  z.string().trim().min(1, `${field} is required`);

export const venueCreateSchema = z.object({
  name: nonEmptyString("Venue name"),
  address: nonEmptyString("Venue address")
});

export const venueUpdateSchema = venueCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one field is required" }
);

export const seatLayoutCreateSchema = z.object({
  seats: z.array(
    z.object({
      rowLabel: nonEmptyString("Row label"),
      seatNumber: z.number({
        required_error: "Seat number is required",
        invalid_type_error: "Seat number must be a number"
      }).int("Seat number must be a whole number").positive("Seat number must be positive"),
      category: nonEmptyString("Category")
    })
  ).min(1, "At least one seat is required")
});
