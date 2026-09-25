import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { desktopPlatform } from "@/platform/desktop";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("desktopPlatform", () => {
  it("never shows the contact form, and has no one to print on the BOM", () => {
    const { contact } = desktopPlatform();
    expect(contact.submitted()).toBe(true);
    expect(contact.details()).toBeNull();
  });

  it("sends nothing, and reports nothing as failed", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const platform = desktopPlatform();

    await expect(
      platform.contact.submit({
        firstName: "Ada",
        lastName: "Lovelace",
        company: "Analytical Engines",
        phone: "555-0100",
        email: "ada@example.com",
        industry: "Other",
        comments: ""
      })
    ).resolves.toEqual({});
    await expect(
      platform.emailBom(new Uint8Array([0x25, 0x50, 0x44, 0x46]), "bom.pdf", null)
    ).resolves.toEqual({});

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("autosaves the design in the page's own storage", () => {
    const { session } = desktopPlatform();
    expect(session.store('{"schemaVersion":"1"}')).toEqual({ ok: true });
    expect(desktopPlatform().session.load()).toBe('{"schemaVersion":"1"}');
  });
});
