import { Prisma } from "@prisma/client";
import { Request, Response } from "express";
import { prisma } from "../../config/prisma";
import { getAuthUser } from "../../utils/getAuthUser";
import { getRouteParam } from "../../utils/getRouteParam";
import { HttpError } from "../../utils/httpError";

const getSeatOrThrow = async (showId: string, seatId: string) => {
  const seat = await prisma.showSeat.findFirst({
    where: {
      id: seatId,
      showId
    },
    include: {
      seatLayout: true
    }
  });

  if (!seat) {
    throw new HttpError(404, "Seat not found");
  }

  return seat;
};

export const createShow = async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const eventId = getRouteParam(req, "eventId");

  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      organiserId: user.id
    }
  });
  if (!event) {
    throw new HttpError(404, "Event not found");
  }

  const show = await prisma.$transaction(
    async (tx) => {
      const createdShow = await tx.show.create({
        data: {
          eventId,
          date: req.body.date,
          time: req.body.time
        }
      });

      const seatLayouts = await tx.seatLayout.findMany({
        where: { venueId: event.venueId },
        select: { id: true }
      });

      if (seatLayouts.length > 0) {
        await tx.showSeat.createMany({
          data: seatLayouts.map((seatLayout) => ({
            showId: createdShow.id,
            seatLayoutId: seatLayout.id
          }))
        });
      }

      if (req.body.categoryPrices?.length) {
        await tx.showSeatPricing.createMany({
          data: req.body.categoryPrices.map((price: { category: string; price: number }) => ({
            showId: createdShow.id,
            category: price.category,
            price: price.price
          }))
        });
      }

      return createdShow;
    },
    {
      maxWait: 10000,
      timeout: 20000
    }
  );

  res.status(201).json({ show });
};

export const listShowSeats = async (req: Request, res: Response) => {
  const showId = getRouteParam(req, "showId");
  const show = await prisma.show.findUnique({
    where: { id: showId }
  });
  if (!show) {
    throw new HttpError(404, "Show not found");
  }

  const seats = await prisma.showSeat.findMany({
    where: { showId },
    include: {
      seatLayout: true
    },
    orderBy: [
      { seatLayout: { rowLabel: "asc" } },
      { seatLayout: { seatNumber: "asc" } }
    ]
  });
  const pricing = await prisma.showSeatPricing.findMany({
    where: { showId }
  });
  const priceByCategory = new Map(pricing.map((price) => [price.category, price.price]));

  res.json({
    seats: seats.map((seat) => ({
      id: seat.id,
      showId: seat.showId,
      seatLayoutId: seat.seatLayoutId,
      status: seat.status,
      heldBy: seat.heldBy,
      heldUntil: seat.heldUntil,
      rowLabel: seat.seatLayout.rowLabel,
      seatNumber: seat.seatLayout.seatNumber,
      category: seat.seatLayout.category,
      price: priceByCategory.get(seat.seatLayout.category) ?? 0
    }))
  });
};

export const holdSeat = async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const showId = getRouteParam(req, "showId");
  const seatId = getRouteParam(req, "seatId");

  const updatedRows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    UPDATE "ShowSeat"
    SET status = 'HELD'::"SeatStatus",
        "heldBy" = ${user.id},
        "heldUntil" = NOW() + interval '10 minutes'
    WHERE id = ${seatId}
      AND "showId" = ${showId}
      AND status = 'AVAILABLE'::"SeatStatus"
    RETURNING id
  `);

  if (updatedRows.length === 0) {
    throw new HttpError(409, "Seat is already held or booked");
  }

  const seat = await getSeatOrThrow(showId, seatId);
  res.json({ seat });
};

export const releaseSeatHold = async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const showId = getRouteParam(req, "showId");
  const seatId = getRouteParam(req, "seatId");

  // TODO before final submission: release and expiry are independent writers on ShowSeat.
  // Re-check this once waitlist reassignment exists so both paths remain idempotent
  // and conditional enough to avoid clobbering a newly reassigned hold.
  const updatedRows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    UPDATE "ShowSeat"
    SET status = 'AVAILABLE'::"SeatStatus",
        "heldBy" = NULL,
        "heldUntil" = NULL
    WHERE id = ${seatId}
      AND "showId" = ${showId}
      AND status = 'HELD'::"SeatStatus"
      AND "heldBy" = ${user.id}
    RETURNING id
  `);

  if (updatedRows.length === 0) {
    throw new HttpError(404, "Seat is not held by this user");
  }

  const seat = await getSeatOrThrow(showId, seatId);
  res.json({ seat });
};
