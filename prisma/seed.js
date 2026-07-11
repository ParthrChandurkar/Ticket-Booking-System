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

const main = async () => {
  const email = process.env.DEFAULT_ADMIN_EMAIL ?? "admin@seatflow.dev";
  const password = process.env.DEFAULT_ADMIN_PASSWORD;

  if (!password) {
    throw new Error("DEFAULT_ADMIN_PASSWORD is required to seed the default admin account.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
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

  console.log(`Default admin account ready: ${email}`);
};

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
