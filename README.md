# Ticket-Booking-System

SeatFlow is a full-stack ticket booking system for movies and concerts. Customers can browse events, choose shows, hold seats from a live seat map, confirm bookings, receive QR-based tickets, and join a waitlist when a category is sold out.

## Tech Stack

- Frontend: React, Vite, TypeScript, React Query, Zustand, Zod
- Backend: Node.js, Express, TypeScript, Prisma
- Database: PostgreSQL
- Auth: JWT access/refresh tokens with bcrypt password hashing
- Email and tickets: Resend plus base64 QR codes from `qrcode`
- Tests: Jest and Supertest

## Local Setup

Install backend dependencies from the repository root:

```bash
npm install
```

Install frontend dependencies:

```bash
cd frontend
npm install
```

Generate Prisma client and build the backend:

```bash
npm run build
```

Run the backend from the repository root:

```bash
npm start
```

Run the frontend in a separate terminal:

```bash
cd frontend
npm run dev
```

By default, the backend listens on `http://localhost:4000` and the frontend runs on `http://127.0.0.1:5173`.

## Environment Variables

Create a `.env` file in the repository root for backend configuration:

```env
DATABASE_URL=
TEST_DATABASE_URL=
JWT_SECRET=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
DEFAULT_ADMIN_EMAIL=admin@seatflow.dev
DEFAULT_ADMIN_PASSWORD=
ORGANISER_SIGNUP_CODE=
```

The frontend can be pointed at a backend URL with `VITE_API_URL`. If it is not set, the app uses `http://localhost:4000`.

```env
VITE_API_URL=http://localhost:4000
```

## Main User Flows

### Admin

- Seed or sign in with the default admin account.
- Create venues.
- Generate seat layouts for each venue.

### Organiser

- Register through the organiser signup endpoint using `ORGANISER_SIGNUP_CODE`.
- Create events and shows.
- Set per-category prices for each show.
- View revenue summaries.

### Customer

- Register through the public signup form.
- Browse events and select a show.
- Hold available seats from the seat map.
- Confirm checkout to create a booking and QR ticket.
- View booking history, resend confirmation, and cancel confirmed bookings.

### Waitlist

When a category is sold out, customers can join the waitlist from the seat map. If a booked seat is cancelled, the next waiting customer receives a time-limited offer and can accept it from the `My Waitlist` page.

## Testing

Run the backend test suite from the repository root:

```bash
npm test
```

Tests use `TEST_DATABASE_URL`, not the main database URL. Keep the test database separate so automated cleanup never touches production or demo data.

## Deployment Notes

- Frontend target: Vercel
- Backend target: Render
- Database target: Neon PostgreSQL
- The backend requires all environment variables listed above in the hosting dashboard.
- The frontend requires `VITE_API_URL` to point at the deployed backend URL.

## Known Issues

### Neon IPv6 / Prisma Connection Timeout

During local browser testing, Prisma intermittently failed with `Can't reach database server` even though the Neon database was available. The local DNS lookup for the Neon hostname returned both IPv6 and IPv4 addresses, but this machine/network could not reach Neon's IPv6 address on port `5432`. Prisma's query engine attempted that unreachable IPv6 route and timed out before trying a working IPv4 route.

This was not fixed in Prisma schema or application code. The local workaround was to run the backend with a `DATABASE_URL` that pinned the host to a reachable Neon IPv4 address and added Neon's endpoint routing option:

```env
DATABASE_URL=postgresql://USER:PASSWORD@<reachable-neon-ipv4>/DB?sslmode=require&channel_binding=require&options=endpoint%3D<neon-endpoint-id>
```

The `options=endpoint%3D...` value is required when connecting by IP address because Neon normally uses the hostname/SNI to route the connection to the correct compute endpoint.

For Render deployment, first try the normal Neon hostname connection string from the Neon dashboard. Render services use documented outbound IP ranges, and the issue may not occur there. If Render logs show the same Prisma `Can't reach database server` error and the Neon hostname resolves to an unreachable IPv6 route, use the IPv4-plus-endpoint form above as the backend `DATABASE_URL`, or use a deployment/network configuration with working outbound IPv6.

## Default Admin Access

The default admin account is seeded directly into the database, not created through public signup.

- Email: `admin@seatflow.dev`
- Password: set locally in `DEFAULT_ADMIN_PASSWORD`

Run:

```bash
npm run prisma:seed
```

Public registration always creates `CUSTOMER` users. Organiser registration uses the separate `/auth/register-organiser` endpoint and requires `ORGANISER_SIGNUP_CODE`.

## Milestone 6 Checklist

- Configure a production-ready Resend sender before final demo. The current development sender, `onboarding@resend.dev`, is sandbox-limited and may only deliver to the Resend account email. Either verify a real sending domain or clearly document Resend testing mode as a known deployment limitation.
