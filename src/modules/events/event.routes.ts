import express from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  createEvent,
  deleteEvent,
  getEvent,
  listEvents,
  updateEvent
} from "./event.controller";
import { eventCreateSchema, eventUpdateSchema } from "./event.schemas";

export const eventRouter = express.Router();

eventRouter.use(requireAuth, requireRole(Role.ORGANISER));
eventRouter.post("/", validateBody(eventCreateSchema), asyncHandler(createEvent));
eventRouter.get("/", asyncHandler(listEvents));
eventRouter.get("/:id", asyncHandler(getEvent));
eventRouter.put("/:id", validateBody(eventUpdateSchema), asyncHandler(updateEvent));
eventRouter.delete("/:id", asyncHandler(deleteEvent));
