const request = require("supertest");
const { app } = require("../dist/src/app");
const { cleanDatabase, prisma } = require("./testDb");

jest.setTimeout(90000);

const uniqueEmail = (prefix) => `${prefix}.${Date.now()}.${Math.random()}@example.com`;

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

describe("auth", () => {
  test("register creates a user with a bcrypt password hash", async () => {
    const email = uniqueEmail("register");

    const response = await request(app).post("/auth/register").send({
      name: "Test Customer",
      email,
      password: "password123"
    });

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe(email);
    expect(response.body.user.role).toBe("CUSTOMER");
    expect(response.body.user.passwordHash).toBeUndefined();

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
    expect(user.passwordHash).not.toBe("password123");
    expect(user.passwordHash.startsWith("$2")).toBe(true);
  });

  test("public register ignores submitted role and always creates a customer", async () => {
    const email = uniqueEmail("role-ignore");

    const response = await request(app).post("/auth/register").send({
      name: "Role Escalation Attempt",
      email,
      password: "password123",
      role: "ADMIN"
    });

    expect(response.status).toBe(201);
    expect(response.body.user.role).toBe("CUSTOMER");

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user.role).toBe("CUSTOMER");
  });

  test("organiser registration requires the shared signup code", async () => {
    const email = uniqueEmail("organiser");

    const forbidden = await request(app).post("/auth/register-organiser").send({
      name: "No Code Organiser",
      email,
      password: "password123",
      organiserSignupCode: "wrong-code"
    });
    expect(forbidden.status).toBe(403);

    const response = await request(app).post("/auth/register-organiser").send({
      name: "Invited Organiser",
      email,
      password: "password123",
      organiserSignupCode: process.env.ORGANISER_SIGNUP_CODE
    });

    expect(response.status).toBe(201);
    expect(response.body.user.role).toBe("ORGANISER");
  });

  test("login returns access and refresh tokens", async () => {
    const email = uniqueEmail("login");

    await request(app).post("/auth/register").send({
      name: "Login Customer",
      email,
      password: "password123"
    });

    const response = await request(app).post("/auth/login").send({
      email,
      password: "password123"
    });

    expect(response.status).toBe(200);
    expect(typeof response.body.accessToken).toBe("string");
    expect(typeof response.body.refreshToken).toBe("string");
    expect(response.body.user.email).toBe(email);
  });

  test("admin venue endpoint returns 403 for a customer", async () => {
    const email = uniqueEmail("forbidden");

    await request(app).post("/auth/register").send({
      name: "Wrong Role",
      email,
      password: "password123"
    });

    const loginResponse = await request(app).post("/auth/login").send({
      email,
      password: "password123"
    });

    const response = await request(app)
      .post("/venues")
      .set("Authorization", `Bearer ${loginResponse.body.accessToken}`)
      .send({
        name: "Grand Hall",
        address: "123 Main Street"
      });

    expect(response.status).toBe(403);
  });
});
