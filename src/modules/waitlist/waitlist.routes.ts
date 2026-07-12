import express from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { acceptWaitlistOffer, joinWaitlist } from "./waitlist.controller";
import { joinWaitlistSchema } from "./waitlist.schemas";

export const waitlistRouter = express.Router();

waitlistRouter.post(
  "/",
  requireAuth,
  requireRole(Role.CUSTOMER),
  validateBody(joinWaitlistSchema),
  asyncHandler(joinWaitlist)
);
waitlistRouter.get(
  "/:id/accept",
  requireAuth,
  requireRole(Role.CUSTOMER),
  asyncHandler(acceptWaitlistOffer)
);
