import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { webPlatform } from "@/platform/web";

const SESSION_KEY = "ptsblite:autosave:v1";
const UNREADABLE_KEY = "ptsblite:autosave:unreadable";
const CONTACT_KEY = "ptsblite:contact:v1";

beforeEach(() => {
  window.localStorage.clear();
});

/**
 * Run `body`, and anything it awaits, with `localStorage` replaced by one that
 * throws on write.
 *
 * The whole object is swapped rather than `setItem` spied on. happy-dom's
 * storage does not survive a spy being installed and restored on it — writes
 * silently stop working for every test that follows, which shows up as a wrong
 * assertion somewhere unrelated rather than as an error here.
 */
async function withFailingWrites(error: Error, body: () => unknown): Promise<void> {
  const original = Object.getOwnPropertyDescriptor(window, "localStorage");
  const failing = {
    getItem: () => null,
    setItem: () => {
      throw error;
    },
    removeItem: () => undefined,
    clear: () => undefined,
    key: () => null,
    length: 0
  };
  Object.defineProperty(window, "localStorage", { configurable: true, value: failing });
  try {
    await body();
  } finally {
    if (original) Object.defineProperty(window, "localStorage", original);
  }
}

describe("session persistence", () => {
  function session() {
    return webPlatform().session;
  }

  it("round-trips a stored design", () => {
    const store = session();
    expect(store.load()).toBeNull();
    expect(store.store('{"schemaVersion":"1"}')).toEqual({ ok: true });
    expect(store.load()).toBe('{"schemaVersion":"1"}');
  });

  it("clears the stored design", () => {
    const store = session();
    store.store("{}");
    store.clear();
    expect(store.load()).toBeNull();
  });

  it("reports a refused write rather than throwing", async () => {
    const quota = new Error("full");
    quota.name = "QuotaExceededError";

    await withFailingWrites(quota, () => {
      const result = session().store("{}");

      // The caller keeps the design dirty and says so, so a failed write is
      // never silent. Throwing here would take the placement down with it.
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toMatch(/out of storage/i);
    });
  });

  it("sets an unreadable payload aside instead of deleting it", () => {
    const store = session();
    store.store("not json");

    store.preserveUnreadable();

    // An unsupported schema usually means a rollback or a missed migration, so
    // a later deployment may be able to read what this one could not.
    expect(window.localStorage.getItem(UNREADABLE_KEY)).toBe("not json");
    expect(window.localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it("never overwrites an earlier backup", () => {
    const store = session();
    store.store("first failure");
    store.preserveUnreadable();
    store.store("second failure");

    store.preserveUnreadable();

    // A second failure must not destroy the copy the first one preserved.
    expect(window.localStorage.getItem(UNREADABLE_KEY)).toBe("first failure");
  });
});

describe("contact gate", () => {
  const details = {
    firstName: "Ada",
    lastName: "Lovelace",
    company: "Analytical Engines",
    phone: "555-0100",
    email: "ada@example.com",
    industry: "Retail",
    comments: ""
  } as const;

  /** Stand in for functions/api/contact.ts, answering every post with `status`. */
  function contactEndpoint(status: number) {
    const fetch = vi.fn(() => Promise.resolve(new Response(null, { status })));
    vi.stubGlobal("fetch", fetch);
    return fetch;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the details and remembers them, for the BOM to print", async () => {
    const fetch = contactEndpoint(204);
    const contact = webPlatform().contact;
    expect(contact.submitted()).toBe(false);
    expect(contact.details()).toBeNull();

    expect(await contact.submit(details)).toEqual({});

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/contact");
    expect(JSON.parse(init.body as string)).toEqual(details);
    expect(webPlatform().contact.submitted()).toBe(true);
    expect(webPlatform().contact.details()).toEqual(details);
  });

  it("keeps the visitor at the form when the details were not sent", async () => {
    // Letting them in would lose the details: the form never comes back.
    contactEndpoint(502);
    const refused = await webPlatform().contact.submit(details);

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("Failed to fetch")))
    );
    const offline = await webPlatform().contact.submit(details);

    expect(refused.error).toMatch(/could not be sent/i);
    expect(offline.error).toMatch(/could not be sent/i);
    expect(webPlatform().contact.submitted()).toBe(false);
  });

  it("counts a browser that stored only the time as submitted, with no details", () => {
    // What builds before ADR-0053 stored. Asking that visitor again would be
    // the form twice; their BOM goes without the details instead.
    window.localStorage.setItem(CONTACT_KEY, "2026-09-25T00:00:00.000Z");

    expect(webPlatform().contact.submitted()).toBe(true);
    expect(webPlatform().contact.details()).toBeNull();
  });

  it("reads no details from a stored value that is not the form's", () => {
    window.localStorage.setItem(CONTACT_KEY, JSON.stringify({ ...details, industry: "Mining" }));
    expect(webPlatform().contact.details()).toBeNull();

    window.localStorage.setItem(CONTACT_KEY, JSON.stringify({ ...details, email: 7 }));
    expect(webPlatform().contact.details()).toBeNull();
  });

  it("lets the visitor in when storage refuses the write", async () => {
    contactEndpoint(204);
    let result: { error?: string } = { error: "not run" };

    await withFailingWrites(new Error("denied"), async () => {
      result = await webPlatform().contact.submit(details);
    });

    expect(result).toEqual({});
  });
});

describe("emailing a BOM", () => {
  const pdf = new TextEncoder().encode("%PDF-1.7 a BOM");
  const details = {
    firstName: "Ada",
    lastName: "Lovelace",
    company: "Analytical Engines",
    phone: "555-0100",
    email: "ada@example.com",
    industry: "Retail",
    comments: ""
  } as const;

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the PDF, its name, and who it was prepared for", async () => {
    const fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal("fetch", fetch);

    expect(await webPlatform().emailBom(pdf, "BOM.pdf", details)).toEqual({});

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/bom");
    const body = JSON.parse(init.body as string) as { pdf: string };
    expect(body).toMatchObject({ filename: "BOM.pdf", contact: details });
    expect(atob(body.pdf)).toBe("%PDF-1.7 a BOM");
  });

  it("encodes a PDF too large to spread into one call", async () => {
    const fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal("fetch", fetch);
    const large = new Uint8Array(1_000_000).fill(0x41);

    await webPlatform().emailBom(large, "BOM.pdf", null);

    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect((JSON.parse(init.body as string) as { pdf: string }).pdf).toBe(
      btoa("A".repeat(1_000_000))
    );
  });

  it("reports an email that did not go", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 502 })))
    );
    const refused = await webPlatform().emailBom(pdf, "BOM.pdf", null);
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("Failed to fetch")))
    );
    const offline = await webPlatform().emailBom(pdf, "BOM.pdf", null);

    expect(refused.error).toMatch(/downloaded, but it could not be sent/);
    expect(offline.error).toBe(refused.error);
  });
});
