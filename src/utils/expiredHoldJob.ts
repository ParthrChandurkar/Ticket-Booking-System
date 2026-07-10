import cron from "node-cron";
import { prisma } from "../config/prisma";

export const releaseExpiredHolds = async () => {
  // TODO before final submission: this cron and the manual release handler both write ShowSeat.
  // Re-check once waitlist reassignment exists; the blind expiry update must not clobber
  // a newly reassigned hold in the same window.
  const updatedCount = await prisma.$executeRaw`
    UPDATE "ShowSeat"
    SET status = 'AVAILABLE'::"SeatStatus",
        "heldBy" = NULL,
        "heldUntil" = NULL
    WHERE status = 'HELD'::"SeatStatus"
      AND "heldUntil" < NOW()
  `;

  console.log(`Expired hold cleanup released ${updatedCount} seat(s).`);
  return updatedCount;
};

export const startExpiredHoldJob = () =>
  cron.schedule("*/5 * * * * *", () => {
    releaseExpiredHolds().catch((error) => {
      console.error("Expired hold cleanup failed", error);
    });
  });
