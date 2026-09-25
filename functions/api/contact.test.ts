import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequestPost } from "./contact";

const SITE = "https://ptsblite.example";
const KEY = { RESEND_API_KEY: "re_test" };

const details = {
  firstName: "Ada",
  lastName: "Lovelace",
  company: "Analytical Engines",
  phone: "555-0100",
  email: "ada@example.com",
  industry: "Retail",
  comments: ""
};

function post(body: unknown, origin: string | null = SITE): Request {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (origin) headers.set("Origin", origin);
  return new Request(`${SITE}/api/contact`, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body)
  });
}

/** Stand in for Resend, answering every send with `status`. */
function resend(status: number, body = "{}") {
  const fetch = vi.fn(() => Promise.resolve(new Response(body, { status })));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the contact form's email to sales", () => {
  it("sends the details to sales, with the visitor as the reply address", async () => {
    const fetch = resend(200);

    const response = await onRequestPost({
      request: post({ ...details, comments: "Two floors." }),
      env: KEY
    });

    expect(response.status).toBe(204);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer re_test");
    const email = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(email).toMatchObject({
      to: ["sales@kellytubesystems.com"],
      reply_to: "ada@example.com",
      subject: "PTSBLite contact: Ada Lovelace, Analytical Engines"
    });
    expect(email.text).toContain("Phone: 555-0100");
    expect(email.text).toContain("Industry: Retail");
    expect(email.text).toContain("Two floors.");
  });

  it("sends to CONTACT_TO instead of sales while it is set", async () => {
    const fetch = resend(200);

    await onRequestPost({
      request: post(details),
      env: { ...KEY, CONTACT_TO: "tester@example.com" }
    });

    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({ to: ["tester@example.com"] });
  });

  it("keeps a line break typed into a name out of the subject", async () => {
    const fetch = resend(200);

    await onRequestPost({
      request: post({ ...details, company: "Analytical\r\nEngines" }),
      env: KEY
    });

    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    const email = JSON.parse(init.body as string) as { subject: string };
    expect(email.subject).toBe("PTSBLite contact: Ada Lovelace, Analytical Engines");
  });

  it("opens the app without sending anything when there is no key", async () => {
    // Previews have no key, so a test submission on one never reaches sales.
    const fetch = resend(200);

    const response = await onRequestPost({ request: post(details), env: {} });

    expect(response.status).toBe(204);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reports a send Resend refused, so the visitor can try again", async () => {
    resend(403);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await onRequestPost({ request: post(details), env: KEY });

    expect(response.status).toBe(502);
  });

  it("logs a refused send without the visitor's details", async () => {
    // Resend's message can quote the field it rejected.
    resend(
      422,
      JSON.stringify({
        statusCode: 422,
        name: "validation_error",
        message: "Invalid `reply_to` field: ada@example.com"
      })
    );
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await onRequestPost({ request: post(details), env: KEY });

    const logged = log.mock.calls.flat().join(" ");
    expect(logged).toContain("422 validation_error");
    for (const value of Object.values(details).filter((v) => v !== "")) {
      expect(logged).not.toContain(value);
    }
  });

  it("refuses a post from another site", async () => {
    const fetch = resend(200);

    const elsewhere = await onRequestPost({
      request: post(details, "https://elsewhere.example"),
      env: KEY
    });
    const unsigned = await onRequestPost({ request: post(details, null), env: KEY });

    expect(elsewhere.status).toBe(403);
    expect(unsigned.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses anything that is not a completed form", async () => {
    const fetch = resend(200);
    const refused = [
      "not json",
      { ...details, industry: "Mining" },
      { ...details, company: "   " },
      { ...details, email: "ada" },
      { ...details, comments: "x".repeat(20_000) }
    ];

    for (const body of refused) {
      const response = await onRequestPost({ request: post(body), env: KEY });
      expect(response.status).toBe(400);
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});
