import express from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  cancelBooking,
  createBooking,
  listBookings,
  resendConfirmation
} from "./booking.controller";
import { createBookingSchema } from "./booking.schemas";

export const bookingRouter = express.Router();

bookingRouter.use(requireAuth, requireRole(Role.CUSTOMER));
bookingRouter.post("/", validateBody(createBookingSchema), asyncHandler(createBooking));
bookingRouter.get("/", asyncHandler(listBookings));
bookingRouter.get("/:id/resend-confirmation", asyncHandler(resendConfirmation));
bookingRouter.delete("/:id", asyncHandler(cancelBooking));
