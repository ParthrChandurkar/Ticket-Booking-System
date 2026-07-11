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

const createUserSession = async (role, prefix) => {
  const user = await prisma.user.create({
    data: {
      name: `${role} User`,
      email: `${prefix}.${Date.now()}.${Math.random()}@example.com`,
      passwordHash: "test-hash",
      role
    }
  });

  return {
    token: accessToken(user),
    user
  };
};

const expectValidationError = (response, field) => {
  expect(response.status).toBe(400);
  expect(response.body.message).toBe("Validation failed");
  expect(response.body.errors).toBeDefined();
  if (field) {
    expect(response.body.errors[field]).toBeDefined();
  }
};

const futureDateIso = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
const pastDateIso = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

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

describe("request body validation", () => {
  test("auth endpoints reject blank or weak request bodies with validation errors", async () => {
    expectValidationError(
      await request(app).post("/auth/register").send({
        name: "   ",
        email: "not-an-email",
        password: "short"
      }),
      "name"
    );

    expectValidationError(
      await request(app).post("/auth/register-organiser").send({
        name: "Invited Organiser",
        email: "organiser@example.com",
        password: "weakpass",
        organiserSignupCode: "   "
      }),
      "password"
    );

    expectValidationError(
      await request(app).post("/auth/login").send({
        email: "bad-email",
        password: ""
      }),
      "email"
    );

    expectValidationError(
      await request(app).post("/auth/refresh").send({
        refreshToken: "   "
      }),
      "refreshToken"
    );
  });

  test("venue endpoints reject blank venue fields and invalid seat-layout batches", async () => {
    const admin = await createUserSession("ADMIN", "validation-admin");

    expectValidationError(
      await request(app)
        .post("/venues")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ name: "   ", address: "" }),
      "name"
    );

    const venue = await prisma.venue.create({
      data: {
        name: "Validation Hall",
        address: "12 Test Street",
        createdBy: admin.user.id
      }
    });

    expectValidationError(
      await request(app)
        .put(`/venues/${venue.id}`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ address: "   " }),
      "address"
    );

    const invalidSeatBatch = await request(app)
      .post(`/venues/${venue.id}/seat-layouts`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        seats: [
          { rowLabel: "A", seatNumber: 1, category: "STANDARD" },
          { rowLabel: "   ", seatNumber: 0, category: "" }
        ]
      });

    expectValidationError(invalidSeatBatch, "seats");
    const seats = await prisma.seatLayout.findMany({ where: { venueId: venue.id } });
    expect(seats).toHaveLength(0);
  });

  test("event and show endpoints reject blank fields, invalid times, past dates, and incomplete pricing", async () => {
    const admin = await createUserSession("ADMIN", "validation-admin");
    const organiser = await createUserSession("ORGANISER", "validation-organiser");

    const venue = await prisma.venue.create({
      data: {
        name: "Show Validation Hall",
        address: "99 Category Road",
        createdBy: admin.user.id
      }
    });
    await prisma.seatLayout.createMany({
      data: [
        { venueId: venue.id, rowLabel: "A", seatNumber: 1, category: "STANDARD" },
        { venueId: venue.id, rowLabel: "B", seatNumber: 1, category: "PREMIUM" }
      ]
    });

    expectValidationError(
      await request(app)
        .post("/events")
        .set("Authorization", `Bearer ${organiser.token}`)
        .send({ venueId: venue.id, title: "   ", description: "" }),
      "title"
    );

    const event = await prisma.event.create({
      data: {
        organiserId: organiser.user.id,
        venueId: venue.id,
        title: "Validation Event",
        description: "Used for show validation"
      }
    });

    expectValidationError(
      await request(app)
        .put(`/events/${event.id}`)
        .set("Authorization", `Bearer ${organiser.token}`)
        .send({ description: "   " }),
      "description"
    );

    expectValidationError(
      await request(app)
        .post(`/events/${event.id}/shows`)
        .set("Authorization", `Bearer ${organiser.token}`)
        .send({
          date: pastDateIso(),
          time: "99:99",
          categoryPrices: [{ category: "STANDARD", price: 0 }]
        }),
      "date"
    );

    expectValidationError(
      await request(app)
        .post(`/events/${event.id}/shows`)
        .set("Authorization", `Bearer ${organiser.token}`)
        .send({
          date: futureDateIso(),
          time: "19:30",
          categoryPrices: [{ category: "STANDARD", price: 25 }]
        }),
      "categoryPrices"
    );

    const shows = await prisma.show.findMany({ where: { eventId: event.id } });
    expect(shows).toHaveLength(0);
  });

  test("booking and waitlist endpoints reject invalid request bodies with validation errors", async () => {
    const customer = await createUserSession("CUSTOMER", "validation-customer");

    expectValidationError(
      await request(app)
        .post("/bookings")
        .set("Authorization", `Bearer ${customer.token}`)
        .send({ showSeatIds: [] }),
      "showSeatIds"
    );

    expectValidationError(
      await request(app)
        .post("/bookings")
        .set("Authorization", `Bearer ${customer.token}`)
        .send({ showSeatIds: ["not-a-uuid"] }),
      "showSeatIds"
    );

    expectValidationError(
      await request(app)
        .post("/waitlist")
        .set("Authorization", `Bearer ${customer.token}`)
        .send({ showId: "not-a-uuid", category: "   " }),
      "showId"
    );
  });
});
