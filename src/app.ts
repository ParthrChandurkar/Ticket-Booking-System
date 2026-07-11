import express from "express";
import { errorHandler, notFound } from "./middleware/errorHandler";
import { authRouter } from "./modules/auth/auth.routes";
import { bookingRouter } from "./modules/bookings/booking.routes";
import { eventRouter } from "./modules/events/event.routes";
import { organiserRouter } from "./modules/organiser/organiser.routes";
import { showRouter } from "./modules/shows/show.routes";
import { venueRouter } from "./modules/venues/venue.routes";
import { waitlistRouter } from "./modules/waitlist/waitlist.routes";

export const app = express();

app.use((req, res, next) => {
  const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((origin) => origin.trim());
  const requestOrigin = req.headers.origin;

  if (typeof requestOrigin === "string" && allowedOrigins.includes(requestOrigin)) {
    res.header("Access-Control-Allow-Origin", requestOrigin);
  }

  res.header("Vary", "Origin");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.send();
  }
  return next();
});

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRouter);
app.use("/bookings", bookingRouter);
app.use("/venues", venueRouter);
app.use("/events", eventRouter);
app.use("/organiser", organiserRouter);
app.use("/shows", showRouter);
app.use("/waitlist", waitlistRouter);

app.use(notFound);
app.use(errorHandler);
