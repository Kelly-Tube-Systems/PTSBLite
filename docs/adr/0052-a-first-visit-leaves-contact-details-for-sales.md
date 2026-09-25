# ADR-0052: A first visit leaves contact details for sales

- **Status:** Accepted
- **Date:** 2026-09-25
- **Supersedes:** [ADR-0011](0011-lite-has-no-commercial-data-path.md) where it forbade customer
  details, for this form only. Its rule against money stands.

## Context

Kelly Tube Systems wants to know who is planning a system. The client asked for a form that every
visitor fills in before using the app for the first time, emailed to sales@kellytubesystems.com
through Resend. ADR-0011 forbade customer details outright, and the site makes no network requests
(`connect-src 'none'`). The project lead lifted the rule for this form.

## Decision

**A first visit opens on a contact form, before the welcome screen.** First name, last name,
company name, phone number, email, and industry (Retail, Dispensary, Medical, Bar / Restaurant,
Other) are required; additional comments are optional. The form cannot be dismissed.

**The browser remembers that the form was submitted, not what was in it.** Submitting sets
`ptsblite:contact:v1` in `localStorage`, and a later visit in the same browser skips the form. A
browser that refuses storage lets the visitor in and asks again next visit.

**The form is built before the email is wired.** Sending needs Kelly's own Cloudflare and Resend
accounts, which do not exist yet. Until they do, submitting only opens the app: nothing is sent and
nothing reaches sales. `Platform.contact.submit` is where the sending goes.

## Consequences

- Wiring the email means a Cloudflare Pages Function that calls Resend with a `RESEND_API_KEY`
  secret and a From address on a domain verified in Resend, and loosening `connect-src` in
  `web-public/_headers` to `'self'` so the page can reach it.
- The Windows app runs the same build, so it shows the same form (ADR-0051).
- The details are personal data sent to Kelly's sales team. They are not stored by the app.
