import express from "express";
import { requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { holdSeat, listShowSeats, releaseSeatHold } from "./show.controller";

export const showRouter = express.Router();

showRouter.get("/:showId/seats", asyncHandler(listShowSeats));
showRouter.post("/:showId/seats/:seatId/hold", requireAuth, asyncHandler(holdSeat));
showRouter.delete("/:showId/seats/:seatId/hold", requireAuth, asyncHandler(releaseSeatHold));
