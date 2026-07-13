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
- If Neon DNS prefers IPv6 on a local machine, use a network that supports IPv6 or configure the connection to use a reachable IPv4 route before testing.

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
