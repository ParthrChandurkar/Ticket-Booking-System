import { BookingStatus } from "@prisma/client";
import { Request, Response } from "express";
import { prisma } from "../../config/prisma";
import { getAuthUser } from "../../utils/getAuthUser";
import { getRouteParam } from "../../utils/getRouteParam";
import { HttpError } from "../../utils/httpError";

export const listOrganiserVenues = async (_req: Request, res: Response) => {
  const venues = await prisma.venue.findMany({
    orderBy: { createdAt: "desc" }
  });

  res.json({ venues });
};

export const getEventRevenueSummary = async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const eventId = getRouteParam(req, "id");
  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      organiserId: user.id
    },
    include: { shows: true }
  });
  if (!event) {
    throw new HttpError(404, "Event not found");
  }

  const showIds = event.shows.map((show) => show.id);
  const bookings = await prisma.booking.findMany({
    where: {
      showId: { in: showIds },
      status: BookingStatus.CONFIRMED
    },
    include: { seats: true }
  });

  const revenueByShow = event.shows.map((show) => {
    const showBookings = bookings.filter((booking) => booking.showId === show.id);
    return {
      showId: show.id,
      date: show.date,
      time: show.time,
      confirmedBookings: showBookings.length,
      seatsSold: showBookings.reduce((sum, booking) => sum + booking.seats.length, 0),
      revenue: showBookings.reduce((sum, booking) => sum + booking.totalPrice, 0)
    };
  });

  res.json({
    event: {
      id: event.id,
      title: event.title
    },
    totalRevenue: bookings.reduce((sum, booking) => sum + booking.totalPrice, 0),
    totalBookings: bookings.length,
    shows: revenueByShow
  });
};
