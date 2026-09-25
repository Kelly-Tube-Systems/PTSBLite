import type { ContactDetails } from "@/domain/contact-details";

export type SessionStoreResult = { ok: true } | { ok: false; error: string };

export type SessionStore = {
  load: () => string | null;
  store: (json: string) => SessionStoreResult;
  clear: () => void;
  /** Set aside a payload this build cannot read without overwriting an earlier backup. */
  preserveUnreadable: () => void;
};

export type ContactGate = {
  /** True once this browser has submitted the contact form. */
  submitted: () => boolean;
  /** What this browser submitted, for the BOM to print. Null when it kept none (ADR-0053). */
  details: () => ContactDetails | null;
  submit: (details: ContactDetails) => Promise<{ error?: string }>;
};

export type Platform = {
  session: SessionStore;
  contact: ContactGate;
  savePdf: (bytes: Uint8Array, suggestedName: string) => Promise<{ error?: string }>;
  /** Email a downloaded BOM to sales, with who it was prepared for when known (ADR-0055). */
  emailBom: (
    bytes: Uint8Array,
    filename: string,
    customer: ContactDetails | null
  ) => Promise<{ error?: string }>;
};
