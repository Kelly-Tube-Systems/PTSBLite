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

const TEXT_KEYS = ["firstName", "lastName", "company", "phone", "email", "comments"] as const;

/**
 * The contact details a browser stored, or null when there are none it can
 * read. A browser that submitted the form before its details were kept stored
 * only the time it did (ADR-0053), which reads as none.
 */
export function readContactDetails(json: string | null): ContactDetails | null {
  if (json === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (!TEXT_KEYS.every((key) => typeof record[key] === "string")) return null;
  if (!INDUSTRIES.includes(record.industry as Industry)) return null;
  const details = record as ContactDetails;
  return {
    firstName: details.firstName,
    lastName: details.lastName,
    company: details.company,
    phone: details.phone,
    email: details.email,
    industry: details.industry,
    comments: details.comments
  };
}
