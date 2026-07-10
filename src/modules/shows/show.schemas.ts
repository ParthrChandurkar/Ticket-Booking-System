import { z } from "zod";

export const showCreateSchema = z.object({
  date: z.coerce.date(),
  time: z.string().min(1)
});
