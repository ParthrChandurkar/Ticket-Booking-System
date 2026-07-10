import { z } from "zod";

export const createBookingSchema = z.object({
  showSeatIds: z.array(z.string().uuid()).min(1)
});
