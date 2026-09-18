import { degrees, rgb, type Color, type PDFFont, type PDFPage } from "pdf-lib";
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
 * at (x, y), turned `angle` degrees anticlockwise about that corner.
 *
 * Vector rather than an image, for ADR-0034's reason: an outline stays sharp at
 * whatever size the document prints or is zoomed to. `drawSvgPath` takes the
 * artwork's own coordinates, y running down from (x, y), unchanged.
 */
export function drawWordmark(
  p: Painter,
  x: number,
  y: number,
  opts: { width: number; color?: Color; opacity?: number; angle?: number }
): void {
  const scale = opts.width / KELLY_WORDMARK_BOX.width;
  const rotate = degrees(opts.angle ?? 0);
  for (const path of KELLY_WORDMARK_PATHS) {
    p.page.drawSvgPath(path, {
      x,
      y,
      scale,
      rotate,
      color: opts.color ?? ACCENT,
      opacity: opts.opacity
    });
  }
}

/** A mark's height, at a given width. */
export function wordmarkHeight(width: number): number {
  return width * (KELLY_WORDMARK_BOX.height / KELLY_WORDMARK_BOX.width);
}

/**
 * How wide one mark of the watermark prints. A little over a quarter of the
 * sheet: big enough to read as the logo when it catches the eye, small enough
 * that several fall on a page and none of them asks to be read.
 */
const WATERMARK_MARK_WIDTH = 170;
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
 * How far the brick course is opened out beyond the artwork's own spacing. The
 * viewport's tiling is behind an empty workspace and can afford to be busy; a
 * page of pictures cannot, and the client asked for fewer marks on it. Applied
 * to both axes, so the pattern stretches without shearing.
 */
const WATERMARK_SPACING = 1.25;
/**
 * Faint enough to read the page through, strong enough to survive a
 * photocopier. The pictures are rendered on the viewport's near-black
 * background, so the mark has to show against both that and white paper: the
 * accent green sits between the two, where a grey light enough for the picture
 * would disappear into the paper.
 */
const WATERMARK_OPACITY = 0.1;
/**
 * The angle a stamped mark is read at, and the one the client asked this to
 * keep when it stopped being a single "SAMPLE"-style stamp and became a tiling.
 */
const WATERMARK_ANGLE = 45;

/**
 * Tile the Kelly Systems mark across a page, over whatever is already on it.
 *
 * The brick course runs on the 45° diagonal, so it is laid out in the mark's
 * own frame and turned into the page's: `along` is the direction the mark
 * reads, `down` the direction its rows stack, both unit vectors. Laid out from
 * the middle of the sheet, the way the viewport's stylesheet centres its own
 * tiling, so the marks the edges cut through are cut evenly on both sides.
 */
export function drawWatermark(p: Painter): void {
  const width = WATERMARK_MARK_WIDTH;
  const height = wordmarkHeight(width);
  const period = width * WATERMARK_PERIOD * WATERMARK_SPACING;
  const rowGap = width * WATERMARK_ROW_GAP * WATERMARK_SPACING;

  const radians = (WATERMARK_ANGLE * Math.PI) / 180;
  // `drawSvgPath` translates to the anchor, turns, then flips the artwork's
  // y axis — so the mark reads along (cos, sin) and its rows stack along
  // (sin, -cos), which at 0° is the plain left-to-right, top-down layout.
  const along = { x: Math.cos(radians), y: Math.sin(radians) };
  const down = { x: Math.sin(radians), y: -Math.cos(radians) };

  // A turned lattice no longer lines up with the page's edges, so it is spread
  // over the disc that contains the sheet rather than over its width and
  // height, and each mark is culled on where it actually lands.
  const reach = Math.hypot(PAGE_WIDTH, PAGE_HEIGHT) / 2 + width;
  const columns = Math.ceil(reach / period);
  const rows = Math.ceil(reach / rowGap);
  const originX = PAGE_WIDTH / 2 - (along.x * width + down.x * height) / 2;
  const originY = PAGE_HEIGHT / 2 - (along.y * width + down.y * height) / 2;

  for (let row = -rows; row <= rows; row++) {
    const shift = Math.abs(row) % 2 === 0 ? 0 : period / 2;
    for (let column = -columns; column <= columns; column++) {
      const step = shift + column * period;
      const x = originX + along.x * step + down.x * row * rowGap;
      const y = originY + along.y * step + down.y * row * rowGap;
      if (!markTouchesPage(x, y, width, height, along, down)) continue;
      drawWordmark(p, x, y, {
        width,
        opacity: WATERMARK_OPACITY,
        angle: WATERMARK_ANGLE
      });
    }
  }
}

type Vector = { x: number; y: number };

/** Whether a mark anchored at (x, y) puts any of its box on the sheet. */
function markTouchesPage(
  x: number,
  y: number,
  width: number,
  height: number,
  along: Vector,
  down: Vector
): boolean {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [u, v] of [
    [0, 0],
    [width, 0],
    [0, height],
    [width, height]
  ]) {
    xs.push(x + along.x * u + down.x * v);
    ys.push(y + along.y * u + down.y * v);
  }
  return (
    Math.min(...xs) <= PAGE_WIDTH &&
    Math.max(...xs) >= 0 &&
    Math.min(...ys) <= PAGE_HEIGHT &&
    Math.max(...ys) >= 0
  );
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
