const request = require("supertest");
const jwt = require("jsonwebtoken");

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
const { cleanDatabase, prisma } = require("./testDb");

jest.setTimeout(90000);

const registerAndLogin = async (role, prefix) => {
  const email = `${prefix}.${Date.now()}.${Math.random()}@example.com`;
  if (role !== "CUSTOMER") {
    const user = await prisma.user.create({
      data: {
        name: `${role} User`,
        email,
        passwordHash: "test-hash",
        role
      }
    });

    return {
      token: jwt.sign(
        {
          sub: user.id,
          email: user.email,
          role: user.role,
          type: "access"
        },
        process.env.JWT_SECRET,
        { expiresIn: "15m" }
      ),
      user
    };
  }

  await request(app).post("/auth/register").send({
    name: `${role} User`,
    email,
    password: "password123"
  });

  const loginResponse = await request(app).post("/auth/login").send({
    email,
    password: "password123"
  });

  expect(loginResponse.status).toBe(200);
  return {
    token: loginResponse.body.accessToken,
    user: loginResponse.body.user
  };
};

const createShowWithHeldSeats = async ({
  expired = false,
  seats = [{ rowLabel: "A", seatNumber: 1, category: "STANDARD" }],
  categoryPrices = [{ category: "STANDARD", price: 25 }]
} = {}) => {
  const admin = await registerAndLogin("ADMIN", "booking-admin");
  const organiser = await registerAndLogin("ORGANISER", "booking-organiser");
  const customer = await registerAndLogin("CUSTOMER", "booking-customer");

  const venueResponse = await request(app)
    .post("/venues")
    .set("Authorization", `Bearer ${admin.token}`)
    .send({
      name: "Booking Hall",
      address: "1 Confirmation Road"
    });
  expect(venueResponse.status).toBe(201);

  const seatLayouts = await Promise.all(
    seats.map((seat) =>
      prisma.seatLayout.create({
        data: {
          venueId: venueResponse.body.venue.id,
          rowLabel: seat.rowLabel,
          seatNumber: seat.seatNumber,
          category: seat.category
        }
      })
    )
  );

  const eventResponse = await request(app)
    .post("/events")
    .set("Authorization", `Bearer ${organiser.token}`)
    .send({
      venueId: venueResponse.body.venue.id,
      title: "Booking Event",
      description: "A test booking event"
    });
  expect(eventResponse.status).toBe(201);

  const showResponse = await request(app)
    .post(`/events/${eventResponse.body.event.id}/shows`)
    .set("Authorization", `Bearer ${organiser.token}`)
    .send({
      date: "2026-09-01T00:00:00.000Z",
      time: "20:00",
      categoryPrices
    });
  expect(showResponse.status).toBe(201);

  const showSeats = await Promise.all(
    seatLayouts.map((seatLayout) =>
      prisma.showSeat.findFirstOrThrow({
        where: {
          showId: showResponse.body.show.id,
          seatLayoutId: seatLayout.id
        }
      })
    )
  );

  const holdUntil = new Date(Date.now() + (expired ? -60_000 : 600_000));
  await Promise.all(
    showSeats.map((showSeat) =>
      prisma.showSeat.update({
        where: { id: showSeat.id },
        data: {
          status: "HELD",
          heldBy: customer.user.id,
          heldUntil: holdUntil
        }
      })
    )
  );

  return {
    customer,
    showId: showResponse.body.show.id,
    showSeatId: showSeats[0].id,
    showSeatIds: showSeats.map((showSeat) => showSeat.id)
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

describe("bookings", () => {
  test("creates a booking from a valid hold, books the seat, and sends confirmation email", async () => {
    const { customer, showSeatId } = await createShowWithHeldSeats();

    const response = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({
        showSeatIds: [showSeatId]
      });

    expect(response.status).toBe(201);
    expect(response.body.booking.status).toBe("CONFIRMED");
    expect(response.body.booking.bookingReference).toEqual(expect.any(String));
    expect(response.body.booking.seats).toHaveLength(1);
    expect(response.body.emailFailed).toBe(false);

    const seat = await prisma.showSeat.findUniqueOrThrow({
      where: { id: showSeatId }
    });
    expect(seat.status).toBe("BOOKED");
    expect(seat.heldBy).toBeNull();
    expect(seat.heldUntil).toBeNull();

    expect(mockSend).toHaveBeenCalledTimes(1);
    const emailPayload = mockSend.mock.calls[0][0];
    expect(emailPayload.html).toContain(response.body.booking.bookingReference);
    expect(emailPayload.html).toContain("data:image/png;base64,");
  });

  test("calculates totalPrice from per-category show pricing", async () => {
    const { customer, showSeatIds } = await createShowWithHeldSeats({
      seats: [
        { rowLabel: "A", seatNumber: 1, category: "STANDARD" },
        { rowLabel: "A", seatNumber: 2, category: "PREMIUM" }
      ],
      categoryPrices: [
        { category: "STANDARD", price: 20 },
        { category: "PREMIUM", price: 55.5 }
      ]
    });

    const response = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({
        showSeatIds
      });

    expect(response.status).toBe(201);
    expect(response.body.booking.status).toBe("CONFIRMED");
    expect(response.body.booking.totalPrice).toBe(75.5);
    expect(response.body.booking.seats).toHaveLength(2);

    const bookedSeats = await prisma.showSeat.findMany({
      where: { id: { in: showSeatIds } }
    });
    expect(bookedSeats).toHaveLength(2);
    bookedSeats.forEach((seat) => {
      expect(seat.status).toBe("BOOKED");
      expect(seat.heldBy).toBeNull();
      expect(seat.heldUntil).toBeNull();
    });
  });

  test("returns 410 when a held seat has expired and does not create a booking", async () => {
    const { customer, showSeatId } = await createShowWithHeldSeats({ expired: true });

    const response = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({
        showSeatIds: [showSeatId]
      });

    expect(response.status).toBe(410);

    const bookings = await prisma.booking.findMany();
    expect(bookings).toHaveLength(0);

    const seat = await prisma.showSeat.findUniqueOrThrow({
      where: { id: showSeatId }
    });
    expect(seat.status).toBe("HELD");
    expect(mockSend).not.toHaveBeenCalled();
  });

  test("cancels a booking and flips booked seats back to available", async () => {
    const { customer, showSeatId } = await createShowWithHeldSeats();

    const bookingResponse = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({
        showSeatIds: [showSeatId]
      });
    expect(bookingResponse.status).toBe(201);

    const cancelResponse = await request(app)
      .delete(`/bookings/${bookingResponse.body.booking.id}`)
      .set("Authorization", `Bearer ${customer.token}`)
      .send();

    expect(cancelResponse.status).toBe(200);
    expect(cancelResponse.body.booking.status).toBe("CANCELLED");

    const seat = await prisma.showSeat.findUniqueOrThrow({
      where: { id: showSeatId }
    });
    expect(seat.status).toBe("AVAILABLE");
    expect(seat.heldBy).toBeNull();
    expect(seat.heldUntil).toBeNull();
  });

  test("keeps booking confirmed when confirmation email fails after 3 retry attempts", async () => {
    mockSend.mockRejectedValue(new Error("Resend unavailable"));
    const { customer, showSeatId } = await createShowWithHeldSeats();

    const response = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({
        showSeatIds: [showSeatId]
      });

    expect(response.status).toBe(201);
    expect(response.body.booking.status).toBe("CONFIRMED");
    expect(response.body.emailFailed).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(3);

    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: response.body.booking.id }
    });

    expect(booking.status).toBe("CONFIRMED");
  });
});
