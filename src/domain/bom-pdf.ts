import { PDFDocument, StandardFonts, type PDFPage } from "pdf-lib";
import taglineDataUrl from "@/assets/kelly-it-tagline.png?inline";
import { bomRows, totalPathLength } from "@/domain/parts";
import {
  ACCENT,
  BAND,
  DIM,
  drawCenteredText,
  drawRightText,
  drawText,
  drawWatermark,
  drawWordmark,
  formatDocumentDate,
  HAIRLINE,
  MARGIN_TOP,
  MARGIN_X,
  MUT,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  type Painter,
  wordmarkHeight,
  wrapText
} from "@/domain/pdf-typesetting";
import { MAX_CENTERLINE_FEET } from "@/domain/validation";
import type { DesignState } from "@/types";

/** One rendered view of the design, as JPEG bytes, with the angle it was taken from. */
export type BomPdfView = { label: string; jpeg: Uint8Array };

export type BomPdfOptions = {
  /** Defaults to today. */
  date?: string;
  /** Named on the document, so a reader knows which tool produced it. */
  productName?: string;
  /**
   * Pictures of the system to append after the parts list. The client asked
   * for these so the document says what was built and not only what it is made
   * of. Empty, and the document is the parts list alone.
   */
  views?: BomPdfView[];
};

/**
 * What the document calls itself: its heading, its PDF title, and the name it
 * downloads under, all one line so the three cannot drift apart.
 *
 * The client's wording, with the date he wrote as `[date: 00/00/00]`: "Kelly
 * Systems PTSBLite BOM [date: 00/00/00]". The date it carries is the date the
 * BOM was exported, which is why nothing else on the page prints one.
 */
export function bomDocumentTitle(productName: string, date = formatDocumentDate()): string {
  return `Kelly Systems ${productName} BOM ${date}`;
}

/** How wide a view is drawn, centred, with room for two on a page. */
const VIEW_WIDTH = 460;
const VIEW_GAP = 26;
const VIEW_LABEL_GAP = 22;
const VIEWS_PER_PAGE = 2;

/**
 * The letterhead, in the client's words: "the logo at the top center, and the
 * 'don't Carey' image as the footer, and maybe adding other elements to give it
 * a very 'official' look".
 *
 * The mark prints narrower than the text column and the banner narrower still,
 * so neither competes with the parts list — the page is a bill of materials
 * that says who issued it, not a poster.
 */
const WORDMARK_WIDTH = 168;
/** From the top of the sheet to the top of the mark. */
const WORDMARK_TOP_GAP = 40;
/** Between the letterhead's last line and the rule under it. */
const MASTHEAD_RULE_GAP = 13;
/** Between the two lines of the masthead rule, thick over thin. */
const MASTHEAD_RULE_SPACING = 3.5;
const BANNER_WIDTH = 320;

/**
 * How to reach Kelly Systems, which the client asked to have on the sheet: a
 * reader handed a printed BOM had the mark at the top of it and no way to act
 * on what it said.
 *
 * His five details, in his own spelling down to the ZIP+4 and the dotted phone
 * number, set on two centred lines rather than five: this is the head of a
 * one-page parts list, and a five-line address block there costs the table more
 * room than it is worth. The middle dot is the separator the parts list already
 * uses ("Straight Tube · 6ft").
 */
const CONTACT_LINES = [
  "Kelly Systems, Inc. · 422 N. Western Avenue · Chicago, IL 60612-1491",
  "sales@kellytubesystems.com · 312.733.3224"
] as const;
/** Small enough to read as stationery rather than as a line of the document. */
const CONTACT_SIZE = 7.5;
/** From the foot of the mark to the first line's baseline. */
const CONTACT_TOP_GAP = 14;
/** Between the contact lines' baselines. */
const CONTACT_LEADING = 10;

/**
 * What the sheet says about itself, in the client's words and his capitals.
 *
 * The BOM prints what the app built, and nothing on it said that the app is a
 * sketching tool or that what it lets a user build is not always buildable. He
 * asked for that said on the sheet itself, and gave the wording — so it is
 * quoted, not tidied.
 */
export const DISCLAIMER =
  "The BOM is to give a rough idea of what a KEL2020 system might look like and rough idea of " +
  "the pieces involved. This tool may allow systems and scenarios that cannot exist in real " +
  "life. To better understand your project's needs, please reach out to KELLY TUBE SYSTEMS so " +
  "we can discuss your specific application.";

/**
 * The measure the disclaimer wraps to: the banner's width and a little over,
 * which sets the note as a block over the banner rather than as a paragraph
 * running the full width of the parts table above it.
 */
const DISCLAIMER_WIDTH = 400;
/** A footnote's size — the stationery's, not the document's. */
const DISCLAIMER_SIZE = 7.5;
const DISCLAIMER_LEADING = 10;
/** Between the disclaimer's last baseline and the top edge of the banner. */
const DISCLAIMER_BANNER_GAP = 16;

/**
 * Render a design's bill of materials to PDF bytes.
 *
 * `BomRow` cannot carry prices, so this document cannot expose commercial
 * information. See ADR-0011.
 */
export async function generateBomPdf(
  design: DesignState,
  options: BomPdfOptions = {}
): Promise<Uint8Array> {
  const date = options.date ?? formatDocumentDate();
  const productName = options.productName ?? "PTSBLite";
  const rows = bomRows(design).filter((row) => row.qty > 0);

  const title = bomDocumentTitle(productName, date);

  const doc = await PDFDocument.create();
  doc.setTitle(title);
  // Standard fonts, encoded WinAnsi — see ADR-0004 and `sanitize`.
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const sansBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const mono = await doc.embedFont(StandardFonts.Courier);
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const p: Painter = { page, sans, sansBold, italic, mono };

  const right = PAGE_WIDTH - MARGIN_X;
  let y = drawMasthead(p) - 30;

  drawText(p, title, MARGIN_X, y, { size: 20, font: sansBold });
  y -= 26;

  const { width, depth, height } = design.metadata.room;
  const floors = design.metadata.multiFloor ? " · 2 floors" : "";
  drawText(p, `Room ${width} x ${depth} x ${height} ft${floors}`, MARGIN_X, y, {
    size: 9,
    color: DIM
  });
  drawRightText(
    p,
    `Centerline ${totalPathLength(design).toFixed(1)} ft of ${MAX_CENTERLINE_FEET} ft`,
    right,
    y,
    { size: 9, color: DIM }
  );
  y -= 22;

  page.drawLine({
    start: { x: MARGIN_X, y },
    end: { x: right, y },
    thickness: 1,
    color: HAIRLINE
  });
  y -= 18;

  const qtyRight = right;
  const partNoX = MARGIN_X + 250;
  // A washed band behind the column headings, bled past the text column on both
  // sides so it reads as a ruled form rather than a shaded word.
  page.drawRectangle({
    x: MARGIN_X - 6,
    y: y - 5,
    width: right - MARGIN_X + 12,
    height: 18,
    color: BAND
  });
  drawText(p, "DESCRIPTION", MARGIN_X, y, { size: 8, color: MUT });
  drawText(p, "PART NO.", partNoX, y, { size: 8, color: MUT });
  drawRightText(p, "QTY", qtyRight, y, { size: 8, color: MUT });
  y -= 14;

  for (const row of rows) {
    drawText(p, row.name, MARGIN_X, y, { size: 10 });
    drawText(p, row.partNo, partNoX, y, { size: 9, font: mono, color: DIM });
    drawRightText(p, row.qtyLabel ?? String(row.qty), qtyRight, y, { size: 10, font: mono });
    y -= 13;
    if (row.note) {
      drawText(p, row.note, MARGIN_X, y, { size: 8, color: MUT });
      y -= 12;
    }
    y -= 3;
  }

  if (rows.length === 0) {
    drawText(p, "This design has no parts yet.", MARGIN_X, y, { size: 10, color: MUT });
    y -= 16;
  }

  y -= 6;
  page.drawLine({
    start: { x: MARGIN_X, y },
    end: { x: right, y },
    thickness: 1,
    color: HAIRLINE
  });

  const bannerTop = await drawTaglineBanner(doc, page);
  drawDisclaimer(p, bannerTop);

  drawText(p, `Generated with ${productName}`, MARGIN_X, MARGIN_TOP - 20, {
    size: 8,
    color: MUT
  });

  await drawViewPages(doc, p, options.views ?? []);

  return await doc.save({ useObjectStreams: false });
}

/**
 * The Kelly Systems mark centred at the head of the page, with the company's
 * contact details under it, over a rule.
 *
 * Vector, from the same artwork the viewport's background watermark is drawn
 * from (`src/data/kelly-systems-wordmark.ts`), so it stays sharp however far a
 * reader zooms into the PDF or however finely it prints.
 *
 * The contact lines print the same on every BOM — they are Kelly's own details,
 * not anything a design decides — and they take their room from the letterhead
 * rather than from the parts table, which keeps the space it had.
 *
 * Returns the y the document's own first line sits under.
 */
function drawMasthead(p: Painter): number {
  const top = PAGE_HEIGHT - WORDMARK_TOP_GAP;
  drawWordmark(p, (PAGE_WIDTH - WORDMARK_WIDTH) / 2, top, { width: WORDMARK_WIDTH });

  let baseline = top - wordmarkHeight(WORDMARK_WIDTH) - CONTACT_TOP_GAP;
  for (const line of CONTACT_LINES) {
    drawCenteredText(p, line, PAGE_WIDTH / 2, baseline, { size: CONTACT_SIZE, color: DIM });
    baseline -= CONTACT_LEADING;
  }
  // The loop leaves the baseline one line past the last one it drew.
  const lastLine = baseline + CONTACT_LEADING;

  // Thick over thin: the pair of rules is what makes a sheet read as issued
  // stationery rather than something typed up.
  const rule = lastLine - MASTHEAD_RULE_GAP;
  const right = PAGE_WIDTH - MARGIN_X;
  p.page.drawLine({
    start: { x: MARGIN_X, y: rule },
    end: { x: right, y: rule },
    thickness: 2.5,
    color: ACCENT
  });
  p.page.drawLine({
    start: { x: MARGIN_X, y: rule - MASTHEAD_RULE_SPACING },
    end: { x: right, y: rule - MASTHEAD_RULE_SPACING },
    thickness: 0.75,
    color: ACCENT
  });
  return rule - MASTHEAD_RULE_SPACING;
}

/**
 * The "Don't carry it... Kelly it." banner across the foot of the parts list —
 * the artwork the Quick Start Guide shows, which is the one the client asked
 * for here by name.
 *
 * The bytes are inlined at build time rather than fetched: this module is the
 * document, and a PDF that has to wait on a network round trip for its
 * letterhead is a PDF that can fail to download.
 *
 * Returns the banner's top edge, which is what the disclaimer sits above.
 */
async function drawTaglineBanner(doc: PDFDocument, page: PDFPage): Promise<number> {
  const image = await doc.embedPng(assetBytes(taglineDataUrl));
  const height = (image.height / image.width) * BANNER_WIDTH;
  page.drawImage(image, {
    x: (PAGE_WIDTH - BANNER_WIDTH) / 2,
    y: MARGIN_TOP,
    width: BANNER_WIDTH,
    height
  });
  return MARGIN_TOP + height;
}

/**
 * The client's disclaimer, centred in italics in the space between the parts
 * list and the banner.
 *
 * Laid out upwards from the banner rather than downwards from the last parts
 * row: it belongs to the foot of the sheet, and the table above it varies in
 * height with the design. The table cannot reach it — the BOM has one row per
 * part type, six of them, so its foot sits some 300 points clear even when
 * every row carries a note.
 *
 * Grey and small, so it reads as a footnote about the parts list rather than as
 * a line of it. It is a note about what the tool can express, not terms of sale:
 * the document still carries no prices (ADR-0011).
 */
function drawDisclaimer(p: Painter, bannerTop: number): void {
  const lines = wrapText(p.italic, DISCLAIMER, DISCLAIMER_SIZE, DISCLAIMER_WIDTH);
  let baseline = bannerTop + DISCLAIMER_BANNER_GAP + (lines.length - 1) * DISCLAIMER_LEADING;
  for (const line of lines) {
    drawCenteredText(p, line, PAGE_WIDTH / 2, baseline, {
      size: DISCLAIMER_SIZE,
      font: p.italic,
      color: DIM
    });
    baseline -= DISCLAIMER_LEADING;
  }
}

/** The bytes behind a `?inline` asset import, which arrives as a data URL. */
function assetBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

/**
 * The pictures of the system, two to a page after the parts list.
 *
 * Each is captioned with the angle it was taken from, which is what makes a
 * page of five near-identical shaded boxes navigable — and the captions match
 * the View menu, so a reader can put the model on screen in the same pose.
 *
 * The watermark goes on last, so it lies over the pictures rather than behind
 * them: a JPEG has no transparency, and a mark under one would only show in
 * the margins around it. It goes on these pages only: the parts list is the
 * page people work from, and it carries the branding its own way — the
 * letterhead above.
 */
async function drawViewPages(doc: PDFDocument, p: Painter, views: BomPdfView[]): Promise<void> {
  const x = (PAGE_WIDTH - VIEW_WIDTH) / 2;
  for (let i = 0; i < views.length; i += VIEWS_PER_PAGE) {
    const page: PDFPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const painter: Painter = { ...p, page };
    let y = PAGE_HEIGHT - MARGIN_TOP;
    for (const view of views.slice(i, i + VIEWS_PER_PAGE)) {
      const image = await doc.embedJpg(view.jpeg);
      const height = (image.height / image.width) * VIEW_WIDTH;
      drawText(painter, view.label, x, y - 9, { size: 9, color: MUT });
      y -= VIEW_LABEL_GAP;
      page.drawImage(image, { x, y: y - height, width: VIEW_WIDTH, height });
      y -= height + VIEW_GAP;
    }
    drawWatermark(painter);
  }
}
