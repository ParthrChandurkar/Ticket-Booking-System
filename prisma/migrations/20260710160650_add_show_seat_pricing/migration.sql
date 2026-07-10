-- CreateTable
CREATE TABLE "ShowSeatPricing" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ShowSeatPricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShowSeatPricing_showId_category_key" ON "ShowSeatPricing"("showId", "category");

-- AddForeignKey
ALTER TABLE "ShowSeatPricing" ADD CONSTRAINT "ShowSeatPricing_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
