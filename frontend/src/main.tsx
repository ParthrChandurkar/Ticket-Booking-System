import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { create } from "zustand";
import "./styles.css";

const queryClient = new QueryClient();
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

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
  const [route, setRoute] = React.useState(location.hash.slice(1) || "/events");
  React.useEffect(() => {
    const onHash = () => setRoute(location.hash.slice(1) || "/events");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route;
};

const go = (path: string) => {
  location.hash = `#${path}`;
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

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const registerSchema = loginSchema.extend({
  name: z.string().min(2)
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
          <button onClick={() => go("/bookings")}>Bookings</button>
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
              <em>{show.pricing.map((price) => `${price.category} $${price.price}`).join(" · ")}</em>
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
  const { data, refetch } = useQuery({
    queryKey: ["seats", showId],
    queryFn: () => api<{ seats: Seat[] }>(`/shows/${showId}/seats`),
    refetchInterval: 4000
  });
  const hold = async (seat: Seat) => {
    if (!user) return go("/auth");
    await api(`/shows/${showId}/seats/${seat.id}/hold`, { method: "POST" });
    checkout.setHeldSeat(showId, seat.id);
    await refetch();
  };
  const seats = data?.seats ?? [];
  const heldByMe = seats.filter((seat) => seat.status === "HELD" && seat.isHeldByMe);
  return (
    <Shell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Seat selection</p>
          <h1>Choose your seats</h1>
        </div>
        <button className="primary-button compact" disabled={!heldByMe.length} onClick={() => go("/checkout")}>Checkout</button>
      </header>
      <div className="seat-legend">
        <span className="dot available" /> Available <span className="dot held" /> Held <span className="dot booked" /> Booked <span className="dot mine" /> Held by me
      </div>
      <div className="stage">SCREEN / STAGE</div>
      <section className="seat-map">
        {seats.map((seat) => {
          const mine = seat.status === "HELD" && seat.isHeldByMe;
          return (
            <button
              key={seat.id}
              className={`seat ${mine ? "mine" : seat.status.toLowerCase()}`}
              disabled={seat.status !== "AVAILABLE"}
              onClick={() => hold(seat)}
              title={`${seat.rowLabel}${seat.seatNumber} ${seat.category}`}
            >
              {seat.rowLabel}{seat.seatNumber}
            </button>
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
            </div>
          ))}
        </section>
      )}
    </Shell>
  );
}

function CheckoutPage() {
  const checkout = useCheckout();
  const { data } = useQuery({
    queryKey: ["checkout-seats", checkout.showId],
    queryFn: () => api<{ seats: Seat[] }>(`/shows/${checkout.showId}/seats`),
    enabled: Boolean(checkout.showId)
  });
  const seats = (data?.seats ?? []).filter((seat) => checkout.heldSeatIds.includes(seat.id));
  const total = seats.reduce((sum, seat) => sum + seat.price, 0);
  const confirm = async () => {
    const response = await api<{ booking: Booking }>("/bookings", {
      method: "POST",
      body: JSON.stringify({ showSeatIds: seats.map((seat) => seat.id) })
    });
    checkout.clear();
    go("/bookings");
    return response;
  };
  return (
    <Shell>
      <section className="panel checkout">
        <h1>Checkout</h1>
        {seats.map((seat) => (
          <div className="line-item" key={seat.id}>
            <span>{seat.rowLabel}{seat.seatNumber} · {seat.category}</span>
            <strong>${seat.price.toFixed(2)}</strong>
          </div>
        ))}
        <div className="total"><span>Total</span><strong>${total.toFixed(2)}</strong></div>
        <button className="primary-button" disabled={!seats.length} onClick={confirm}>Confirm booking</button>
      </section>
    </Shell>
  );
}

function BookingsPage() {
  const { data, refetch } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => api<{ bookings: Booking[] }>("/bookings")
  });
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
            <strong>${booking.totalPrice.toFixed(2)}</strong>
            <button onClick={async () => { await api(`/bookings/${booking.id}/resend-confirmation`); refetch(); }}>Resend confirmation</button>
          </div>
        ))}
      </section>
    </Shell>
  );
}

const eventFormSchema = z.object({ venueId: z.string().uuid(), title: z.string().min(2), description: z.string().min(5) });

function OrganiserPage() {
  const [eventForm, setEventForm] = React.useState({ venueId: "", title: "", description: "" });
  const [showForm, setShowForm] = React.useState({ eventId: "", date: "", time: "", categoryPrices: "STANDARD:30" });
  const { data: events, refetch } = useQuery({ queryKey: ["my-events"], queryFn: () => api<{ events: EventItem[] }>("/events") });
  const { data: venues } = useQuery({ queryKey: ["organiser-venues"], queryFn: () => api<{ venues: { id: string; name: string }[] }>("/organiser/venues") });
  const [summaryEventId, setSummaryEventId] = React.useState("");
  const { data: summary } = useQuery({
    queryKey: ["summary", summaryEventId],
    queryFn: () => api<{ totalRevenue: number; totalBookings: number; shows: { showId: string; date: string; time: string; revenue: number; seatsSold: number }[] }>(`/organiser/events/${summaryEventId}/summary`),
    enabled: Boolean(summaryEventId)
  });
  const createEvent = async () => {
    eventFormSchema.parse(eventForm);
    await api("/events", { method: "POST", body: JSON.stringify(eventForm) });
    setEventForm({ venueId: "", title: "", description: "" });
    refetch();
  };
  const createShow = async () => {
    const categoryPrices = showForm.categoryPrices.split(",").map((item) => {
      const [category, price] = item.split(":");
      return { category: category.trim(), price: Number(price) };
    });
    await api(`/events/${showForm.eventId}/shows`, {
      method: "POST",
      body: JSON.stringify({ date: showForm.date, time: showForm.time, categoryPrices })
    });
    refetch();
  };
  return (
    <Shell>
      <h1>Organiser dashboard</h1>
      <section className="dashboard-grid">
        <div className="panel">
          <h2>Create event</h2>
          <select value={eventForm.venueId} onChange={(e) => setEventForm({ ...eventForm, venueId: e.target.value })}>
            <option value="">Select venue</option>
            {venues?.venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}
          </select>
          <input placeholder="Title" value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} />
          <textarea placeholder="Description" value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} />
          <button className="primary-button" onClick={createEvent}>Create event</button>
        </div>
        <div className="panel">
          <h2>Create show</h2>
          <select value={showForm.eventId} onChange={(e) => setShowForm({ ...showForm, eventId: e.target.value })}>
            <option value="">Select event</option>
            {events?.events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
          </select>
          <input type="date" value={showForm.date} onChange={(e) => setShowForm({ ...showForm, date: e.target.value })} />
          <input value={showForm.time} onChange={(e) => setShowForm({ ...showForm, time: e.target.value })} placeholder="19:30" />
          <input value={showForm.categoryPrices} onChange={(e) => setShowForm({ ...showForm, categoryPrices: e.target.value })} />
          <button className="primary-button" onClick={createShow}>Create show</button>
        </div>
      </section>
      <section className="panel">
        <h2>Revenue summary</h2>
        <select value={summaryEventId} onChange={(e) => setSummaryEventId(e.target.value)}>
          <option value="">Select event</option>
          {events?.events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
        </select>
        {summary && <div className="summary"><strong>${summary.totalRevenue.toFixed(2)}</strong><span>{summary.totalBookings} bookings</span></div>}
      </section>
    </Shell>
  );
}

function AdminPage() {
  const [venue, setVenue] = React.useState({ name: "", address: "" });
  const [layout, setLayout] = React.useState({ venueId: "", rows: "A,B,C", seatsPerRow: 10, category: "STANDARD" });
  const { data, refetch } = useQuery({ queryKey: ["admin-venues"], queryFn: () => api<{ venues: { id: string; name: string }[] }>("/venues") });
  const createVenue = async () => {
    await api("/venues", { method: "POST", body: JSON.stringify(venue) });
    setVenue({ name: "", address: "" });
    refetch();
  };
  const createLayout = async () => {
    const seats = layout.rows.split(",").flatMap((row) =>
      Array.from({ length: Number(layout.seatsPerRow) }, (_, index) => ({
        rowLabel: row.trim(),
        seatNumber: index + 1,
        category: layout.category
      }))
    );
    await api(`/venues/${layout.venueId}/seat-layouts`, { method: "POST", body: JSON.stringify({ seats }) });
  };
  return (
    <Shell>
      <h1>Admin dashboard</h1>
      <section className="dashboard-grid">
        <div className="panel">
          <h2>Create venue</h2>
          <input placeholder="Venue name" value={venue.name} onChange={(e) => setVenue({ ...venue, name: e.target.value })} />
          <input placeholder="Address" value={venue.address} onChange={(e) => setVenue({ ...venue, address: e.target.value })} />
          <button className="primary-button" onClick={createVenue}>Create venue</button>
        </div>
        <div className="panel">
          <h2>Create seat layout</h2>
          <select value={layout.venueId} onChange={(e) => setLayout({ ...layout, venueId: e.target.value })}>
            <option value="">Select venue</option>
            {data?.venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}
          </select>
          <input value={layout.rows} onChange={(e) => setLayout({ ...layout, rows: e.target.value })} />
          <input type="number" value={layout.seatsPerRow} onChange={(e) => setLayout({ ...layout, seatsPerRow: Number(e.target.value) })} />
          <input value={layout.category} onChange={(e) => setLayout({ ...layout, category: e.target.value })} />
          <button className="primary-button" onClick={createLayout}>Generate seats</button>
        </div>
      </section>
    </Shell>
  );
}

function App() {
  const route = useHashRoute();
  const user = useAuth((state) => state.user);
  if (route === "/auth") return <AuthPage />;
  if (!user && !route.startsWith("/events")) return <AuthPage />;
  if (route === "/events" || route === "/") return <EventsPage />;
  if (route.startsWith("/events/")) return <EventDetailPage id={route.split("/")[2]} />;
  if (route.startsWith("/shows/")) return <SeatMapPage showId={route.split("/")[2]} />;
  if (route === "/checkout") return <CheckoutPage />;
  if (route === "/bookings") return <BookingsPage />;
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
