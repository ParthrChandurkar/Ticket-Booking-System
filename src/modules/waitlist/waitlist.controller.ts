import { SeatStatus, WaitlistStatus } from "@prisma/client";
import { Request, Response } from "express";
import { prisma } from "../../config/prisma";
import { getAuthUser } from "../../utils/getAuthUser";
import { getRouteParam } from "../../utils/getRouteParam";
import { HttpError } from "../../utils/httpError";
import { createConfirmedBookingFromHeldSeats } from "../bookings/booking.service";
import { sendBookingConfirmationEmail } from "../bookings/bookingEmail.service";

export const joinWaitlist = async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const { showId, category } = req.body;

  const availableSeat = await prisma.showSeat.findFirst({
    where: {
      showId,
      status: SeatStatus.AVAILABLE,
      seatLayout: { category }
    }
  });
  if (availableSeat) {
    throw new HttpError(409, "Category is not sold out");
  }

  const show = await prisma.show.findUnique({ where: { id: showId } });
  if (!show) {
    throw new HttpError(404, "Show not found");
  }

  const existingCategorySeat = await prisma.showSeat.findFirst({
    where: {
      showId,
      seatLayout: { category }
    }
  });
  if (!existingCategorySeat) {
    throw new HttpError(404, "Category not found for this show");
  }

  const waitlistEntry = await prisma.$transaction(async (tx) => {
    const maxPosition = await tx.waitlist.aggregate({
      where: { showId, category },
      _max: { position: true }
    });

    return tx.waitlist.create({
      data: {
        customerId: user.id,
        showId,
        category,
        position: (maxPosition._max.position ?? 0) + 1
      }
    });
  });

  res.status(201).json({ waitlist: waitlistEntry });
};

export const acceptWaitlistOffer = async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const waitlistId = getRouteParam(req, "id");

  const waitlistEntry = await prisma.waitlist.findUnique({
    where: { id: waitlistId }
  });
  if (!waitlistEntry) {
    throw new HttpError(404, "Waitlist entry not found");
  }

  if (waitlistEntry.customerId !== user.id) {
    throw new HttpError(403, "Forbidden");
  }

  if (
    waitlistEntry.status !== WaitlistStatus.OFFERED ||
    !waitlistEntry.offeredSeatId ||
    !waitlistEntry.offerExpiresAt
  ) {
    throw new HttpError(409, "Waitlist offer is not available");
  }

  if (waitlistEntry.offerExpiresAt <= new Date()) {
    throw new HttpError(410, "Waitlist offer has expired");
  }

  const booking = await createConfirmedBookingFromHeldSeats(waitlistEntry.customerId, [
    waitlistEntry.offeredSeatId
  ]);

  await prisma.waitlist.update({
    where: { id: waitlistEntry.id },
    data: { status: WaitlistStatus.FULFILLED }
  });

  const emailResult = await sendBookingConfirmationEmail(booking.id);

  res.status(201).json({ booking, emailFailed: !emailResult });
};
