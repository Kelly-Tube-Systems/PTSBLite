import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_PDF_BYTES, onRequestPost } from "./bom";

const SITE = "https://ptsblite.example";
const KEY = { RESEND_API_KEY: "re_test" };
const PDF = btoa("%PDF-1.7 a BOM");
const FILENAME = "Kelly Systems PTSBLite BOM 25-09-26.pdf";

const details = {
  firstName: "Ada",
  lastName: "Lovelace",
  company: "Analytical Engines",
  phone: "555-0100",
  email: "ada@example.com",
  industry: "Retail",
  comments: "Two floors."
};

function post(body: unknown, origin: string | null = SITE): Request {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (origin) headers.set("Origin", origin);
  return new Request(`${SITE}/api/bom`, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body)
  });
}

/** Stand in for Resend, answering every send with `status`. */
function resend(status: number) {
  const fetch = vi.fn(() => Promise.resolve(new Response("{}", { status })));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

function sentEmail(fetch: ReturnType<typeof resend>): Record<string, unknown> {
  const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the BOM's email to sales", () => {
  it("attaches the PDF, lists who it was prepared for, and replies to them", async () => {
    const fetch = resend(200);

    const response = await onRequestPost({
      request: post({ pdf: PDF, filename: FILENAME, contact: details }),
      env: KEY
    });

    expect(response.status).toBe(204);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer re_test");
    const email = sentEmail(fetch);
    expect(email).toMatchObject({
      from: "PTSBLite <ptsblite@kellytubesystems.com>",
      to: ["sales@kellytubesystems.com"],
      reply_to: "ada@example.com",
      subject: "PTSBLite BOM: Ada Lovelace, Analytical Engines",
      attachments: [{ filename: FILENAME, content: PDF }]
    });
    expect(email.text).toContain("Phone: 555-0100");
    expect(email.text).toContain("Two floors.");
  });

  it("still sends a BOM whose browser kept no contact details", async () => {
    // A browser that submitted the form before its details were kept (ADR-0053).
    const fetch = resend(200);

    const response = await onRequestPost({
      request: post({ pdf: PDF, filename: FILENAME, contact: null }),
      env: KEY
    });

    expect(response.status).toBe(204);
    const email = sentEmail(fetch);
    expect(email.subject).toBe("PTSBLite BOM");
    expect(email).not.toHaveProperty("reply_to");
    expect(email.text).toContain("no contact details");
  });

  it("names the attachment itself when the page's name is not a plain PDF file name", async () => {
    const fetch = resend(200);

    await onRequestPost({ request: post({ pdf: PDF, filename: "../BOM.exe" }), env: KEY });

    expect(sentEmail(fetch).attachments).toEqual([{ filename: "PTSBLite BOM.pdf", content: PDF }]);
  });

  it("sends to CONTACT_TO instead of sales while it is set", async () => {
    const fetch = resend(200);

    await onRequestPost({
      request: post({ pdf: PDF, filename: FILENAME }),
      env: { ...KEY, CONTACT_TO: "tester@example.com" }
    });

    expect(sentEmail(fetch)).toMatchObject({ to: ["tester@example.com"] });
  });

  it("sends nothing when there is no key", async () => {
    // Previews have no key, so a BOM downloaded on one never reaches sales.
    const fetch = resend(200);

    const response = await onRequestPost({
      request: post({ pdf: PDF, filename: FILENAME }),
      env: {}
    });

    expect(response.status).toBe(204);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reports a send Resend refused", async () => {
    resend(422);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await onRequestPost({
      request: post({ pdf: PDF, filename: FILENAME }),
      env: KEY
    });

    expect(response.status).toBe(502);
  });

  it("refuses a post from another site", async () => {
    const fetch = resend(200);
    const bom = { pdf: PDF, filename: FILENAME };

    const elsewhere = await onRequestPost({
      request: post(bom, "https://elsewhere.example"),
      env: KEY
    });
    const unsigned = await onRequestPost({ request: post(bom, null), env: KEY });

    expect(elsewhere.status).toBe(403);
    expect(unsigned.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses anything that is not a PDF", async () => {
    const fetch = resend(200);
    const refused = [
      "not json",
      { filename: FILENAME },
      { pdf: btoa("<html>not a PDF</html>"), filename: FILENAME },
      { pdf: "%PDF-1.7 not base64", filename: FILENAME }
    ];

    for (const body of refused) {
      const response = await onRequestPost({ request: post(body), env: KEY });
      expect(response.status).toBe(400);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses a PDF too large to send", async () => {
    const fetch = resend(200);
    const tooLarge = PDF + "A".repeat(Math.ceil(MAX_PDF_BYTES / 3) * 4);

    const response = await onRequestPost({
      request: post({ pdf: tooLarge, filename: FILENAME }),
      env: KEY
    });

    expect(response.status).toBe(413);
    expect(fetch).not.toHaveBeenCalled();
  });
});
