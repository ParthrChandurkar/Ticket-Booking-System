import { Request, Response } from "express";
import { prisma } from "../../config/prisma";
import { getAuthUser } from "../../utils/getAuthUser";
import { getRouteParam } from "../../utils/getRouteParam";
import { HttpError } from "../../utils/httpError";

export const createEvent = async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const event = await prisma.event.create({
    data: {
      organiserId: user.id,
      venueId: req.body.venueId,
      title: req.body.title,
      description: req.body.description
    }
  });

  res.status(201).json({ event });
};

export const listPublicEvents = async (req: Request, res: Response) => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const events = await prisma.event.findMany({
    where: search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } }
          ]
        }
      : undefined,
    include: {
      shows: {
        orderBy: [{ date: "asc" }, { time: "asc" }],
        include: { pricing: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  const venueIds = Array.from(new Set(events.map((event) => event.venueId)));
  const venues = await prisma.venue.findMany({
    where: { id: { in: venueIds } }
  });
  const venueById = new Map(venues.map((venue) => [venue.id, venue]));

  res.json({
    events: events.map((event) => ({
      ...event,
      venue: venueById.get(event.venueId) ?? null
    }))
  });
};

export const getPublicEvent = async (req: Request, res: Response) => {
  const id = getRouteParam(req, "id");
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      shows: {
        orderBy: [{ date: "asc" }, { time: "asc" }],
        include: { pricing: true }
      }
    }
  });
  if (!event) {
    throw new HttpError(404, "Event not found");
  }

  const venue = await prisma.venue.findUnique({
    where: { id: event.venueId }
  });

  res.json({ event: { ...event, venue } });
};

export const listEvents = async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const events = await prisma.event.findMany({
    where: { organiserId: user.id },
    orderBy: { createdAt: "desc" }
  });

  res.json({ events });
};

export const getEvent = async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const id = getRouteParam(req, "id");
  const event = await prisma.event.findFirst({
    where: {
      id,
      organiserId: user.id
    }
  });
  if (!event) {
    throw new HttpError(404, "Event not found");
  }

  res.json({ event });
};

export const updateEvent = async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const id = getRouteParam(req, "id");
  const existing = await prisma.event.findFirst({
    where: {
      id,
      organiserId: user.id
    }
  });
  if (!existing) {
    throw new HttpError(404, "Event not found");
  }

  const event = await prisma.event.update({
    where: { id },
    data: req.body
  });

  res.json({ event });
};

export const deleteEvent = async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const id = getRouteParam(req, "id");
  const existing = await prisma.event.findFirst({
    where: {
      id,
      organiserId: user.id
    }
  });
  if (!existing) {
    throw new HttpError(404, "Event not found");
  }

  await prisma.event.delete({
    where: { id }
  });

  res.status(204).send();
};
