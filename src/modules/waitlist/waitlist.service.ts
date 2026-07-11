import { Prisma, SeatStatus, WaitlistStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { sendWaitlistOfferEmail } from "./waitlistEmail.service";

export const checkWaitlistForShow = async (showId: string, category: string) => {
  const offer = await prisma.$transaction(
    async (tx) => {
      const waitingEntry = await tx.waitlist.findFirst({
      where: {
        showId,
        category,
        status: WaitlistStatus.WAITING
      },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }]
    });

    if (!waitingEntry) {
      return null;
    }

    const availableSeat = await tx.showSeat.findFirst({
      where: {
        showId,
        status: SeatStatus.AVAILABLE,
        seatLayout: { category }
      },
      include: { seatLayout: true },
      orderBy: [
        { seatLayout: { rowLabel: "asc" } },
        { seatLayout: { seatNumber: "asc" } }
      ]
    });

    if (!availableSeat) {
      return null;
    }

    const updatedSeats = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      UPDATE "ShowSeat"
      SET status = 'HELD'::"SeatStatus",
          "heldBy" = ${waitingEntry.customerId},
          "heldUntil" = NOW() + interval '30 minutes'
      WHERE id = ${availableSeat.id}
        AND "showId" = ${showId}
        AND status = 'AVAILABLE'::"SeatStatus"
      RETURNING id, "heldUntil"
    `);

    if (updatedSeats.length === 0) {
      return null;
    }

    const offerExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const updatedWaitlist = await tx.waitlist.update({
      where: { id: waitingEntry.id },
      data: {
        status: WaitlistStatus.OFFERED,
        offeredSeatId: availableSeat.id,
        offerExpiresAt
      }
    });

      return updatedWaitlist;
    },
    {
      maxWait: 10000,
      timeout: 20000
    }
  );

  if (offer) {
    await sendWaitlistOfferEmail(offer.id);
  }

  return offer;
};
