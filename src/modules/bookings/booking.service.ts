import { SeatStatus } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "../../config/prisma";
import { HttpError } from "../../utils/httpError";

const uniqueValues = (values: string[]) => Array.from(new Set(values));

export const createConfirmedBookingFromHeldSeats = async (
  customerId: string,
  requestedShowSeatIds: string[]
) => {
  const showSeatIds = uniqueValues(requestedShowSeatIds);

  return prisma.$transaction(
    async (tx) => {
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
          seat.heldBy === customerId &&
          seat.heldUntil !== null &&
          seat.heldUntil <= now
      );
      if (expiredSeat) {
        throw new HttpError(410, "Seat hold has expired");
      }

      const invalidSeat = seats.find(
        (seat) =>
          seat.status !== SeatStatus.HELD ||
          seat.heldBy !== customerId ||
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
          heldBy: customerId,
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
          customerId,
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
    },
    {
      maxWait: 10000,
      timeout: 20000
    }
  );
};
