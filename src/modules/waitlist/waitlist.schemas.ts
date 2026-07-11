import { z } from "zod";

export const joinWaitlistSchema = z.object({
  showId: z.string().uuid(),
  category: z.string().min(1)
});
