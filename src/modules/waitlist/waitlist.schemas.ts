import { z } from "zod";

export const joinWaitlistSchema = z.object({
  showId: z.string().uuid(),
  category: z.string().trim().min(1, "Category is required")
});
