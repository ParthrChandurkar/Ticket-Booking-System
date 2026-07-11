import express from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { createShow } from "../shows/show.controller";
import { showCreateSchema } from "../shows/show.schemas";
import {
  createEvent,
  deleteEvent,
  getEvent,
  getPublicEvent,
  listPublicEvents,
  listEvents,
  updateEvent
} from "./event.controller";
import { eventCreateSchema, eventUpdateSchema } from "./event.schemas";

export const eventRouter = express.Router();

eventRouter.get("/public", asyncHandler(listPublicEvents));
eventRouter.get("/public/:id", asyncHandler(getPublicEvent));

eventRouter.use(requireAuth, requireRole(Role.ORGANISER));
eventRouter.post("/", validateBody(eventCreateSchema), asyncHandler(createEvent));
eventRouter.get("/", asyncHandler(listEvents));
eventRouter.post("/:eventId/shows", validateBody(showCreateSchema), asyncHandler(createShow));
eventRouter.get("/:id", asyncHandler(getEvent));
eventRouter.put("/:id", validateBody(eventUpdateSchema), asyncHandler(updateEvent));
eventRouter.delete("/:id", asyncHandler(deleteEvent));
