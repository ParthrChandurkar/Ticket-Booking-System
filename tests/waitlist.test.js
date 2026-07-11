const jwt = require("jsonwebtoken");
const request = require("supertest");
const { PrismaClient } = require("@prisma/client");

const mockSend = jest.fn(async () => ({
  data: { id: "email-id" },
  error: null
}));

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: mockSend
    }
  }))
}));

jest.mock("../dist/src/utils/sleep", () => ({
  sleep: jest.fn(async () => undefined)
}));

const { app } = require("../dist/src/app");
const { releaseExpiredHolds } = require("../dist/src/utils/expiredHoldJob");

const prisma = new PrismaClient();

jest.setTimeout(90000);

const cleanDatabase = async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Waitlist", "BookingSeat", "Booking", "ShowSeatPricing", "ShowSeat", "Show", "Event", "SeatLayout", "Venue", "User" RESTART IDENTITY CASCADE'
  );
};

const accessToken = (user) =>
  jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: "access"
    },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );

const createUserSession = async (role, prefix) => {
  const email = `${prefix}.${Date.now()}.${Math.random()}@example.com`;
  const user = await prisma.user.create({
    data: {
      name: `${role} User`,
      email,
      passwordHash: "test-hash",
      role
    }
  });

  return {
    token: accessToken(user),
    user
  };
};

const createBookedSoldOutShow = async () => {
  const admin = await createUserSession("ADMIN", "waitlist-admin");
  const organiser = await createUserSession("ORGANISER", "waitlist-organiser");
  const originalCustomer = await createUserSession("CUSTOMER", "waitlist-buyer");

  const venueResponse = await request(app)
    .post("/venues")
    .set("Authorization", `Bearer ${admin.token}`)
    .send({
      name: "Waitlist Hall",
      address: "42 Queue Street"
    });
  expect(venueResponse.status).toBe(201);

  await prisma.seatLayout.create({
    data: {
      venueId: venueResponse.body.venue.id,
      rowLabel: "A",
      seatNumber: 1,
      category: "STANDARD"
    }
  });

  const eventResponse = await request(app)
    .post("/events")
    .set("Authorization", `Bearer ${organiser.token}`)
    .send({
      venueId: venueResponse.body.venue.id,
      title: "Sold Out Event",
      description: "A test event for waitlist cascading"
    });
  expect(eventResponse.status).toBe(201);

  const showResponse = await request(app)
    .post(`/events/${eventResponse.body.event.id}/shows`)
    .set("Authorization", `Bearer ${organiser.token}`)
    .send({
      date: "2026-10-01T00:00:00.000Z",
      time: "18:00",
      categoryPrices: [{ category: "STANDARD", price: 30 }]
    });
  expect(showResponse.status).toBe(201);

  const showSeat = await prisma.showSeat.findFirstOrThrow({
    where: { showId: showResponse.body.show.id }
  });

  await prisma.showSeat.update({
    where: { id: showSeat.id },
    data: {
      status: "HELD",
      heldBy: originalCustomer.user.id,
      heldUntil: new Date(Date.now() + 600_000)
    }
  });

  const bookingResponse = await request(app)
    .post("/bookings")
    .set("Authorization", `Bearer ${originalCustomer.token}`)
    .send({
      showSeatIds: [showSeat.id]
    });
  expect(bookingResponse.status).toBe(201);

  return {
    originalCustomer,
    bookingId: bookingResponse.body.booking.id,
    showId: showResponse.body.show.id,
    showSeatId: showSeat.id
  };
};

beforeAll(() => {
  expect(process.env.NODE_ENV).toBe("test");
  expect(process.env.TEST_DATABASE_URL).toBeTruthy();
  expect(process.env.DATABASE_URL).toBe(process.env.TEST_DATABASE_URL);
});

beforeEach(async () => {
  mockSend.mockClear();
  mockSend.mockResolvedValue({
    data: { id: "email-id" },
    error: null
  });
  await cleanDatabase();
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe("waitlist", () => {
  test("cancellation offers freed seat to first waitlisted customer and cron expiry cascades to the next", async () => {
    const { originalCustomer, bookingId, showId, showSeatId } = await createBookedSoldOutShow();
    const firstWaitlisted = await createUserSession("CUSTOMER", "waitlist-first");
    const secondWaitlisted = await createUserSession("CUSTOMER", "waitlist-second");

    const firstJoinResponse = await request(app)
      .post("/waitlist")
      .set("Authorization", `Bearer ${firstWaitlisted.token}`)
      .send({ showId, category: "STANDARD" });
    expect(firstJoinResponse.status).toBe(201);
    expect(firstJoinResponse.body.waitlist.position).toBe(1);

    const secondJoinResponse = await request(app)
      .post("/waitlist")
      .set("Authorization", `Bearer ${secondWaitlisted.token}`)
      .send({ showId, category: "STANDARD" });
    expect(secondJoinResponse.status).toBe(201);
    expect(secondJoinResponse.body.waitlist.position).toBe(2);

    const cancelResponse = await request(app)
      .delete(`/bookings/${bookingId}`)
      .set("Authorization", `Bearer ${originalCustomer.token}`)
      .send();
    expect(cancelResponse.status).toBe(200);

    const firstOffer = await prisma.waitlist.findUniqueOrThrow({
      where: { id: firstJoinResponse.body.waitlist.id }
    });
    expect(firstOffer.status).toBe("OFFERED");
    expect(firstOffer.offeredSeatId).toBe(showSeatId);
    expect(firstOffer.offerExpiresAt).toBeInstanceOf(Date);

    const heldForFirst = await prisma.showSeat.findUniqueOrThrow({
      where: { id: showSeatId }
    });
    expect(heldForFirst.status).toBe("HELD");
    expect(heldForFirst.heldBy).toBe(firstWaitlisted.user.id);

    await prisma.waitlist.update({
      where: { id: firstOffer.id },
      data: { offerExpiresAt: new Date(Date.now() - 60_000) }
    });

    await releaseExpiredHolds();

    const expiredFirst = await prisma.waitlist.findUniqueOrThrow({
      where: { id: firstJoinResponse.body.waitlist.id }
    });
    expect(expiredFirst.status).toBe("EXPIRED");

    const secondOffer = await prisma.waitlist.findUniqueOrThrow({
      where: { id: secondJoinResponse.body.waitlist.id }
    });
    expect(secondOffer.status).toBe("OFFERED");
    expect(secondOffer.offeredSeatId).toBe(showSeatId);
    expect(secondOffer.offerExpiresAt).toBeInstanceOf(Date);

    const heldForSecond = await prisma.showSeat.findUniqueOrThrow({
      where: { id: showSeatId }
    });
    expect(heldForSecond.status).toBe("HELD");
    expect(heldForSecond.heldBy).toBe(secondWaitlisted.user.id);
  });
});
