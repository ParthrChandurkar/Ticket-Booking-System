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
