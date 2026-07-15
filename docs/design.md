# Design Notes

## Trade-offs & Known Limitations

Email delivery uses Resend's `onboarding@resend.dev` sandbox sender for the assignment demo, so booking confirmations and waitlist offers are intentionally routed to `DEMO_EMAIL_RECIPIENT` (`parthrchn27@gmail.com`) until a custom sending domain is verified for production.
