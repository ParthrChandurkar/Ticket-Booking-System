import { Request, Response } from "express";
import { prisma } from "../../config/prisma";
import { getAuthUser } from "../../utils/getAuthUser";
import { getRouteParam } from "../../utils/getRouteParam";
import { HttpError } from "../../utils/httpError";

export const createVenue = async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const venue = await prisma.venue.create({
    data: {
      name: req.body.name,
      address: req.body.address,
      createdBy: user.id
    }
  });

  res.status(201).json({ venue });
};

export const listVenues = async (_req: Request, res: Response) => {
  const venues = await prisma.venue.findMany({
    orderBy: { createdAt: "desc" }
  });

  res.json({ venues });
};

export const getVenue = async (req: Request, res: Response) => {
  const id = getRouteParam(req, "id");
  const venue = await prisma.venue.findUnique({
    where: { id }
  });
  if (!venue) {
    throw new HttpError(404, "Venue not found");
  }

  res.json({ venue });
};

export const updateVenue = async (req: Request, res: Response) => {
  const id = getRouteParam(req, "id");
  const existing = await prisma.venue.findUnique({
    where: { id }
  });
  if (!existing) {
    throw new HttpError(404, "Venue not found");
  }

  const venue = await prisma.venue.update({
    where: { id },
    data: req.body
  });

  res.json({ venue });
};

export const deleteVenue = async (req: Request, res: Response) => {
  const id = getRouteParam(req, "id");
  const existing = await prisma.venue.findUnique({
    where: { id }
  });
  if (!existing) {
    throw new HttpError(404, "Venue not found");
  }

  await prisma.venue.delete({
    where: { id }
  });

  res.status(204).send();
};
