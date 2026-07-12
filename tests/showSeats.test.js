const jwt = require("jsonwebtoken");
const request = require("supertest");
const { app } = require("../dist/src/app");
const { cleanDatabase, prisma } = require("./testDb");

jest.setTimeout(90000);

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

const futureDateIso = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

const setupShowWithSeat = async () => {
  const organiser = await prisma.user.create({
    data: {
      name: "Show Organiser",
      email: `organiser.${Date.now()}@example.com`,
      passwordHash: "hash",
      role: "ORGANISER"
    }
  });

  const venue = await prisma.venue.create({
    data: {
      name: "Concurrency Hall",
      address: "123 Test Lane",
      createdBy: organiser.id
    }
  });

  await prisma.seatLayout.create({
    data: {
      venueId: venue.id,
      rowLabel: "A",
      seatNumber: 1,
      category: "STANDARD"
    }
  });

  const event = await prisma.event.create({
    data: {
      organiserId: organiser.id,
      venueId: venue.id,
      title: "Atomic Seat Test",
      description: "Verifies one winner for a seat hold."
    }
  });

  const showResponse = await request(app)
    .post(`/events/${event.id}/shows`)
    .set("Authorization", `Bearer ${accessToken(organiser)}`)
    .send({
      date: futureDateIso(),
      time: "19:30",
      categoryPrices: [{ category: "STANDARD", price: 25 }]
    });

  expect(showResponse.status).toBe(201);

  const showSeat = await prisma.showSeat.findFirstOrThrow({
    where: { showId: showResponse.body.show.id }
  });

  return {
    showId: showResponse.body.show.id,
    seatId: showSeat.id
  };
};

beforeAll(() => {
  expect(process.env.NODE_ENV).toBe("test");
  expect(process.env.TEST_DATABASE_URL).toBeTruthy();
  expect(process.env.DATABASE_URL).toBe(process.env.TEST_DATABASE_URL);
});

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe("show seats", () => {
  test("show creation generates available seats and public seat map returns them", async () => {
    const { showId } = await setupShowWithSeat();

    const response = await request(app).get(`/shows/${showId}/seats`);

    expect(response.status).toBe(200);
    expect(response.body.seats).toHaveLength(1);
    expect(response.body.seats[0]).toMatchObject({
      showId,
      rowLabel: "A",
      seatNumber: 1,
      category: "STANDARD",
      status: "AVAILABLE"
    });
  });

  test("only one of 10 simultaneous users can hold the same available seat", async () => {
    const { showId, seatId } = await setupShowWithSeat();

    const tokens = Array.from({ length: 10 }, (_, index) =>
      accessToken({
        id: `fake-customer-${index}`,
        email: `fake-customer-${index}@example.com`,
        role: "CUSTOMER"
      })
    );

    const responses = await Promise.all(
      tokens.map((token) =>
        request(app)
          .post(`/shows/${showId}/seats/${seatId}/hold`)
          .set("Authorization", `Bearer ${token}`)
          .send()
      )
    );

    const successCount = responses.filter((response) => response.status === 200).length;
    const conflictCount = responses.filter((response) => response.status === 409).length;

    expect(successCount).toBe(1);
    expect(conflictCount).toBe(9);

    const seat = await prisma.showSeat.findUniqueOrThrow({
      where: { id: seatId }
    });

    expect(seat.status).toBe("HELD");
    expect(seat.heldBy).toMatch(/^fake-customer-/);
    expect(seat.heldUntil).toBeInstanceOf(Date);
  });

  test("admin and organiser users cannot hold customer seats", async () => {
    const { showId, seatId } = await setupShowWithSeat();

    const adminToken = accessToken({
      id: "admin-cannot-hold",
      email: "admin-cannot-hold@example.com",
      role: "ADMIN"
    });
    const organiserToken = accessToken({
      id: "organiser-cannot-hold",
      email: "organiser-cannot-hold@example.com",
      role: "ORGANISER"
    });

    const adminResponse = await request(app)
      .post(`/shows/${showId}/seats/${seatId}/hold`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send();
    const organiserResponse = await request(app)
      .post(`/shows/${showId}/seats/${seatId}/hold`)
      .set("Authorization", `Bearer ${organiserToken}`)
      .send();

    expect(adminResponse.status).toBe(403);
    expect(organiserResponse.status).toBe(403);

    const seat = await prisma.showSeat.findUniqueOrThrow({
      where: { id: seatId }
    });
    expect(seat.status).toBe("AVAILABLE");
    expect(seat.heldBy).toBeNull();
  });
});
