import { Resend } from "resend";
import { prisma } from "../../config/prisma";
import { getEnv } from "../../config/env";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const sendWaitlistOfferEmail = async (waitlistId: string) => {
  const waitlist = await prisma.waitlist.findUnique({
    where: { id: waitlistId }
  });
  if (!waitlist) {
    return null;
  }

  const [customer, show] = await Promise.all([
    prisma.user.findUnique({ where: { id: waitlist.customerId } }),
    prisma.show.findUnique({ where: { id: waitlist.showId } })
  ]);
  if (!customer || !show) {
    return null;
  }

  const event = await prisma.event.findUnique({
    where: { id: show.eventId }
  });
  if (!event) {
    return null;
  }

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827;">
      <h1>A seat is available</h1>
      <p>Hello ${escapeHtml(customer.name)},</p>
      <p>A ${escapeHtml(waitlist.category)} seat is available for <strong>${escapeHtml(
        event.title
      )}</strong>.</p>
      <p>This offer expires at ${waitlist.offerExpiresAt?.toISOString() ?? "soon"}.</p>
      <p><a href="/waitlist/${waitlist.id}/accept">Accept your waitlist offer</a></p>
    </div>
  `;

  const resend = new Resend(getEnv("RESEND_API_KEY"));
  try {
    const response = await resend.emails.send({
      from: getEnv("RESEND_FROM_EMAIL"),
      to: [customer.email],
      subject: `Seat offer: ${event.title}`,
      html
    });

    if (response.error) {
      throw response.error;
    }

    return response.data;
  } catch (error) {
    console.error("Waitlist offer email failed", { waitlistId, error });
    return null;
  }
};
