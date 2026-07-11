const { prisma } = require("../dist/src/config/prisma");

const truncateSql =
  'TRUNCATE TABLE "Waitlist", "BookingSeat", "Booking", "ShowSeatPricing", "ShowSeat", "Show", "Event", "SeatLayout", "Venue", "User" RESTART IDENTITY CASCADE';

const sleep = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const withTimeout = (promise, milliseconds) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Database cleanup timed out after ${milliseconds}ms`)),
      milliseconds
    );

    promise
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });

const cleanDatabase = async () => {
  let lastError;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      await withTimeout(prisma.$executeRawUnsafe(truncateSql), 15000);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 5) {
        await sleep(attempt * 1000);
      }
    }
  }

  throw lastError;
};

module.exports = {
  cleanDatabase,
  prisma
};
