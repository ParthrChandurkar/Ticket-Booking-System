# SeatFlow - Ticket Booking System

- **Live demo:** [https://seatflow-ticket-booking-tawny.vercel.app](https://seatflow-ticket-booking-tawny.vercel.app)
- **GitHub repo:** [https://github.com/ParthrChandurkar/Ticket-Booking-System](https://github.com/ParthrChandurkar/Ticket-Booking-System)

![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-Full%20Stack-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Prisma-4169E1?logo=postgresql&logoColor=white)
![React](https://img.shields.io/badge/React-Vite-61DAFB?logo=react&logoColor=111)

## 🎟️ Overview

SeatFlow is a full-stack movie and concert ticket booking system with live seat maps, timed seat holds, waitlists, booking confirmation emails, and QR tickets. The core engineering focus is correctness: two customers must never be able to hold or book the same seat at the same time.

The app includes customer booking flows, organiser controls for events and revenue, and admin supervision for venues and seat layouts.

## 🔐 Demo Access

Use these accounts on the live demo:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@seatflow.dev` | `NOlIQAO17mYel1O4fviQMsuL` |
| Organiser | `organiser@seatflow.dev` | `SeatFlowDemo123` |
| User | `Create User` | `Assign Your Own Password` |

Organiser signup code for creating another organiser account:

```txt
Kzr6mwAcCtxFSfJcamdy5g
```

Customer accounts can be created from the public signup screen.

## 🏗️ Tech Stack

- **Frontend:** React, Vite, TypeScript, React Query, Zustand, Zod
- **Backend:** Node.js, Express, TypeScript
- **Database:** PostgreSQL on Neon
- **ORM:** Prisma
- **Auth:** JWT access/refresh tokens, bcrypt password hashing, role-based middleware
- **Email and tickets:** Resend, `qrcode`
- **Testing:** Jest, Supertest
- **Deployment:** Vercel frontend, Render backend, Neon PostgreSQL

## ✨ Key Features

- Public landing page and event browsing
- Event detail pages with show selection
- Visual seat map with 4-second polling updates
- Seat states: `AVAILABLE`, `HELD`, `BOOKED`
- 10-minute customer hold TTL with cron-based expiry
- Atomic conditional SQL updates for concurrency-safe holds
- Booking confirmation from held seats only
- QR ticket generation and email delivery
- Waitlist queue for sold-out categories
- 30-minute waitlist offer window with cascading expiry
- Customer booking history, resend confirmation, and cancellation
- Admin venue creation, venue supervision, and seat-layout generation
- Organiser event/show controls, revenue summary, and seat inventory overview

## 🚀 Getting Started

Clone and install dependencies:

```bash
git clone https://github.com/ParthrChandurkar/Ticket-Booking-System.git
cd Ticket-Booking-System
npm install
cd frontend
npm install
cd ..
```

Create environment files:

```bash
copy .env.example .env
copy frontend\.env.example frontend\.env
```

Run migrations and seed demo data:

```bash
npx prisma migrate dev
npm run prisma:seed
```

Build and start the backend:

```bash
npm run build
npm start
```

Start the frontend in another terminal:

```bash
cd frontend
npm run dev
```

Defaults:

- Backend: `http://localhost:4000`
- Frontend: `http://127.0.0.1:5173`
- Frontend API env: `VITE_API_URL=http://localhost:4000`

## 📚 API Documentation

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | Health check |
| `POST` | `/auth/register` | Public | Register customer account |
| `POST` | `/auth/register-organiser` | Shared code | Register organiser account |
| `POST` | `/auth/login` | Public | Login and receive access/refresh tokens |
| `POST` | `/auth/refresh` | Public | Refresh access token |
| `GET` | `/events/public` | Public | List public events |
| `GET` | `/events/public/:id` | Public | Get event detail with shows and pricing |
| `POST` | `/events` | Organiser | Create event |
| `GET` | `/events` | Organiser | List organiser events |
| `GET` | `/events/:id` | Organiser | Get organiser-owned event |
| `PUT` | `/events/:id` | Organiser | Update organiser-owned event |
| `DELETE` | `/events/:id` | Organiser | Delete organiser-owned event |
| `POST` | `/events/:eventId/shows` | Organiser | Create show and generate show seats |
| `GET` | `/organiser/venues` | Organiser | List venues available to organisers |
| `GET` | `/organiser/events/:id/summary` | Organiser | Revenue and seats-sold summary |
| `POST` | `/venues` | Admin | Create venue |
| `GET` | `/venues` | Admin | List venues |
| `GET` | `/venues/:id` | Admin | Get venue detail with seat layouts |
| `PUT` | `/venues/:id` | Admin | Update venue |
| `DELETE` | `/venues/:id` | Admin | Delete venue |
| `POST` | `/venues/:id/seat-layouts` | Admin | Create seat-layout rows |
| `GET` | `/shows/:showId/seats` | Public, optional auth | Get seat map; auth adds `isHeldByMe` |
| `POST` | `/shows/:showId/seats/:seatId/hold` | Customer | Hold an available seat |
| `DELETE` | `/shows/:showId/seats/:seatId/hold` | Customer | Release current customer's hold |
| `POST` | `/bookings` | Customer | Confirm booking from held seats |
| `GET` | `/bookings` | Customer | List booking history |
| `GET` | `/bookings/:id/resend-confirmation` | Customer | Resend QR confirmation email |
| `DELETE` | `/bookings/:id` | Customer | Cancel booking and release seats |
| `GET` | `/waitlist` | Customer | List waitlist entries |
| `POST` | `/waitlist` | Customer | Join waitlist for sold-out show/category |
| `GET` | `/waitlist/:id/accept` | Customer | Accept active waitlist offer |

## 🗄️ Database Schema

The Prisma schema is defined in [prisma/schema.prisma](prisma/schema.prisma). Major models include:

- `User`
- `Venue`
- `SeatLayout`
- `Event`
- `Show`
- `ShowSeat`
- `ShowSeatPricing`
- `Booking`
- `BookingSeat`
- `Waitlist`

Migrations live in [prisma/migrations](prisma/migrations), and demo seed data lives in [prisma/seed.js](prisma/seed.js).

## ⏱️ Seat Holds and TTL

Seat holding uses an atomic conditional SQL update. A seat can move from `AVAILABLE` to `HELD` only if the database row is still available at update time. This prevents the classic read-then-write race where two customers select the same seat together.

Expired holds are released by a `node-cron` job every 5 seconds. Regular customer hold expiry and waitlist offer expiry are handled as separate operations so waitlist-held seats are not accidentally clobbered by the normal hold cleanup.

## 🧾 Waitlist Logic

Customers can join the waitlist only when a show/category has no available seats. When a booking is cancelled, the freed seat is offered to the lowest-position waiting customer and held for that customer for 30 minutes.

If the offer expires, the cron job marks the waitlist row `EXPIRED`, releases the seat, and cascades the offer to the next waiting customer. Additional notes are in [docs/design.md](docs/design.md).

## 📩 Email + QR Verification

Booking confirmation email delivery has been verified in Gmail using Resend's sandbox sender. A live demo booking for **Parallel Lines: Indie Night** was delivered to `parthrchn27@gmail.com` with the subject `Booking confirmed: Parallel Lines: Indie Night`.

The email rendered the booking details, show time, total amount, selected seat, booking reference, and inline QR ticket successfully. Verified sample:

- Booking reference: `c075587a-396b-4ff8-a59b-38fa5c2c9b97`
- Seat: `Row A, Seat 1 (PREMIUM)`
- Total paid: `₹900.00`

## ✅ Testing

The backend test suite currently contains **22 Jest/Supertest tests across 5 suites**.

Coverage includes:

- Auth and role restrictions
- Input validation failures
- Concurrency-safe seat holding
- Booking confirmation and cancellation
- Email failure retry behavior
- Waitlist offer expiry and cascade behavior

Run tests from the repository root:

```bash
npm test
```

Tests require `TEST_DATABASE_URL` and refuse to run when `TEST_DATABASE_URL` matches `DATABASE_URL`, protecting the real/demo database from automated cleanup.

## 🌐 Deployment

- **Frontend:** Vercel
- **Backend:** Render
- **Database:** Neon PostgreSQL

Production deployment uses `prisma migrate deploy` followed by the seed script. The backend requires:

```txt
DATABASE_URL
JWT_SECRET
RESEND_API_KEY
RESEND_FROM_EMAIL
DEMO_EMAIL_RECIPIENT
DEFAULT_ADMIN_EMAIL
DEFAULT_ADMIN_PASSWORD
ORGANISER_SIGNUP_CODE
CORS_ORIGIN
```

The frontend requires:

```txt
VITE_API_URL
```

## ⚠️ Known Limitations

- Resend is running with the sandbox sender `onboarding@resend.dev`. For the assignment demo, booking and waitlist emails are intentionally routed to `DEMO_EMAIL_RECIPIENT` (`parthrchn27@gmail.com`). Production use would require a verified Resend sending domain and delivery to each customer's real email.
- There is no real payment gateway integration. Checkout confirms already-held seats and creates a booking record.
- Render free-tier services can cold start after inactivity, so the first backend request may be slower.
- Seat-map updates use polling by design, not WebSockets or SSE.
