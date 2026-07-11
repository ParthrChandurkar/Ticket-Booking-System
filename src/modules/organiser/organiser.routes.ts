import express from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { getEventRevenueSummary, listOrganiserVenues } from "./organiser.controller";

export const organiserRouter = express.Router();

organiserRouter.use(requireAuth, requireRole(Role.ORGANISER));
organiserRouter.get("/venues", asyncHandler(listOrganiserVenues));
organiserRouter.get("/events/:id/summary", asyncHandler(getEventRevenueSummary));
