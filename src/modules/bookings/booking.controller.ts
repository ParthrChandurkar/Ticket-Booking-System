import { BookingStatus, Prisma, SeatStatus } from "@prisma/client";
import { randomUUID } from "crypto";
import { Request, Response } from "express";
import { prisma } from "../../config/prisma";
import { getAuthUser } from "../../utils/getAuthUser";
import { getRouteParam } from "../../utils/getRouteParam";
import { HttpError } from "../../utils/httpError";
import { sendBookingConfirmationEmail } from "./bookingEmail.service";
import { checkWaitlistForShow } from "./waitlist.stub";

const uniqueValues = (values: string[]) => Array.from(new Set(values));

const getOwnedBooking = async (bookingId: string, customerId: string) => {
  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      customerId
    },
    include: { seats: true }
  });

  if (!booking) {
    throw new HttpError(404, "Booking not found");
  }

  return booking;
};

export const createBooking = async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const showSeatIds = uniqueValues(req.body.showSeatIds);
  let emailFailed = false;

  const booking = await prisma.$transaction(async (tx) => {
    const seats = await tx.showSeat.findMany({
      where: { id: { in: showSeatIds } },
      include: { seatLayout: true }
    });

    if (seats.length !== showSeatIds.length) {
      throw new HttpError(409, "One or more seats are not available for booking");
    }

    const showIds = uniqueValues(seats.map((seat) => seat.showId));
    if (showIds.length !== 1) {
      throw new HttpError(409, "All seats must belong to the same show");
    }

    const now = new Date();
    const expiredSeat = seats.find(
      (seat) =>
        seat.status === SeatStatus.HELD &&
        seat.heldBy === user.id &&
        seat.heldUntil !== null &&
        seat.heldUntil <= now
    );
    if (expiredSeat) {
      throw new HttpError(410, "Seat hold has expired");
    }

    const invalidSeat = seats.find(
      (seat) =>
        seat.status !== SeatStatus.HELD ||
        seat.heldBy !== user.id ||
        seat.heldUntil === null ||
        seat.heldUntil <= now
    );
    if (invalidSeat) {
      throw new HttpError(409, "One or more seats are not held by this user");
    }

    const categories = uniqueValues(seats.map((seat) => seat.seatLayout.category));
    const pricing = await tx.showSeatPricing.findMany({
      where: {
        showId: showIds[0],
        category: { in: categories }
      }
    });

    if (pricing.length !== categories.length) {
      throw new HttpError(409, "One or more seats are missing category pricing");
    }

    const priceByCategory = new Map(
      pricing.map((price) => [price.category, price.price] as const)
    );
    const totalPrice = seats.reduce((sum, seat) => {
      const price = priceByCategory.get(seat.seatLayout.category);
      if (price === undefined) {
        throw new HttpError(409, "One or more seats are missing category pricing");
      }

      return sum + price;
    }, 0);

    const updatedSeats = await tx.showSeat.updateMany({
      where: {
        id: { in: showSeatIds },
        status: SeatStatus.HELD,
        heldBy: user.id,
        heldUntil: { gt: now }
      },
      data: {
        status: SeatStatus.BOOKED,
        heldBy: null,
        heldUntil: null
      }
    });

    if (updatedSeats.count !== showSeatIds.length) {
      throw new HttpError(409, "One or more seats could not be booked");
    }

    return tx.booking.create({
      data: {
        customerId: user.id,
        showId: showIds[0],
        bookingReference: randomUUID(),
        totalPrice,
        seats: {
          create: showSeatIds.map((showSeatId) => ({
            showSeatId
          }))
        }
      },
      include: { seats: true }
    });
  });

  const emailResult = await sendBookingConfirmationEmail(booking.id);
  if (!emailResult) {
    emailFailed = true;
  }

  res.status(201).json({ booking, emailFailed });
};

export const listBookings = async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const bookings = await prisma.booking.findMany({
    where: { customerId: user.id },
    include: { seats: true },
    orderBy: { createdAt: "desc" }
  });

  res.json({ bookings });
};

export const resendConfirmation = async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const bookingId = getRouteParam(req, "id");
  const booking = await getOwnedBooking(bookingId, user.id);

  const emailResult = await sendBookingConfirmationEmail(booking.id);
  if (!emailResult) {
    throw new HttpError(502, "Confirmation email could not be resent");
  }

  res.json({ message: "Confirmation email resent" });
};

export const cancelBooking = async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const bookingId = getRouteParam(req, "id");

  const result = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findFirst({
      where: {
        id: bookingId,
        customerId: user.id
      },
      include: { seats: true }
    });

    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    if (booking.status === BookingStatus.CANCELLED) {
      return { booking, categories: [] as string[] };
    }

    const showSeatIds = booking.seats.map((seat) => seat.showSeatId);
    const showSeats = await tx.showSeat.findMany({
      where: { id: { in: showSeatIds } },
      include: { seatLayout: true }
    });

    await tx.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.CANCELLED }
    });

    await tx.showSeat.updateMany({
      where: {
        id: { in: showSeatIds },
        status: SeatStatus.BOOKED
      },
      data: {
        status: SeatStatus.AVAILABLE,
        heldBy: null,
        heldUntil: null
      }
    });

    return {
      booking: {
        ...booking,
        status: BookingStatus.CANCELLED
      },
      categories: uniqueValues(showSeats.map((seat) => seat.seatLayout.category))
    };
  });

  await Promise.all(
    result.categories.map((category) => checkWaitlistForShow(result.booking.showId, category))
  );

  res.json({ booking: result.booking });
};
