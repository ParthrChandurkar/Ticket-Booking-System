# SeatFlow - Ticket Booking System

- **Live demo:** [https://seatflow-ticket-booking-tawny.vercel.app](https://seatflow-ticket-booking-tawny.vercel.app)
- **GitHub repo:** [https://github.com/ParthrChandurkar/Ticket-Booking-System](https://github.com/ParthrChandurkar/Ticket-Booking-System)

![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-Backend%20%2B%20Frontend-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Prisma-4169E1?logo=postgresql&logoColor=white)
![React](https://img.shields.io/badge/React-Vite-61DAFB?logo=react&logoColor=111)

## 🎟️ Overview

SeatFlow is a full-stack ticket booking system for movies and concerts. Customers can browse events, choose a show, hold seats from a visual seat map, confirm bookings, receive QR-based email tickets, and join a waitlist when a category is sold out. The backend focuses on correctness around seat state transitions, especially preventing two customers from holding or booking the same seat.

## 🏗️ Tech Stack

- Frontend: React, Vite, TypeScript, React Query, Zustand, Zod
- Backend: Node.js, Express, TypeScript
- ORM and database: Prisma with PostgreSQL
- Auth: JWT access/refresh tokens, bcrypt password hashing, role-based middleware
- Email and QR: Resend, `qrcode`
- Tests: Jest and Supertest
- Deployment: Vercel frontend, Render backend, Neon PostgreSQL

## ✨ Key Features

- Public event browsing with event detail and show selection
- Visual seat map with frontend polling every 4 seconds
- Seat states: `AVAILABLE`, `HELD`, `BOOKED`
- 10-minute seat hold TTL with cron-based auto-release
- Concurrency-safe seat holds using atomic conditional SQL updates
- Customer-only booking flow with total pricing from show/category pricing
- Waitlist join, auto-assignment on cancellation, 30-minute offer expiry, and cascading offers
- QR ticket generation and Resend confirmation email delivery
- Role-based access for `ADMIN`, `ORGANISER`, and `CUSTOMER`
- Admin venue and seat-layout management
- Organiser event/show creation and revenue summary

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

Create environment files from the examples:

```bash
copy .env.example .env
copy frontend\.env.example frontend\.env
```

Update `.env` with your PostgreSQL, JWT, Resend, admin seed, and organiser signup values. Then run migrations and seed demo data:

```bash
npx prisma migrate dev
npm run prisma:seed
```

Build and start the backend:

```bash
npm run build
npm start
```

In a second terminal, start the frontend:

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
| `POST` | `/auth/register` | Public | Register a customer account |
| `POST` | `/auth/register-organiser` | Shared organiser code | Register an organiser account |
| `POST` | `/auth/login` | Public | Login and receive access/refresh tokens |
| `POST` | `/auth/refresh` | Public | Refresh access token |
| `GET` | `/events/public` | Public | List public events, optional search |
| `GET` | `/events/public/:id` | Public | Get public event detail with shows and pricing |
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
| `GET` | `/venues/:id` | Admin | Get venue detail |
| `PUT` | `/venues/:id` | Admin | Update venue |
| `DELETE` | `/venues/:id` | Admin | Delete venue |
| `POST` | `/venues/:id/seat-layouts` | Admin | Create venue seat-layout rows |
| `GET` | `/shows/:showId/seats` | Public, optional auth | Get seat map; authenticated customers receive `isHeldByMe` |
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

The Prisma schema is defined in [prisma/schema.prisma](prisma/schema.prisma). Major models include `User`, `Venue`, `SeatLayout`, `Event`, `Show`, `ShowSeat`, `ShowSeatPricing`, `Booking`, `BookingSeat`, and `Waitlist`.

Migrations live in [prisma/migrations](prisma/migrations), and demo seed data is in [prisma/seed.js](prisma/seed.js).

## ⏱️ Seat Holds and TTL

Seat holding uses an atomic conditional database update: a seat can move from `AVAILABLE` to `HELD` only when the SQL `WHERE` condition still sees it as available. If 10 customers try to hold the same seat at once, only one update can affect the row; the rest receive a conflict response.

Expired holds are handled by a single cron job that runs every 5 seconds. It releases regular expired customer holds and separately processes expired waitlist offers, keeping those two flows distinct so a waitlist-held seat is not accidentally treated like a normal customer hold.

## 🧾 Waitlist Logic

Customers can join a waitlist only when a show/category has no available seats. On booking cancellation, the freed seat is offered to the lowest-position waiting customer, held for that customer for 30 minutes, and linked to the waitlist entry as `OFFERED`.

If the offer expires, the cron job marks it `EXPIRED`, releases the seat, and cascades the offer to the next waiting customer. Additional design notes are in [docs/design.md](docs/design.md).

## ⚠️ Known Limitations

- Email is sent through Resend's sandbox sender, `onboarding@resend.dev`. For the assignment demo, all booking and waitlist emails are routed to `DEMO_EMAIL_RECIPIENT` (`parthrchn27@gmail.com`) because Resend sandbox delivery only works for the verified account email. Production use would require verifying a custom sending domain with Resend and sending to each customer email.
- There is no real payment gateway integration. Checkout confirms seats already held by the customer and creates a booking record.
- Render free-tier services may cold start after inactivity, so the first backend request can be slower.
- The app uses polling for seat-map updates, as required, rather than WebSockets or SSE.

## ✅ Testing

The backend test suite currently contains **22 Jest/Supertest tests across 5 suites**. Coverage includes auth, validation failures, role restrictions, concurrency-safe seat holding, booking confirmation/cancellation, email failure retry behavior, and waitlist expiry/cascade behavior.

Run tests from the repository root:

```bash
npm test
```

Tests require `TEST_DATABASE_URL` and refuse to run when `TEST_DATABASE_URL` matches `DATABASE_URL`, protecting the real database from cleanup during test runs.

## 🌐 Deployment

- Frontend: Vercel
- Backend: Render
- Database: Neon PostgreSQL

Production deployment uses `prisma migrate deploy` followed by the seed script. The backend must be configured with `DATABASE_URL`, `JWT_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `DEMO_EMAIL_RECIPIENT`, `DEFAULT_ADMIN_EMAIL`, `DEFAULT_ADMIN_PASSWORD`, `ORGANISER_SIGNUP_CODE`, and `CORS_ORIGIN`. The frontend must be configured with `VITE_API_URL` pointing to the deployed Render backend.
