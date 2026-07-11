import cron from "node-cron";
import { WaitlistStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { checkWaitlistForShow } from "../modules/waitlist/waitlist.service";

const releaseExpiredWaitlistOffers = async () => {
  const expiredOffers = await prisma.waitlist.findMany({
    where: {
      status: WaitlistStatus.OFFERED,
      offerExpiresAt: { lt: new Date() },
      offeredSeatId: { not: null }
    },
    orderBy: [{ offerExpiresAt: "asc" }, { position: "asc" }]
  });

  let expiredCount = 0;

  for (const offer of expiredOffers) {
    const expired = await prisma.$transaction(async (tx) => {
      const updatedWaitlist = await tx.waitlist.updateMany({
        where: {
          id: offer.id,
          status: WaitlistStatus.OFFERED,
          offerExpiresAt: { lt: new Date() }
        },
        data: {
          status: WaitlistStatus.EXPIRED
        }
      });

      if (updatedWaitlist.count === 0 || !offer.offeredSeatId) {
        return false;
      }

      await tx.showSeat.updateMany({
        where: {
          id: offer.offeredSeatId,
          status: "HELD",
          heldBy: offer.customerId
        },
        data: {
          status: "AVAILABLE",
          heldBy: null,
          heldUntil: null
        }
      });

      return true;
    });

    if (expired) {
      expiredCount += 1;
      await checkWaitlistForShow(offer.showId, offer.category);
    }
  }

  return expiredCount;
};

export const releaseExpiredHolds = async () => {
  const expiredWaitlistOffers = await releaseExpiredWaitlistOffers();

  const updatedCount = await prisma.$executeRaw`
    UPDATE "ShowSeat"
    SET status = 'AVAILABLE'::"SeatStatus",
        "heldBy" = NULL,
        "heldUntil" = NULL
    WHERE status = 'HELD'::"SeatStatus"
      AND "heldUntil" < NOW()
      AND id NOT IN (
        SELECT "offeredSeatId"
        FROM "Waitlist"
        WHERE status = 'OFFERED'::"WaitlistStatus"
          AND "offeredSeatId" IS NOT NULL
      )
  `;

  console.log(
    `Expired hold cleanup released ${updatedCount} regular seat(s) and expired ${expiredWaitlistOffers} waitlist offer(s).`
  );
  return updatedCount + expiredWaitlistOffers;
};

export const startExpiredHoldJob = () =>
  cron.schedule("*/5 * * * * *", () => {
    releaseExpiredHolds().catch((error) => {
      console.error("Expired hold cleanup failed", error);
    });
  });
