export type SessionStoreResult = { ok: true } | { ok: false; error: string };

export type SessionStore = {
  load: () => string | null;
  store: (json: string) => SessionStoreResult;
  clear: () => void;
  /** Set aside a payload this build cannot read without overwriting an earlier backup. */
  preserveUnreadable: () => void;
};

/** The industries the contact form offers, in the order the client listed them. */
export const INDUSTRIES = ["Retail", "Dispensary", "Medical", "Bar / Restaurant", "Other"] as const;

export type Industry = (typeof INDUSTRIES)[number];

/** What the first-visit contact form collects. Only `comments` may be empty. See ADR-0052. */
export type ContactDetails = {
  firstName: string;
  lastName: string;
  company: string;
  phone: string;
  email: string;
  industry: Industry;
  comments: string;
};

export type ContactGate = {
  /** True once this browser has submitted the contact form. */
  submitted: () => boolean;
  submit: (details: ContactDetails) => Promise<{ error?: string }>;
};

export type Platform = {
  session: SessionStore;
  contact: ContactGate;
  savePdf: (bytes: Uint8Array, suggestedName: string) => Promise<{ error?: string }>;
};
