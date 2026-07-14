import QRCode from "qrcode";
import { Resend } from "resend";
import { prisma } from "../../config/prisma";
import { getEnv } from "../../config/env";
import { HttpError } from "../../utils/httpError";
import { sleep } from "../../utils/sleep";

type BookingEmailData = {
  booking: {
    id: string;
    bookingReference: string;
    showId: string;
    totalPrice: number;
  };
  customer: {
    email: string;
    name: string;
  };
  event: {
    title: string;
  };
  show: {
    date: Date;
    time: string;
  };
  seats: {
    rowLabel: string;
    seatNumber: number;
    category: string;
  }[];
};

const qrCodeContentId = "booking-qr-code";
const getResend = () => new Resend(getEnv("RESEND_API_KEY"));
const formatCurrency = (amount: number) => `₹${amount.toFixed(2)}`;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const generateBookingQrCode = async (bookingReference: string) =>
  QRCode.toDataURL(bookingReference, {
    type: "image/png",
    margin: 1,
    width: 240
  });

const getQrCodeAttachmentContent = async (bookingReference: string) => {
  const qrCode = await generateBookingQrCode(bookingReference);
  return qrCode.replace(/^data:image\/png;base64,/, "");
};

const buildBookingEmailHtml = (data: BookingEmailData) => {
  const seatList = data.seats
    .map(
      (seat) =>
        `<li>Row ${escapeHtml(seat.rowLabel)}, Seat ${seat.seatNumber} (${escapeHtml(
          seat.category
        )})</li>`
    )
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; color: #111827;">
      <h1>Your booking is confirmed</h1>
      <p>Hello ${escapeHtml(data.customer.name)},</p>
      <p>Your tickets for <strong>${escapeHtml(data.event.title)}</strong> are confirmed.</p>
      <p><strong>Show:</strong> ${data.show.date.toISOString().slice(0, 10)} at ${escapeHtml(
        data.show.time
      )}</p>
      <p><strong>Booking reference:</strong> ${escapeHtml(data.booking.bookingReference)}</p>
      <p><strong>Total paid:</strong> ${formatCurrency(data.booking.totalPrice)}</p>
      <h2>Seats</h2>
      <ul>${seatList}</ul>
      <img src="cid:${qrCodeContentId}" alt="Booking QR code" width="240" height="240" />
    </div>
  `;
};

const loadBookingEmailData = async (bookingId: string) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { seats: true }
  });
  if (!booking) {
    throw new HttpError(404, "Booking not found");
  }

  const [customer, show] = await Promise.all([
    prisma.user.findUnique({ where: { id: booking.customerId } }),
    prisma.show.findUnique({ where: { id: booking.showId } })
  ]);
  if (!customer || !show) {
    throw new HttpError(404, "Booking email data not found");
  }

  const event = await prisma.event.findUnique({
    where: { id: show.eventId }
  });
  if (!event) {
    throw new HttpError(404, "Event not found");
  }

  const showSeats = await prisma.showSeat.findMany({
    where: {
      id: { in: booking.seats.map((seat) => seat.showSeatId) }
    },
    include: { seatLayout: true },
    orderBy: [
      { seatLayout: { rowLabel: "asc" } },
      { seatLayout: { seatNumber: "asc" } }
    ]
  });

  return {
    booking,
    customer,
    event,
    show,
    seats: showSeats.map((seat) => ({
      rowLabel: seat.seatLayout.rowLabel,
      seatNumber: seat.seatLayout.seatNumber,
      category: seat.seatLayout.category
    }))
  };
};

export const sendBookingConfirmationEmail = async (bookingId: string) => {
  const data = await loadBookingEmailData(bookingId);
  const html = buildBookingEmailHtml(data);
  const qrCodeContent = await getQrCodeAttachmentContent(data.booking.bookingReference);
  const resend = getResend();
  const delays = [1000, 2000, 4000];
  let lastError: unknown;

  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    try {
      const response = await resend.emails.send({
        from: getEnv("RESEND_FROM_EMAIL"),
        to: [data.customer.email],
        subject: `Booking confirmed: ${data.event.title}`,
        html,
        attachments: [
          {
            filename: "booking-qr-code.png",
            content: qrCodeContent,
            contentType: "image/png",
            contentId: qrCodeContentId
          }
        ]
      });

      if (response.error) {
        throw response.error;
      }

      return response.data;
    } catch (error) {
      lastError = error;
      if (attempt < delays.length - 1) {
        await sleep(delays[attempt]);
      }
    }
  }

  console.error("Booking confirmation email failed after retries", {
    bookingId,
    error: lastError
  });
  return null;
};
