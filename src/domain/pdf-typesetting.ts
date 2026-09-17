import { radians, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/** Typesetting primitives for the bill-of-materials PDF. */

/** Long-form document date, e.g. "May 26, 2026". Defaults to today. */
export function formatDocumentDate(date = new Date()): string {
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export const PAGE_WIDTH = 612;
export const PAGE_HEIGHT = 792;
export const MARGIN_X = 56;
export const MARGIN_TOP = 56;

export const INK = rgb(0.106, 0.118, 0.149);
export const DIM = rgb(0.357, 0.392, 0.451);
export const MUT = rgb(0.478, 0.502, 0.564);
export const HAIRLINE = rgb(0.843, 0.824, 0.773);
/** Kelly Tube Systems' green, the #00A261 the UI carries as `--accent-2`. */
export const ACCENT = rgb(0, 0.635, 0.38);
/** The same green behind the parts table's column headings, at a fifteenth strength. */
export const BAND = rgb(0.933, 0.976, 0.957);

const CP1252_EXTRAS = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152,
  0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a,
  0x0153, 0x017e, 0x0178
]);

/**
 * Codepoints WinAnsi (CP1252) encodes above Latin-1's range — the curly quotes,
 * dashes, ellipsis and symbols that word processors produce.
 */
const TRANSLITERATIONS: Record<string, string> = {
  "‑": "-", // non-breaking hyphen
  "‒": "-", // figure dash
  "―": "-", // horizontal bar
  "′": "'", // prime
  "″": '"', // double prime
  " ": " ", // no-break space (encodable, but a plain space lays out better)
  " ": " ",
  " ": " ",
  " ": " ",
  " ": " "
};

export function sanitize(s: string): string {
  let out = "";
  for (const ch of s) {
    const replacement = TRANSLITERATIONS[ch];
    if (replacement !== undefined) {
      out += replacement;
      continue;
    }
    const code = ch.codePointAt(0) ?? 0;
    const encodable =
      (code >= 0x20 && code <= 0x7e) || // ASCII printable
      (code >= 0xa0 && code <= 0xff) || // Latin-1 supplement
      CP1252_EXTRAS.has(code);
    out += encodable ? ch : "?";
  }
  return out;
}

export type Painter = {
  page: PDFPage;
  sans: PDFFont;
  sansBold: PDFFont;
  mono: PDFFont;
};

export function drawText(
  p: Painter,
  text: string,
  x: number,
  y: number,
  opts: { size: number; font?: PDFFont; color?: ReturnType<typeof rgb> }
): void {
  p.page.drawText(sanitize(text), {
    x,
    y,
    size: opts.size,
    font: opts.font ?? p.sans,
    color: opts.color ?? INK
  });
}

/** How much of the page's diagonal the watermark's text spans. */
const WATERMARK_SPAN = 0.8;
/**
 * Faint enough to read the page through, strong enough to survive a
 * photocopier. The pictures are rendered on the viewport's near-black
 * background, so the mark has to show against both that and white paper: the
 * accent green sits between the two, where a grey light enough for the picture
 * would disappear into the paper.
 */
const WATERMARK_OPACITY = 0.14;

/**
 * Lay a watermark corner to corner across a page, over whatever is already on
 * it — the "SAMPLE" stamp the client asked for, saying Kelly Systems instead.
 */
export function drawWatermark(p: Painter, text: string): void {
  const safe = sanitize(text);
  const angle = Math.atan2(PAGE_HEIGHT, PAGE_WIDTH);
  // One line, sized so it spans the diagonal rather than a chosen point size,
  // which keeps the mark the same shape whatever the wording.
  const size = (Math.hypot(PAGE_WIDTH, PAGE_HEIGHT) * WATERMARK_SPAN) / widthPerPoint(p, safe);
  const width = widthPerPoint(p, safe) * size;
  const cap = p.sansBold.heightAtSize(size, { descender: false });
  // The baseline runs from (x, y) along the angle, so step back half the text
  // along it and half the cap height across it to centre the mark on the page.
  const x = PAGE_WIDTH / 2 - (width / 2) * Math.cos(angle) + (cap / 2) * Math.sin(angle);
  const y = PAGE_HEIGHT / 2 - (width / 2) * Math.sin(angle) - (cap / 2) * Math.cos(angle);
  p.page.drawText(safe, {
    x,
    y,
    size,
    font: p.sansBold,
    color: ACCENT,
    opacity: WATERMARK_OPACITY,
    rotate: radians(angle)
  });
}

/** The text's width at one point of size, which scales linearly. */
function widthPerPoint(p: Painter, safe: string): number {
  return p.sansBold.widthOfTextAtSize(safe, 100) / 100;
}

export function drawRightText(
  p: Painter,
  text: string,
  rightX: number,
  y: number,
  opts: { size: number; font?: PDFFont; color?: ReturnType<typeof rgb> }
): void {
  const font = opts.font ?? p.sans;
  const safe = sanitize(text);
  const width = font.widthOfTextAtSize(safe, opts.size);
  p.page.drawText(safe, {
    x: rightX - width,
    y,
    size: opts.size,
    font,
    color: opts.color ?? INK
  });
}
