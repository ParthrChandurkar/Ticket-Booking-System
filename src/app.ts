import express from "express";
import { errorHandler, notFound } from "./middleware/errorHandler";
import { authRouter } from "./modules/auth/auth.routes";
import { eventRouter } from "./modules/events/event.routes";
import { showRouter } from "./modules/shows/show.routes";
import { venueRouter } from "./modules/venues/venue.routes";

export const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRouter);
app.use("/venues", venueRouter);
app.use("/events", eventRouter);
app.use("/shows", showRouter);

app.use(notFound);
app.use(errorHandler);
