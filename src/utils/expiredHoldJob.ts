import cron from "node-cron";
import { prisma } from "../config/prisma";

export const releaseExpiredHolds = async () => {
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
