import express from "express";
import { Role } from "@prisma/client";
import { optionalAuth, requireAuth, requireRole } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { holdSeat, listShowSeats, releaseSeatHold } from "./show.controller";

export const showRouter = express.Router();

showRouter.get("/:showId/seats", optionalAuth, asyncHandler(listShowSeats));
showRouter.post(
  "/:showId/seats/:seatId/hold",
  requireAuth,
  requireRole(Role.CUSTOMER),
  asyncHandler(holdSeat)
);
showRouter.delete(
  "/:showId/seats/:seatId/hold",
  requireAuth,
  requireRole(Role.CUSTOMER),
  asyncHandler(releaseSeatHold)
);
