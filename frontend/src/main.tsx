import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { create } from "zustand";
import "./styles.css";

const queryClient = new QueryClient();
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

const formatCurrency = (amount: number) => `₹${amount.toFixed(2)}`;

type Role = "CUSTOMER" | "ORGANISER" | "ADMIN";
type User = { id: string; name: string; email: string; role: Role };
type EventItem = {
  id: string;
  title: string;
  description: string;
  venueId: string;
  venue?: { id: string; name: string; address: string } | null;
  shows: Show[];
};
type Show = {
  id: string;
  eventId: string;
  date: string;
  time: string;
  pricing: { category: string; price: number }[];
};
type VenueItem = {
  id: string;
  name: string;
  address: string;
  createdAt?: string;
  seatLayouts?: { id: string; rowLabel: string; seatNumber: number; category: string }[];
};
type EventSummary = {
  event: { id: string; title: string };
  totalRevenue: number;
  totalBookings: number;
  shows: { showId: string; date: string; time: string; revenue: number; seatsSold: number; confirmedBookings: number }[];
};
type Seat = {
  id: string;
  showId: string;
  status: "AVAILABLE" | "HELD" | "BOOKED";
  isHeldByMe: boolean;
  heldUntil: string | null;
  rowLabel: string;
  seatNumber: number;
  category: string;
  price: number;
};
type Booking = {
  id: string;
  bookingReference: string;
  status: "CONFIRMED" | "CANCELLED";
  totalPrice: number;
  createdAt: string;
  seats: { showSeatId: string }[];
};
type WaitlistEntry = {
  id: string;
  customerId: string;
  showId: string;
  category: string;
  status: "WAITING" | "OFFERED" | "EXPIRED" | "FULFILLED";
  position: number;
  offeredSeatId: string | null;
  offerExpiresAt: string | null;
  createdAt: string;
  show?: {
    id: string;
    date: string;
    time: string;
    event: { id: string; title: string } | null;
  } | null;
};

type AuthState = {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (session: { user: User; accessToken: string; refreshToken: string }) => void;
  logout: () => void;
};

type CheckoutState = {
  showId: string | null;
  heldSeatIds: string[];
  setHeldSeat: (showId: string, seatId: string) => void;
  removeHeldSeat: (seatId: string) => void;
  clear: () => void;
};

const storedSession = localStorage.getItem("seatflow-session");

const useAuth = create<AuthState>((set) => ({
  ...(storedSession
    ? JSON.parse(storedSession)
    : { user: null, accessToken: null, refreshToken: null }),
  setSession: (session) => {
    localStorage.setItem("seatflow-session", JSON.stringify(session));
    set(session);
  },
  logout: () => {
    localStorage.removeItem("seatflow-session");
    set({ user: null, accessToken: null, refreshToken: null });
    location.hash = "#/auth";
  }
}));

const useCheckout = create<CheckoutState>((set) => ({
  showId: null,
  heldSeatIds: [],
  setHeldSeat: (showId, seatId) =>
    set((state) => ({
      showId,
      heldSeatIds:
        state.showId === showId
          ? Array.from(new Set([...state.heldSeatIds, seatId]))
          : [seatId]
    })),
  removeHeldSeat: (seatId) =>
    set((state) => ({
      ...state,
      heldSeatIds: state.heldSeatIds.filter((id) => id !== seatId)
    })),
  clear: () => set({ showId: null, heldSeatIds: [] })
}));

const api = async <T,>(path: string, options: RequestInit = {}) => {
  const token = useAuth.getState().accessToken;
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.message ?? "Request failed");
  }
  return data as T;
};

const useHashRoute = () => {
  const [route, setRoute] = React.useState(location.hash.slice(1) || "/");
  React.useEffect(() => {
    const onHash = () => setRoute(location.hash.slice(1) || "/");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route;
};

const go = (path: string) => {
  location.hash = `#${path}`;
};

const requiredText = (label: string) => z.string().trim().min(1, `${label} is required`);
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[0-9]/, "Password must include a number");
const timeSchema = z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm time");
const futureDateSchema = z.string().min(1, "Date is required").refine(
  (value) => new Date(`${value}T00:00:00`).getTime() > Date.now(),
  "Date must be in the future"
);

const zodMessage = (error: unknown) => {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Validation failed";
  }
  return error instanceof Error ? error.message : "Request failed";
};

const Field = ({
  label,
  error,
  children
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) => (
  <label className="field">
    <span>{label}</span>
    {children}
    {error && <small>{error}</small>}
  </label>
);

const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1) });
const registerSchema = loginSchema.extend({
  name: requiredText("Full name"),
  password: passwordSchema
});

const LogoMark = ({ compact = false }: { compact?: boolean }) => (
  <div className={compact ? "logo-lockup compact" : "logo-lockup"}>
    <svg className="seatflow-mark" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M13 11h22a5 5 0 0 1 5 5v6H8v-6a5 5 0 0 1 5-5Z" />
      <path d="M8 25h32v7a5 5 0 0 1-5 5H13a5 5 0 0 1-5-5v-7Z" opacity=".82" />
      <path d="M15 37v4M33 37v4M16 19h16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
    {!compact && <span>SeatFlow</span>}
  </div>
);

const passwordStrength = (password: string) => {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;
  if (score <= 1) return "weak";
  if (score === 2) return "medium";
  return "strong";
};

function LandingPage() {
  const user = useAuth((state) => state.user);
  const featured = useQuery({
    queryKey: ["landing-events"],
    queryFn: () => api<{ events: EventItem[] }>("/events/public")
  });
  const firstEvents = featured.data?.events.slice(0, 3) ?? [];
  return (
    <main className="landing-page">
      <header className="landing-nav">
        <LogoMark />
        <nav>
          <button onClick={() => go("/events")}>Browse events</button>
          <button onClick={() => go(user ? "/bookings" : "/auth")}>{user ? "My bookings" : "Sign in"}</button>
        </nav>
      </header>

      <section className="landing-hero">
        <div className="landing-copy">
          <p className="eyebrow">Movie and concert ticketing</p>
          <h1>Book the right seat before someone else does.</h1>
          <p>
            SeatFlow brings event discovery, real-time seat holds, waitlists, QR tickets,
            and role-based dashboards into one clean booking experience.
          </p>
          <div className="landing-actions">
            <button className="primary-button compact" onClick={() => go("/events")}>Explore events</button>
            <button className="outline-button" onClick={() => go("/auth")}>Create account</button>
          </div>
          <div className="landing-metrics">
            <span><strong>10 min</strong> protected holds</span>
            <span><strong>30 min</strong> waitlist offers</span>
            <span><strong>QR</strong> email tickets</span>
          </div>
        </div>

        <div className="landing-visual" aria-label="SeatFlow booking preview">
          <div className="preview-topbar">
            <span>Skyline Dreams</span>
            <strong>Live seat map</strong>
          </div>
          <div className="preview-stage">SCREEN / STAGE</div>
          <div className="preview-seats">
            {Array.from({ length: 48 }, (_, index) => {
              const state = index === 4 ? "mine" : index === 10 || index === 31 ? "held" : index % 13 === 0 ? "booked" : "available";
              return <span key={index} className={`preview-seat ${state}`} />;
            })}
          </div>
          <div className="preview-summary">
            <div>
              <span>Held by you</span>
              <strong>A5 - Premium</strong>
            </div>
            <em>09:42</em>
          </div>
        </div>
      </section>

      <section className="landing-features">
        <article>
          <strong>Atomic seat holds</strong>
          <p>Conditional database updates keep two customers from holding the same seat.</p>
        </article>
        <article>
          <strong>Waitlist recovery</strong>
          <p>Cancelled seats are offered to the next customer in line with a time limit.</p>
        </article>
        <article>
          <strong>Operational dashboards</strong>
          <p>Admins manage venues while organisers create shows and track revenue.</p>
        </article>
      </section>

      <section className="landing-events">
        <div>
          <p className="eyebrow">Now showing</p>
          <h2>Featured demo events</h2>
        </div>
        <div className="landing-event-row">
          {firstEvents.map((event) => (
            <button key={event.id} onClick={() => go(`/events/${event.id}`)}>
              <span>{event.venue?.name ?? "Venue announced soon"}</span>
              <strong>{event.title}</strong>
              <em>{event.shows.length} show{event.shows.length === 1 ? "" : "s"}</em>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

function AuthPage() {
  const [mode, setMode] = React.useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [form, setForm] = React.useState({
    name: "",
    email: "",
    password: ""
  });
  const setSession = useAuth((state) => state.setSession);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors({});
    const parsed = (mode === "login" ? loginSchema : registerSchema).safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ?? "Invalid value"])));
      return;
    }
    try {
      if (mode === "register") {
        await api("/auth/register", {
          method: "POST",
          body: JSON.stringify({ name: form.name, email: form.email, password: form.password })
        });
      }
      const session = await api<{ user: User; accessToken: string; refreshToken: string }>(
        "/auth/login",
        { method: "POST", body: JSON.stringify({ email: form.email, password: form.password }) }
      );
      setSession(session);
      go(session.user.role === "ADMIN" ? "/admin" : session.user.role === "ORGANISER" ? "/organiser" : "/events");
    } catch (error) {
      setErrors({ root: error instanceof Error ? error.message : "Authentication failed" });
    }
  };

  return (
    <main className="auth-shell">
      <section className="brand-panel">
        <LogoMark />
        <h1>SeatFlow</h1>
        <p>Reserved seats, real-time holds, and confident checkout for every show.</p>
        <div className="brand-stats">
          <span>Movies</span>
          <span>Concerts</span>
          <span>Live shows</span>
        </div>
      </section>
      <section className="auth-card">
        <div>
          <p className="eyebrow">{mode === "login" ? "Welcome back" : "Join SeatFlow"}</p>
          <h2>{mode === "login" ? "Sign in to continue" : "Create your account"}</h2>
        </div>
        <form onSubmit={submit} noValidate>
          {mode === "register" && (
            <Field label="Full name" error={errors.name}>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
          )}
          <Field label="Email address" error={errors.email}>
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Password" error={errors.password}>
            <div className="password-row">
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <button type="button" onClick={() => setShowPassword((value) => !value)}>
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {mode === "register" && (
              <div className={`strength ${passwordStrength(form.password)}`}>
                <span />
                <strong>{passwordStrength(form.password)}</strong>
              </div>
            )}
          </Field>
          {errors.root && <p className="form-error">{errors.root}</p>}
          <button className="primary-button" type="submit">
            {mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
        <button className="link-button" type="button" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "Need an account? Create account" : "Already registered? Sign in"}
        </button>
      </section>
    </main>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const user = useAuth((state) => state.user);
  const logout = useAuth((state) => state.logout);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="logo"><LogoMark /></div>
        <nav>
          <button onClick={() => go("/events")}>Events</button>
          {user?.role === "CUSTOMER" && <button onClick={() => go("/bookings")}>Bookings</button>}
          {user?.role === "CUSTOMER" && <button onClick={() => go("/waitlist")}>My Waitlist</button>}
          {user?.role === "ORGANISER" && <button onClick={() => go("/organiser")}>Organiser</button>}
          {user?.role === "ADMIN" && <button onClick={() => go("/admin")}>Admin</button>}
        </nav>
        <div className="user-panel">
          <strong>{user?.name ?? "Guest"}</strong>
          <span>{user?.role ?? "Public"}</span>
          {user ? <button onClick={logout}>Sign out</button> : <button onClick={() => go("/auth")}>Sign in</button>}
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}

function EventsPage() {
  const [search, setSearch] = React.useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["events", search],
    queryFn: () => api<{ events: EventItem[] }>(`/events/public${search ? `?search=${encodeURIComponent(search)}` : ""}`)
  });
  return (
    <Shell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Discover</p>
          <h1>Events</h1>
        </div>
        <input className="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search events" />
      </header>
      {isLoading ? <p>Loading events...</p> : (
        <section className="event-grid">
          {data?.events.map((event) => (
            <article className="event-card" key={event.id} onClick={() => go(`/events/${event.id}`)}>
              <div className="event-art">{event.title.slice(0, 2).toUpperCase()}</div>
              <div>
                <h3>{event.title}</h3>
                <p>{event.description}</p>
                <span>{event.venue?.name ?? "Venue pending"} · {event.shows.length} shows</span>
              </div>
            </article>
          ))}
        </section>
      )}
    </Shell>
  );
}

function EventDetailPage({ id }: { id: string }) {
  const { data } = useQuery({
    queryKey: ["event", id],
    queryFn: () => api<{ event: EventItem }>(`/events/public/${id}`)
  });
  const event = data?.event;
  return (
    <Shell>
      <button className="ghost-button" onClick={() => go("/events")}>Back</button>
      <section className="detail-hero">
        <p className="eyebrow">{event?.venue?.name}</p>
        <h1>{event?.title ?? "Event"}</h1>
        <p>{event?.description}</p>
      </section>
      <section className="panel">
        <h2>Select a show</h2>
        <div className="show-list">
          {event?.shows.map((show) => (
            <button key={show.id} onClick={() => go(`/shows/${show.id}/seats`)}>
              <strong>{new Date(show.date).toLocaleDateString()}</strong>
              <span>{show.time}</span>
              <em>{show.pricing.map((price) => `${price.category} ${formatCurrency(price.price)}`).join(" · ")}</em>
            </button>
          ))}
        </div>
      </section>
    </Shell>
  );
}

function Countdown({ until }: { until: string }) {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const remaining = Math.max(0, new Date(until).getTime() - now);
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return <span className="countdown">{minutes}:{seconds.toString().padStart(2, "0")}</span>;
}

function SeatMapPage({ showId }: { showId: string }) {
  const user = useAuth((state) => state.user);
  const checkout = useCheckout();
  const [waitlistMessages, setWaitlistMessages] = React.useState<Record<string, string>>({});
  const [seatActionError, setSeatActionError] = React.useState("");
  const { data, refetch } = useQuery({
    queryKey: ["seats", showId],
    queryFn: () => api<{ seats: Seat[] }>(`/shows/${showId}/seats`),
    refetchInterval: 4000
  });
  const { data: waitlistData, refetch: refetchWaitlist } = useQuery({
    queryKey: ["waitlist"],
    queryFn: () => api<{ waitlist: WaitlistEntry[] }>("/waitlist"),
    enabled: user?.role === "CUSTOMER"
  });
  const hold = async (seat: Seat) => {
    if (!user) return go("/auth");
    if (user.role !== "CUSTOMER") return;
    try {
      setSeatActionError("");
      await api(`/shows/${showId}/seats/${seat.id}/hold`, { method: "POST" });
      checkout.setHeldSeat(showId, seat.id);
      await refetch();
    } catch (error) {
      setSeatActionError(error instanceof Error ? error.message : "Could not hold seat");
    }
  };
  const releaseHold = async (seat: Seat) => {
    try {
      setSeatActionError("");
      await api(`/shows/${showId}/seats/${seat.id}/hold`, { method: "DELETE" });
      checkout.removeHeldSeat(seat.id);
      await refetch();
    } catch (error) {
      setSeatActionError(error instanceof Error ? error.message : "Could not release hold");
    }
  };
  const joinWaitlist = async (category: string) => {
    if (!user) return go("/auth");
    if (user.role !== "CUSTOMER") return;
    try {
      const response = await api<{ waitlist: WaitlistEntry }>("/waitlist", {
        method: "POST",
        body: JSON.stringify({ showId, category })
      });
      setWaitlistMessages((messages) => ({
        ...messages,
        [category]: `You're on the waitlist, position ${response.waitlist.position}.`
      }));
      await refetchWaitlist();
    } catch (error) {
      setWaitlistMessages((messages) => ({
        ...messages,
        [category]: error instanceof Error ? error.message : "Could not join waitlist"
      }));
    }
  };
  const seats = data?.seats ?? [];
  const heldByMe = seats.filter((seat) => seat.status === "HELD" && seat.isHeldByMe);
  const categories = Array.from(new Set(seats.map((seat) => seat.category)));
  const waitlistForShow = (waitlistData?.waitlist ?? []).filter((entry) => entry.showId === showId);
  return (
    <Shell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Seat selection</p>
          <h1>Choose your seats</h1>
        </div>
        <button className="primary-button compact" disabled={user?.role !== "CUSTOMER" || !heldByMe.length} onClick={() => go("/checkout")}>Checkout</button>
      </header>
      {user && user.role !== "CUSTOMER" && <p className="form-error">Only customer accounts can hold seats or checkout.</p>}
      {seatActionError && <p className="form-error">{seatActionError}</p>}
      <div className="seat-legend">
        <span className="dot available" /> Available <span className="dot held" /> Held <span className="dot booked" /> Booked <span className="dot mine" /> Held by me
      </div>
      <div className="stage">SCREEN / STAGE</div>
      <section className="seat-categories">
        {categories.map((category) => {
          const categorySeats = seats.filter((seat) => seat.category === category);
          const availableCount = categorySeats.filter((seat) => seat.status === "AVAILABLE").length;
          const existingWaitlist = waitlistForShow.find(
            (entry) =>
              entry.category === category &&
              ["WAITING", "OFFERED"].includes(entry.status)
          );
          const soldOut = availableCount === 0;
          return (
            <div className="seat-category" key={category}>
              <div className="category-header">
                <div>
                  <h2>{category}</h2>
                  <span>{availableCount} available</span>
                </div>
                {categorySeats[0] && <strong>{formatCurrency(categorySeats[0].price)}</strong>}
              </div>
              {soldOut ? (
                <div className="waitlist-card">
                  <div>
                    <h3>Sold out in {category}</h3>
                    <p>{existingWaitlist ? `Status: ${existingWaitlist.status.toLowerCase()}, position ${existingWaitlist.position}` : "Join the queue and get the next released seat offer."}</p>
                    {waitlistMessages[category] && <p className="form-success">{waitlistMessages[category]}</p>}
                  </div>
                  <button
                    className="primary-button compact"
                    disabled={user?.role !== "CUSTOMER" || Boolean(existingWaitlist)}
                    onClick={() => joinWaitlist(category)}
                  >
                    {user ? existingWaitlist ? "On Waitlist" : "Join Waitlist" : "Sign in to Join"}
                  </button>
                </div>
              ) : (
                <div className="seat-map">
                  {categorySeats.map((seat) => {
                    const mine = seat.status === "HELD" && seat.isHeldByMe;
                    return (
                      <button
                        key={seat.id}
                        className={`seat ${mine ? "mine" : seat.status.toLowerCase()}`}
                        disabled={user?.role !== "CUSTOMER" || seat.status !== "AVAILABLE"}
                        onClick={() => hold(seat)}
                        title={`${seat.rowLabel}${seat.seatNumber} ${seat.category}`}
                      >
                        {seat.rowLabel}{seat.seatNumber}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </section>
      {heldByMe.length > 0 && (
        <section className="panel held-panel">
          <h2>Your holds</h2>
          {heldByMe.map((seat) => (
            <div className="held-row" key={seat.id}>
              <span>{seat.rowLabel}{seat.seatNumber} · {seat.category}</span>
              {seat.heldUntil && <Countdown until={seat.heldUntil} />}
              <button className="ghost-button" onClick={() => releaseHold(seat)}>Release</button>
            </div>
          ))}
        </section>
      )}
    </Shell>
  );
}

function CheckoutPage() {
  const checkout = useCheckout();
  const user = useAuth((state) => state.user);
  const [confirmError, setConfirmError] = React.useState("");
  const [isConfirming, setIsConfirming] = React.useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["checkout-seats", checkout.showId],
    queryFn: () => api<{ seats: Seat[] }>(`/shows/${checkout.showId}/seats`),
    enabled: Boolean(checkout.showId)
  });
  const seats = (data?.seats ?? []).filter(
    (seat) =>
      checkout.heldSeatIds.includes(seat.id) &&
      seat.status === "HELD" &&
      seat.isHeldByMe
  );
  const total = seats.reduce((sum, seat) => sum + seat.price, 0);
  const confirm = async () => {
    try {
      setConfirmError("");
      setIsConfirming(true);
      const response = await api<{ booking: Booking }>("/bookings", {
        method: "POST",
        body: JSON.stringify({ showSeatIds: seats.map((seat) => seat.id) })
      });
      checkout.clear();
      go("/bookings");
      return response;
    } catch (error) {
      setConfirmError(error instanceof Error ? error.message : "Could not confirm booking");
    } finally {
      setIsConfirming(false);
    }
  };
  return (
    <Shell>
      <section className="panel checkout">
        <h1>Checkout</h1>
        {isLoading && <p>Loading held seats...</p>}
        {!isLoading && checkout.heldSeatIds.length > 0 && seats.length === 0 && <p className="form-error">Your held seats are no longer available for checkout.</p>}
        {seats.map((seat) => (
          <div className="line-item" key={seat.id}>
            <span>{seat.rowLabel}{seat.seatNumber} · {seat.category}</span>
            <strong>{formatCurrency(seat.price)}</strong>
          </div>
        ))}
        <div className="total"><span>Total</span><strong>{formatCurrency(total)}</strong></div>
        {user?.role !== "CUSTOMER" && <p className="form-error">Only customer accounts can confirm bookings.</p>}
        {confirmError && <p className="form-error">{confirmError}</p>}
        <button className="primary-button" disabled={user?.role !== "CUSTOMER" || isLoading || isConfirming || !seats.length} onClick={confirm}>
          {isConfirming ? "Confirming..." : isLoading ? "Loading seats..." : "Confirm booking"}
        </button>
      </section>
    </Shell>
  );
}

function BookingsPage() {
  const { data, refetch } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => api<{ bookings: Booking[] }>("/bookings")
  });
  const cancelBooking = async (booking: Booking) => {
    if (!window.confirm(`Cancel booking ${booking.bookingReference}?`)) {
      return;
    }
    await api(`/bookings/${booking.id}`, { method: "DELETE" });
    await refetch();
  };
  return (
    <Shell>
      <h1>Booking history</h1>
      <section className="table-card">
        {data?.bookings.map((booking) => (
          <div className="booking-row" key={booking.id}>
            <div>
              <strong>{booking.bookingReference}</strong>
              <span>{booking.status} · {new Date(booking.createdAt).toLocaleString()}</span>
            </div>
            <strong>{formatCurrency(booking.totalPrice)}</strong>
            <button onClick={async () => { await api(`/bookings/${booking.id}/resend-confirmation`); refetch(); }}>Resend confirmation</button>
            {booking.status === "CONFIRMED" && <button onClick={() => cancelBooking(booking)}>Cancel</button>}
          </div>
        ))}
      </section>
    </Shell>
  );
}

function WaitlistPage() {
  const [message, setMessage] = React.useState("");
  const { data, refetch } = useQuery({
    queryKey: ["waitlist"],
    queryFn: () => api<{ waitlist: WaitlistEntry[] }>("/waitlist")
  });
  const acceptOffer = async (entry: WaitlistEntry) => {
    try {
      setMessage("");
      await api(`/waitlist/${entry.id}/accept`);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      setMessage("Offer accepted and booking confirmed. Check your booking history.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not accept offer");
    }
  };
  const entries = data?.waitlist ?? [];
  return (
    <Shell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Queue status</p>
          <h1>My Waitlist</h1>
        </div>
      </header>
      {message && <p className={message.includes("confirmed") ? "form-success" : "form-error"}>{message}</p>}
      <section className="table-card">
        {entries.length === 0 && <div className="empty-state">No waitlist entries yet.</div>}
        {entries.map((entry) => (
          <div className="booking-row" key={entry.id}>
            <div>
              <strong>{entry.show?.event?.title ?? "Show"}</strong>
              <span>{entry.category} · {entry.status.toLowerCase()} · position {entry.position}</span>
              {entry.show && <span>{new Date(entry.show.date).toLocaleDateString()} at {entry.show.time}</span>}
              {entry.offerExpiresAt && <span>Offer expires {new Date(entry.offerExpiresAt).toLocaleString()}</span>}
            </div>
            {entry.status === "OFFERED" ? (
              <button className="primary-button compact" onClick={() => acceptOffer(entry)}>Accept Offer</button>
            ) : (
              <span className={`status-pill ${entry.status.toLowerCase()}`}>{entry.status}</span>
            )}
          </div>
        ))}
      </section>
    </Shell>
  );
}

const eventFormSchema = z.object({
  venueId: z.string().uuid("Select a venue"),
  title: requiredText("Event title"),
  description: requiredText("Event description")
});
const showFormSchema = z.object({
  eventId: z.string().uuid("Select an event"),
  date: futureDateSchema,
  time: timeSchema,
  categoryPrices: requiredText("Category pricing")
});

function OrganiserPage() {
  const [eventForm, setEventForm] = React.useState({ venueId: "", title: "", description: "" });
  const [showForm, setShowForm] = React.useState({ eventId: "", date: "", time: "", categoryPrices: "STANDARD:350,PREMIUM:750" });
  const [editingEvent, setEditingEvent] = React.useState<EventItem | null>(null);
  const [eventError, setEventError] = React.useState("");
  const [showError, setShowError] = React.useState("");
  const [actionMessage, setActionMessage] = React.useState("");
  const { data: events, refetch } = useQuery({ queryKey: ["my-events"], queryFn: () => api<{ events: EventItem[] }>("/events") });
  const { data: publicEvents } = useQuery({ queryKey: ["organiser-public-events"], queryFn: () => api<{ events: EventItem[] }>("/events/public") });
  const { data: venues } = useQuery({ queryKey: ["organiser-venues"], queryFn: () => api<{ venues: VenueItem[] }>("/organiser/venues") });
  const [summaryEventId, setSummaryEventId] = React.useState("");
  const { data: summary } = useQuery({
    queryKey: ["summary", summaryEventId],
    queryFn: () => api<EventSummary>(`/organiser/events/${summaryEventId}/summary`),
    enabled: Boolean(summaryEventId)
  });
  const { data: showInventory } = useQuery({
    queryKey: ["organiser-seat-inventory", summaryEventId, summary?.shows.map((show) => show.showId).join(",")],
    queryFn: async () => {
      const inventories = await Promise.all(
        (summary?.shows ?? []).map(async (show) => {
          const response = await api<{ seats: Seat[] }>(`/shows/${show.showId}/seats`);
          return {
            showId: show.showId,
            total: response.seats.length,
            available: response.seats.filter((seat) => seat.status === "AVAILABLE").length,
            held: response.seats.filter((seat) => seat.status === "HELD").length,
            booked: response.seats.filter((seat) => seat.status === "BOOKED").length
          };
        })
      );
      return new Map(inventories.map((item) => [item.showId, item]));
    },
    enabled: Boolean(summary?.shows.length)
  });
  const ownedEvents = events?.events ?? [];
  const publicEventById = new Map((publicEvents?.events ?? []).map((event) => [event.id, event]));
  const selectedPublicEvent = summaryEventId ? publicEventById.get(summaryEventId) : undefined;
  const totalShows = ownedEvents.reduce((sum, event) => sum + (publicEventById.get(event.id)?.shows.length ?? 0), 0);
  const createEvent = async () => {
    try {
      setEventError("");
      eventFormSchema.parse(eventForm);
      await api("/events", { method: "POST", body: JSON.stringify(eventForm) });
      setEventForm({ venueId: "", title: "", description: "" });
      setActionMessage("Event created. You can now add showtimes and pricing.");
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["organiser-public-events"] });
    } catch (error) {
      setEventError(zodMessage(error));
    }
  };
  const updateEvent = async () => {
    if (!editingEvent) return;
    try {
      setEventError("");
      eventFormSchema.parse(eventForm);
      await api(`/events/${editingEvent.id}`, { method: "PUT", body: JSON.stringify(eventForm) });
      setEditingEvent(null);
      setEventForm({ venueId: "", title: "", description: "" });
      setActionMessage("Event updated.");
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["organiser-public-events"] });
    } catch (error) {
      setEventError(zodMessage(error));
    }
  };
  const deleteEvent = async (event: EventItem) => {
    if (!window.confirm(`Delete event "${event.title}"? This should only be used before bookings exist.`)) return;
    try {
      await api(`/events/${event.id}`, { method: "DELETE" });
      setActionMessage("Event deleted.");
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["organiser-public-events"] });
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Could not delete event.");
    }
  };
  const editEvent = (event: EventItem) => {
    setEditingEvent(event);
    setEventError("");
    setEventForm({
      venueId: event.venueId,
      title: event.title,
      description: event.description
    });
  };
  const createShow = async () => {
    try {
      setShowError("");
      showFormSchema.parse(showForm);
      const categoryPrices = showForm.categoryPrices.split(",").map((item) => {
        const [category, price] = item.split(":");
        if (!category?.trim() || !price || Number(price) <= 0) {
          throw new Error("Use category:price pairs with positive prices");
        }
        return { category: category.trim(), price: Number(price) };
      });
      await api(`/events/${showForm.eventId}/shows`, {
        method: "POST",
        body: JSON.stringify({ date: showForm.date, time: showForm.time, categoryPrices })
      });
      setActionMessage("Show created with generated seats.");
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["organiser-public-events"] });
      queryClient.invalidateQueries({ queryKey: ["summary", showForm.eventId] });
    } catch (error) {
      setShowError(zodMessage(error));
    }
  };
  return (
    <Shell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Control centre</p>
          <h1>Organiser dashboard</h1>
        </div>
      </header>
      <section className="stat-grid">
        <div className="stat-card"><span>Events managed</span><strong>{ownedEvents.length}</strong></div>
        <div className="stat-card"><span>Shows scheduled</span><strong>{totalShows}</strong></div>
        <div className="stat-card"><span>Selected revenue</span><strong>{formatCurrency(summary?.totalRevenue ?? 0)}</strong></div>
        <div className="stat-card"><span>Confirmed bookings</span><strong>{summary?.totalBookings ?? 0}</strong></div>
      </section>
      {actionMessage && <p className={actionMessage.includes("Could not") ? "form-error" : "form-success"}>{actionMessage}</p>}
      <section className="dashboard-grid">
        <div className="panel">
          <h2>{editingEvent ? "Edit event" : "Create event"}</h2>
          <p className="helper-text">Choose the venue first, then add a public title and customer-facing description.</p>
          <select value={eventForm.venueId} onChange={(e) => setEventForm({ ...eventForm, venueId: e.target.value })}>
            <option value="">Select venue for this event</option>
            {venues?.venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}
          </select>
          <input placeholder="Event title, e.g. Indie Night Live" value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} />
          <textarea placeholder="Short public description shown on listing and detail pages" value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} />
          {eventError && <p className="form-error">{eventError}</p>}
          <button className="primary-button" onClick={editingEvent ? updateEvent : createEvent}>{editingEvent ? "Save event changes" : "Create event"}</button>
          {editingEvent && <button className="ghost-button action-link" onClick={() => { setEditingEvent(null); setEventForm({ venueId: "", title: "", description: "" }); }}>Cancel edit</button>}
        </div>
        <div className="panel">
          <h2>Create show</h2>
          <p className="helper-text">Every show automatically receives seats from the selected event venue layout.</p>
          <select value={showForm.eventId} onChange={(e) => setShowForm({ ...showForm, eventId: e.target.value })}>
            <option value="">Select event to schedule</option>
            {events?.events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
          </select>
          <input type="date" value={showForm.date} onChange={(e) => setShowForm({ ...showForm, date: e.target.value })} />
          <input value={showForm.time} onChange={(e) => setShowForm({ ...showForm, time: e.target.value })} placeholder="Show time in 24h format, e.g. 19:30" />
          <input value={showForm.categoryPrices} onChange={(e) => setShowForm({ ...showForm, categoryPrices: e.target.value })} placeholder="Category prices, e.g. STANDARD:350,PREMIUM:750" />
          {showError && <p className="form-error">{showError}</p>}
          <button className="primary-button" onClick={createShow}>Create show</button>
        </div>
      </section>
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Portfolio</p>
            <h2>Event controls</h2>
          </div>
          <span>{ownedEvents.length} active records</span>
        </div>
        <div className="control-list">
          {ownedEvents.length === 0 && <p className="empty-state">No organiser events yet.</p>}
          {ownedEvents.map((event) => {
            const publicEvent = publicEventById.get(event.id);
            return (
              <article className="control-row" key={event.id}>
                <div>
                  <strong>{event.title}</strong>
                  <span>{publicEvent?.venue?.name ?? "Venue"} · {publicEvent?.shows.length ?? 0} shows</span>
                  <p>{event.description}</p>
                </div>
                <div className="row-actions">
                  <button onClick={() => { setSummaryEventId(event.id); }}>View sales</button>
                  <button onClick={() => { setShowForm({ ...showForm, eventId: event.id }); }}>Add show</button>
                  <button onClick={() => editEvent(event)}>Edit</button>
                  <button className="danger-button" onClick={() => deleteEvent(event)}>Delete</button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <section className="panel">
        <h2>Revenue and seat inventory</h2>
        <p className="helper-text">Select an event to supervise bookings, booked seats, held seats, availability, and show-level revenue.</p>
        <select value={summaryEventId} onChange={(e) => setSummaryEventId(e.target.value)}>
          <option value="">Select event to inspect</option>
          {events?.events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
        </select>
        {summary && (
          <>
            <div className="summary">
              <strong>{formatCurrency(summary.totalRevenue)}</strong>
              <span>{summary.totalBookings} confirmed bookings · {selectedPublicEvent?.shows.length ?? summary.shows.length} shows</span>
            </div>
            <div className="ops-table">
              <div className="ops-table-head">
                <span>Show</span><span>Available</span><span>Held</span><span>Booked</span><span>Sold</span><span>Revenue</span><span>Action</span>
              </div>
              {summary.shows.map((show) => {
                const inventory = showInventory?.get(show.showId);
                return (
                  <div className="ops-table-row" key={show.showId}>
                    <span>{new Date(show.date).toLocaleDateString()} · {show.time}</span>
                    <strong>{inventory?.available ?? "-"}</strong>
                    <strong>{inventory?.held ?? "-"}</strong>
                    <strong>{inventory?.booked ?? "-"}</strong>
                    <strong>{show.seatsSold}</strong>
                    <strong>{formatCurrency(show.revenue)}</strong>
                    <button onClick={() => go(`/shows/${show.showId}/seats`)}>Open seat map</button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>
    </Shell>
  );
}

function AdminPage() {
  const [venue, setVenue] = React.useState({ name: "", address: "" });
  const [layout, setLayout] = React.useState({ venueId: "", rows: "A,B,C", seatsPerRow: 10, category: "STANDARD" });
  const [selectedVenueId, setSelectedVenueId] = React.useState("");
  const [editVenue, setEditVenue] = React.useState({ name: "", address: "" });
  const [venueError, setVenueError] = React.useState("");
  const [layoutError, setLayoutError] = React.useState("");
  const [adminMessage, setAdminMessage] = React.useState("");
  const { data, refetch } = useQuery({ queryKey: ["admin-venues"], queryFn: () => api<{ venues: VenueItem[] }>("/venues") });
  const { data: allEvents } = useQuery({ queryKey: ["admin-public-events"], queryFn: () => api<{ events: EventItem[] }>("/events/public") });
  const { data: selectedVenue, refetch: refetchSelectedVenue } = useQuery({
    queryKey: ["admin-venue-detail", selectedVenueId],
    queryFn: () => api<{ venue: VenueItem }>(`/venues/${selectedVenueId}`),
    enabled: Boolean(selectedVenueId)
  });
  React.useEffect(() => {
    if (selectedVenue?.venue) {
      setEditVenue({
        name: selectedVenue.venue.name,
        address: selectedVenue.venue.address
      });
    }
  }, [selectedVenue?.venue?.id]);
  const venueFormSchema = z.object({
    name: requiredText("Venue name"),
    address: requiredText("Venue address")
  });
  const layoutFormSchema = z.object({
    venueId: z.string().uuid("Select a venue"),
    rows: requiredText("Rows"),
    seatsPerRow: z.number().int().positive("Seats per row must be positive"),
    category: requiredText("Category")
  });
  const createVenue = async () => {
    try {
      setVenueError("");
      venueFormSchema.parse(venue);
      const response = await api<{ venue: VenueItem }>("/venues", { method: "POST", body: JSON.stringify(venue) });
      setVenue({ name: "", address: "" });
      setSelectedVenueId(response.venue.id);
      setAdminMessage("Venue created. Add seat layouts before organisers schedule shows.");
      await refetch();
    } catch (error) {
      setVenueError(zodMessage(error));
    }
  };
  const updateVenue = async () => {
    if (!selectedVenueId) return;
    try {
      setVenueError("");
      venueFormSchema.parse(editVenue);
      await api(`/venues/${selectedVenueId}`, { method: "PUT", body: JSON.stringify(editVenue) });
      setAdminMessage("Venue details updated.");
      await refetch();
      await refetchSelectedVenue();
    } catch (error) {
      setVenueError(zodMessage(error));
    }
  };
  const deleteVenue = async () => {
    if (!selectedVenueId || !selectedVenue?.venue) return;
    if (!window.confirm(`Delete venue "${selectedVenue.venue.name}"? This is only safe before events are attached.`)) return;
    try {
      await api(`/venues/${selectedVenueId}`, { method: "DELETE" });
      setSelectedVenueId("");
      setEditVenue({ name: "", address: "" });
      setAdminMessage("Venue deleted.");
      await refetch();
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : "Could not delete venue.");
    }
  };
  const createLayout = async () => {
    try {
      setLayoutError("");
      layoutFormSchema.parse(layout);
      const rows = layout.rows.split(",").map((row) => row.trim()).filter(Boolean);
      if (!rows.length) {
        throw new Error("At least one row is required");
      }
      const seats = rows.flatMap((row) =>
        Array.from({ length: Number(layout.seatsPerRow) }, (_, index) => ({
          rowLabel: row,
          seatNumber: index + 1,
          category: layout.category.trim()
        }))
      );
      await api(`/venues/${layout.venueId}/seat-layouts`, { method: "POST", body: JSON.stringify({ seats }) });
      setSelectedVenueId(layout.venueId);
      setAdminMessage(`${seats.length} seats generated for ${layout.category.trim().toUpperCase()}.`);
      await refetchSelectedVenue();
    } catch (error) {
      setLayoutError(zodMessage(error));
    }
  };
  const venues = data?.venues ?? [];
  const venueSeatCount = selectedVenue?.venue.seatLayouts?.length ?? 0;
  const venueCategories = Array.from(new Set((selectedVenue?.venue.seatLayouts ?? []).map((seat) => seat.category)));
  const totalShows = (allEvents?.events ?? []).reduce((sum, event) => sum + event.shows.length, 0);
  return (
    <Shell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Platform supervision</p>
          <h1>Admin dashboard</h1>
        </div>
      </header>
      <section className="stat-grid">
        <div className="stat-card"><span>Venues</span><strong>{venues.length}</strong></div>
        <div className="stat-card"><span>Published events</span><strong>{allEvents?.events.length ?? 0}</strong></div>
        <div className="stat-card"><span>Total shows</span><strong>{totalShows}</strong></div>
        <div className="stat-card"><span>Selected venue seats</span><strong>{venueSeatCount}</strong></div>
      </section>
      {adminMessage && <p className={adminMessage.includes("Could not") ? "form-error" : "form-success"}>{adminMessage}</p>}
      <section className="dashboard-grid">
        <div className="panel">
          <h2>Create venue</h2>
          <p className="helper-text">Add the venue shell first. Seat rows and categories are generated in the next panel.</p>
          <input placeholder="Venue name, e.g. PVR Icon Phoenix Palladium, Mumbai" value={venue.name} onChange={(e) => setVenue({ ...venue, name: e.target.value })} />
          <input placeholder="Full address, area, city" value={venue.address} onChange={(e) => setVenue({ ...venue, address: e.target.value })} />
          {venueError && <p className="form-error">{venueError}</p>}
          <button className="primary-button" onClick={createVenue}>Create venue</button>
        </div>
        <div className="panel">
          <h2>Create seat layout</h2>
          <select value={layout.venueId} onChange={(e) => setLayout({ ...layout, venueId: e.target.value })}>
            <option value="">Select venue to receive generated seats</option>
            {venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}
          </select>
          <input placeholder="Rows as comma-separated labels, e.g. A,B,C,D" value={layout.rows} onChange={(e) => setLayout({ ...layout, rows: e.target.value })} />
          <input type="number" placeholder="Seats per row, e.g. 10" value={layout.seatsPerRow} onChange={(e) => setLayout({ ...layout, seatsPerRow: Number(e.target.value) })} />
          <input placeholder="Seat category, e.g. STANDARD or PREMIUM" value={layout.category} onChange={(e) => setLayout({ ...layout, category: e.target.value.toUpperCase() })} />
          {layoutError && <p className="form-error">{layoutError}</p>}
          <button className="primary-button" onClick={createLayout}>Generate seats</button>
        </div>
      </section>
      <section className="dashboard-grid">
        <div className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Directory</p>
              <h2>Venue supervision</h2>
            </div>
            <span>{venues.length} venues</span>
          </div>
          <div className="control-list">
            {venues.map((item) => (
              <article className="control-row" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.address}</span>
                </div>
                <div className="row-actions">
                  <button onClick={() => { setSelectedVenueId(item.id); setLayout({ ...layout, venueId: item.id }); }}>Inspect</button>
                </div>
              </article>
            ))}
          </div>
        </div>
        <div className="panel">
          <h2>Selected venue controls</h2>
          {!selectedVenue?.venue && <p className="empty-state">Select a venue to inspect seat categories, update details, or delete an unused venue.</p>}
          {selectedVenue?.venue && (
            <>
              <input value={editVenue.name} onChange={(e) => setEditVenue({ ...editVenue, name: e.target.value })} placeholder="Venue display name" />
              <input value={editVenue.address} onChange={(e) => setEditVenue({ ...editVenue, address: e.target.value })} placeholder="Venue address" />
              <div className="summary">
                <strong>{venueSeatCount} seats</strong>
                <span>{venueCategories.length ? venueCategories.join(", ") : "No seat categories yet"}</span>
              </div>
              <div className="row-actions stretch">
                <button className="primary-button compact" onClick={updateVenue}>Save venue</button>
                <button className="danger-button" onClick={deleteVenue}>Delete venue</button>
              </div>
            </>
          )}
        </div>
      </section>
    </Shell>
  );
}

function App() {
  const route = useHashRoute();
  const user = useAuth((state) => state.user);
  if (route === "/") return <LandingPage />;
  if (route === "/auth") return <AuthPage />;
  if (!user && !route.startsWith("/events")) return <AuthPage />;
  if (route === "/events") return <EventsPage />;
  if (route.startsWith("/events/")) return <EventDetailPage id={route.split("/")[2]} />;
  if (route.startsWith("/shows/")) return <SeatMapPage showId={route.split("/")[2]} />;
  if (route === "/checkout") return <CheckoutPage />;
  if (route === "/bookings") return <BookingsPage />;
  if (route === "/waitlist") return <WaitlistPage />;
  if (route === "/organiser") return <OrganiserPage />;
  if (route === "/admin") return <AdminPage />;
  return <EventsPage />;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
