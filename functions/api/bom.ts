import { readContactDetails } from "../../src/domain/contact-details";
import { complete, detailLines, oneLine, sendToSales, status, type Env } from "./contact";

/**
 * Emails a BOM PDF to Kelly's sales team through Resend each time a visitor
 * downloads one (ADR-0055). Sent like the contact form (ADR-0054), from the
 * same address, to the same place, under the same key.
 */

/**
 * The largest PDF taken, far more than a BOM with its rendered views. Resend
 * takes up to 40 MB an email once the attachment is base64, which this leaves
 * well clear of.
 */
export const MAX_PDF_BYTES = 10_000_000;
const MAX_PDF_BASE64 = Math.ceil(MAX_PDF_BYTES / 3) * 4;
/** The PDF as base64, plus room for the contact details and file name. */
const MAX_BODY = MAX_PDF_BASE64 + 20_000;
/** What the attachment is called when the page's name for it is not a plain PDF file name. */
const FALLBACK_NAME = "PTSBLite BOM.pdf";

export async function onRequestPost({
  request,
  env
}: {
  request: Request;
  env: Env;
}): Promise<Response> {
  // Only this site's own pages post here, as with the contact form.
  if (request.headers.get("Origin") !== new URL(request.url).origin) return status(403);

  const body = await request.text();
  if (body.length > MAX_BODY) return status(413);
  const bom = readBom(body);
  if (!bom) return status(400);
  if (bom.pdf.length > MAX_PDF_BASE64) return status(413);

  const details = readContactDetails(JSON.stringify(bom.contact ?? null));
  const known = details && complete(details) ? details : null;

  return sendToSales(env, "BOM", {
    ...(known && { reply_to: known.email }),
    subject: oneLine(
      known
        ? `PTSBLite BOM: ${known.firstName} ${known.lastName}, ${known.company}`
        : "PTSBLite BOM"
    ),
    text: [
      "A visitor downloaded this BOM from PTSBLite.",
      "",
      ...(known ? detailLines(known) : ["Their browser kept no contact details."])
    ].join("\n"),
    attachments: [{ filename: bom.filename, content: bom.pdf }]
  });
}

type Bom = { pdf: string; filename: string; contact?: unknown };

/** The post, or null when it does not carry a PDF. */
function readBom(body: string): Bom | null {
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const { pdf, filename, contact } = value as Record<string, unknown>;
  if (typeof pdf !== "string" || !isPdf(pdf)) return null;
  return {
    pdf,
    filename:
      typeof filename === "string" && /^[\w .-]{1,120}\.pdf$/.test(filename)
        ? filename
        : FALLBACK_NAME,
    contact
  };
}

/** Whether base64 `content` starts the way every PDF does. */
function isPdf(content: string): boolean {
  try {
    return atob(content.slice(0, 8)).startsWith("%PDF-");
  } catch {
    return false;
  }
}
