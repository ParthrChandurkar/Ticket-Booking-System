import { BookingStatus, SeatStatus } from "@prisma/client";
import { Request, Response } from "express";
import { prisma } from "../../config/prisma";
import { getAuthUser } from "../../utils/getAuthUser";
import { getRouteParam } from "../../utils/getRouteParam";
import { HttpError } from "../../utils/httpError";
import { sendBookingConfirmationEmail } from "./bookingEmail.service";
import { createConfirmedBookingFromHeldSeats } from "./booking.service";
import { checkWaitlistForShow } from "../waitlist/waitlist.service";

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

  const booking = await createConfirmedBookingFromHeldSeats(user.id, showSeatIds);

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

  res.json({ message: "Confirmation email resent", emailFailed: false });
};

export const cancelBooking = async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const bookingId = getRouteParam(req, "id");

  const result = await prisma.$transaction(
    async (tx) => {
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
    },
    {
      maxWait: 10000,
      timeout: 20000
    }
  );

  await Promise.all(
    result.categories.map((category) => checkWaitlistForShow(result.booking.showId, category))
  );

  res.json({ booking: result.booking });
};
