import { readContactDetails, type ContactDetails } from "../../src/domain/contact-details";

/**
 * Emails a first visit's contact form to Kelly's sales team through Resend
 * (ADR-0054). A Cloudflare Pages Function: it runs on Cloudflare only, never in
 * the browser, so the Resend key never reaches the page.
 */

export type Env = {
  /** A send-only key from Kelly's Resend account. Set on Production only. */
  RESEND_API_KEY?: string;
  /**
   * Sends the email here instead of to sales, to test a deployment without
   * sales seeing it. Every visitor's details go here while it is set.
   */
  CONTACT_TO?: string;
};

const SALES = "sales@kellytubesystems.com";
/** Must be on a domain verified in Kelly's Resend account, or Resend refuses the send. */
const FROM = "PTSBLite <ptsblite@kellytubesystems.com>";
/** Far more than the form can hold; anything larger is not the form. */
const MAX_BODY = 16_000;

export async function onRequestPost({
  request,
  env
}: {
  request: Request;
  env: Env;
}): Promise<Response> {
  // Only this site's own pages post here. A form on another site could
  // otherwise use its visitors' browsers to write to sales.
  if (request.headers.get("Origin") !== new URL(request.url).origin) return status(403);

  const body = await request.text();
  const details = body.length <= MAX_BODY ? readContactDetails(body) : null;
  if (!details || !complete(details)) return status(400);

  return sendToSales(env, "contact", {
    reply_to: details.email,
    subject: oneLine(
      `PTSBLite contact: ${details.firstName} ${details.lastName}, ${details.company}`
    ),
    text: emailText(details)
  });
}

/**
 * Sends `email` from PTSBLite to sales, or to `CONTACT_TO` while it is set, and
 * answers the page: 204 once Resend has taken it, 502 when Resend refuses.
 */
export async function sendToSales(
  env: Env,
  what: string,
  email: Record<string, unknown>
): Promise<Response> {
  // Previews and any deployment without the key answer as if it had gone and
  // send nothing, so a preview's test submissions never reach sales.
  if (!env.RESEND_API_KEY) return status(204);

  const sent = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from: FROM, to: [env.CONTACT_TO || SALES], ...email })
  });
  if (!sent.ok) {
    // The status and Resend's reason reach the Function's logs, not the visitor.
    console.error(`Resend refused the ${what} email: ${sent.status} ${await sent.text()}`);
    return status(502);
  }
  return status(204);
}

export function complete(details: ContactDetails): boolean {
  const { comments: _optional, industry: _checked, ...required } = details;
  return (
    Object.values(required).every((value) => value.trim() !== "") &&
    /^[^\s@]+@[^\s@]+$/.test(details.email)
  );
}

function emailText(details: ContactDetails): string {
  return ["A visitor filled in the PTSBLite contact form.", "", ...detailLines(details)].join("\n");
}

/** The details as the contact email lists them, for the BOM email to list the same way. */
export function detailLines(details: ContactDetails): string[] {
  return [
    `Name: ${details.firstName} ${details.lastName}`,
    `Company: ${details.company}`,
    `Phone: ${details.phone}`,
    `Email: ${details.email}`,
    `Industry: ${details.industry}`,
    "",
    "Comments:",
    details.comments.trim() === "" ? "(none)" : details.comments
  ];
}

export function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function status(code: number): Response {
  return new Response(null, { status: code });
}
