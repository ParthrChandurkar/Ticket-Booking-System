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
