import express from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  createVenue,
  deleteVenue,
  getVenue,
  listVenues,
  updateVenue
} from "./venue.controller";
import { venueCreateSchema, venueUpdateSchema } from "./venue.schemas";

export const venueRouter = express.Router();

venueRouter.use(requireAuth, requireRole(Role.ADMIN));
venueRouter.post("/", validateBody(venueCreateSchema), asyncHandler(createVenue));
venueRouter.get("/", asyncHandler(listVenues));
venueRouter.get("/:id", asyncHandler(getVenue));
venueRouter.put("/:id", validateBody(venueUpdateSchema), asyncHandler(updateVenue));
venueRouter.delete("/:id", asyncHandler(deleteVenue));
