-- CreateEnum
CREATE TYPE "SeatStatus" AS ENUM ('AVAILABLE', 'HELD', 'BOOKED');

-- CreateTable
CREATE TABLE "ShowSeat" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "seatLayoutId" TEXT NOT NULL,
    "status" "SeatStatus" NOT NULL DEFAULT 'AVAILABLE',
    "heldBy" TEXT,
    "heldUntil" TIMESTAMP(3),

    CONSTRAINT "ShowSeat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShowSeat_showId_seatLayoutId_key" ON "ShowSeat"("showId", "seatLayoutId");

-- AddForeignKey
ALTER TABLE "ShowSeat" ADD CONSTRAINT "ShowSeat_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowSeat" ADD CONSTRAINT "ShowSeat_seatLayoutId_fkey" FOREIGN KEY ("seatLayoutId") REFERENCES "SeatLayout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
