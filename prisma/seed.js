const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");
const { PrismaClient, Role } = require("@prisma/client");

const envPath = path.resolve(process.cwd(), ".env");

if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!match || line.trim().startsWith("#")) {
      continue;
    }

    let value = match[2] ?? "";
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = process.env[match[1]] ?? value;
  }
}

const prisma = new PrismaClient();

const demoOrganiserEmail = "organiser@seatflow.dev";
const demoOrganiserPassword = process.env.DEMO_ORGANISER_PASSWORD ?? "SeatFlowDemo123";

const demoVenues = [
  {
    name: "PVR Icon Phoenix Palladium, Mumbai",
    address: "Phoenix Palladium, Lower Parel, Mumbai",
    rows: ["A", "B", "C", "D", "E", "F"],
    seatsPerRow: 10,
    categoryForRow: (row) => (["E", "F"].includes(row) ? "PREMIUM" : "STANDARD")
  },
  {
    name: "INOX Garuda Swagath Mall, Bengaluru",
    address: "Jayanagar, Bengaluru",
    rows: ["A", "B", "C", "D", "E"],
    seatsPerRow: 12,
    categoryForRow: (row) => (["D", "E"].includes(row) ? "PREMIUM" : "STANDARD")
  },
  {
    name: "Jio World Garden, Mumbai",
    address: "Bandra Kurla Complex, Mumbai",
    rows: ["A", "B", "C", "D", "E", "F", "G", "H"],
    seatsPerRow: 16,
    categoryForRow: (row) => {
      if (["A", "B"].includes(row)) return "PLATINUM";
      if (["C", "D", "E"].includes(row)) return "GOLD";
      return "SILVER";
    }
  }
];

const futureDate = (daysFromNow) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(0, 0, 0, 0);
  return date;
};

const demoEvents = [
  {
    venueName: "PVR Icon Phoenix Palladium, Mumbai",
    title: "Skyline Dreams",
    description: "A big-screen Hindi drama about ambition, family, and second chances in modern Mumbai.",
    shows: [
      {
        date: futureDate(5),
        time: "18:30",
        pricing: [
          { category: "STANDARD", price: 320 },
          { category: "PREMIUM", price: 650 }
        ]
      },
      {
        date: futureDate(6),
        time: "21:15",
        pricing: [
          { category: "STANDARD", price: 380 },
          { category: "PREMIUM", price: 750 }
        ]
      }
    ]
  },
  {
    venueName: "INOX Garuda Swagath Mall, Bengaluru",
    title: "Midnight Metro",
    description: "A stylish thriller set across Bengaluru's late-night metro routes and hidden city stories.",
    shows: [
      {
        date: futureDate(7),
        time: "17:45",
        pricing: [
          { category: "STANDARD", price: 280 },
          { category: "PREMIUM", price: 600 }
        ]
      },
      {
        date: futureDate(8),
        time: "20:30",
        pricing: [
          { category: "STANDARD", price: 340 },
          { category: "PREMIUM", price: 700 }
        ]
      }
    ]
  },
  {
    venueName: "Jio World Garden, Mumbai",
    title: "Armaan Malik Live: Monsoon Sessions",
    description: "An open-air concert evening featuring contemporary Hindi pop, acoustic sets, and fan favourites.",
    shows: [
      {
        date: futureDate(12),
        time: "19:00",
        pricing: [
          { category: "SILVER", price: 799 },
          { category: "GOLD", price: 1499 },
          { category: "PLATINUM", price: 2499 }
        ]
      }
    ]
  }
];

const resetDemoCatalog = async () => {
  await prisma.waitlist.deleteMany();
  await prisma.bookingSeat.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.showSeatPricing.deleteMany();
  await prisma.showSeat.deleteMany();
  await prisma.show.deleteMany();
  await prisma.event.deleteMany();
  await prisma.seatLayout.deleteMany();
  await prisma.venue.deleteMany();
};

const createSeatLayouts = async (venueId, venue) => {
  await prisma.seatLayout.createMany({
    data: venue.rows.flatMap((rowLabel) =>
      Array.from({ length: venue.seatsPerRow }, (_, index) => ({
        venueId,
        rowLabel,
        seatNumber: index + 1,
        category: venue.categoryForRow(rowLabel)
      }))
    )
  });
};

const createShowSeats = async (showId, venueId) => {
  const layouts = await prisma.seatLayout.findMany({
    where: { venueId },
    select: { id: true }
  });

  await prisma.showSeat.createMany({
    data: layouts.map((layout) => ({
      showId,
      seatLayoutId: layout.id
    }))
  });
};

const seedDemoCatalog = async (adminId, organiserId) => {
  const venueByName = new Map();

  for (const venue of demoVenues) {
    const createdVenue = await prisma.venue.create({
      data: {
        name: venue.name,
        address: venue.address,
        createdBy: adminId
      }
    });
    await createSeatLayouts(createdVenue.id, venue);
    venueByName.set(venue.name, createdVenue);
  }

  for (const event of demoEvents) {
    const venue = venueByName.get(event.venueName);
    if (!venue) {
      throw new Error(`Missing demo venue: ${event.venueName}`);
    }

    const createdEvent = await prisma.event.create({
      data: {
        organiserId,
        venueId: venue.id,
        title: event.title,
        description: event.description
      }
    });

    for (const show of event.shows) {
      const createdShow = await prisma.show.create({
        data: {
          eventId: createdEvent.id,
          date: show.date,
          time: show.time
        }
      });

      await createShowSeats(createdShow.id, venue.id);
      await prisma.showSeatPricing.createMany({
        data: show.pricing.map((price) => ({
          showId: createdShow.id,
          category: price.category,
          price: price.price
        }))
      });
    }
  }
};

const main = async () => {
  const email = process.env.DEFAULT_ADMIN_EMAIL ?? "admin@seatflow.dev";
  const password = process.env.DEFAULT_ADMIN_PASSWORD;

  if (!password) {
    throw new Error("DEFAULT_ADMIN_PASSWORD is required to seed the default admin account.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      name: "SeatFlow Admin",
      passwordHash,
      role: Role.ADMIN
    },
    create: {
      name: "SeatFlow Admin",
      email,
      passwordHash,
      role: Role.ADMIN
    }
  });

  const demoPasswordHash = await bcrypt.hash(demoOrganiserPassword, 12);
  const organiser = await prisma.user.upsert({
    where: { email: demoOrganiserEmail },
    update: {
      name: "SeatFlow Demo Organiser",
      passwordHash: demoPasswordHash,
      role: Role.ORGANISER
    },
    create: {
      name: "SeatFlow Demo Organiser",
      email: demoOrganiserEmail,
      passwordHash: demoPasswordHash,
      role: Role.ORGANISER
    }
  });

  if (process.env.RESET_DEMO_CATALOG === "true") {
    await resetDemoCatalog();
  }

  const existingDemoEvents = await prisma.event.count({
    where: { organiserId: organiser.id }
  });
  if (existingDemoEvents === 0) {
    await seedDemoCatalog(admin.id, organiser.id);
  }

  console.log(`Default admin account ready: ${email}`);
  console.log(`Demo organiser account ready: ${demoOrganiserEmail}`);
};

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
