import { rgb, type Color, type PDFFont, type PDFPage } from "pdf-lib";
import { KELLY_WORDMARK_BOX, KELLY_WORDMARK_PATHS } from "@/data/kelly-systems-wordmark";

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

/**
 * The Kelly Systems wordmark, `width` points wide, with the top left of its box
 * at (x, y).
 *
 * Vector rather than an image, for ADR-0034's reason: an outline stays sharp at
 * whatever size the document prints or is zoomed to. `drawSvgPath` takes the
 * artwork's own coordinates, y running down from (x, y), unchanged.
 */
export function drawWordmark(
  p: Painter,
  x: number,
  y: number,
  opts: { width: number; color?: Color; opacity?: number }
): void {
  const scale = opts.width / KELLY_WORDMARK_BOX.width;
  for (const path of KELLY_WORDMARK_PATHS) {
    p.page.drawSvgPath(path, { x, y, scale, color: opts.color ?? ACCENT, opacity: opts.opacity });
  }
}

/** A mark's height, at a given width. */
export function wordmarkHeight(width: number): number {
  return width * (KELLY_WORDMARK_BOX.height / KELLY_WORDMARK_BOX.width);
}

/**
 * How wide one mark of the watermark prints: a quarter of the sheet, so several
 * fall on a page and a reader's eye passes over them rather than reading them.
 */
const WATERMARK_MARK_WIDTH = 150;
/**
 * The pattern the artwork itself lays out, as ratios of one mark's width:
 * `kelly-systems-watermark.svg` is a 2016 x 1040 tile holding a 1316-wide mark
 * on rows 520 apart, every other row shifted half a tile across. That brick
 * course is what the viewport tiles behind the build area, and the client asked
 * for these pages to carry the same pattern.
 */
const WATERMARK_PERIOD = 2016 / 1316;
const WATERMARK_ROW_GAP = 520 / 1316;
/**
 * Faint enough to read the page through, strong enough to survive a
 * photocopier. The pictures are rendered on the viewport's near-black
 * background, so the mark has to show against both that and white paper: the
 * accent green sits between the two, where a grey light enough for the picture
 * would disappear into the paper.
 */
const WATERMARK_OPACITY = 0.14;

/**
 * Tile the Kelly Systems mark across a page, over whatever is already on it.
 *
 * Laid out from the middle of the sheet, the way the viewport's stylesheet
 * centres its own tiling, so the marks the edges cut through are cut evenly on
 * both sides.
 */
export function drawWatermark(p: Painter): void {
  const width = WATERMARK_MARK_WIDTH;
  const height = wordmarkHeight(width);
  const period = width * WATERMARK_PERIOD;
  const rowGap = width * WATERMARK_ROW_GAP;
  const columns = Math.ceil(PAGE_WIDTH / period / 2) + 1;
  const rows = Math.ceil(PAGE_HEIGHT / rowGap / 2) + 1;
  const centreX = (PAGE_WIDTH - width) / 2;
  const centreY = (PAGE_HEIGHT + height) / 2;
  for (let row = -rows; row <= rows; row++) {
    const top = centreY + row * rowGap;
    if (top < 0 || top - height > PAGE_HEIGHT) continue;
    const shift = Math.abs(row) % 2 === 0 ? 0 : period / 2;
    for (let column = -columns; column <= columns; column++) {
      const x = centreX + shift + column * period;
      if (x > PAGE_WIDTH || x + width < 0) continue;
      drawWordmark(p, x, top, { width, opacity: WATERMARK_OPACITY });
    }
  }
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
