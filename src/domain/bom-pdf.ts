import { PDFDocument, StandardFonts, type PDFPage } from "pdf-lib";
import taglineDataUrl from "@/assets/kelly-it-tagline.png?inline";
import { bomRows, totalPathLength } from "@/domain/parts";
import {
  ACCENT,
  BAND,
  DIM,
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
  wordmarkHeight
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
/** Between the mark and the rule under it. */
const MASTHEAD_RULE_GAP = 13;
/** Between the two lines of the masthead rule, thick over thin. */
const MASTHEAD_RULE_SPACING = 3.5;
const BANNER_WIDTH = 320;

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
  const mono = await doc.embedFont(StandardFonts.Courier);
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const p: Painter = { page, sans, sansBold, mono };

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
    drawRightText(p, String(row.qty), qtyRight, y, { size: 10, font: mono });
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

  await drawTaglineBanner(doc, page);

  drawText(p, `Generated with ${productName}`, MARGIN_X, MARGIN_TOP - 20, {
    size: 8,
    color: MUT
  });

  await drawViewPages(doc, p, options.views ?? []);

  return await doc.save({ useObjectStreams: false });
}

/**
 * The Kelly Systems mark centred at the head of the page, over a rule.
 *
 * Vector, from the same artwork the viewport's background watermark is drawn
 * from (`src/data/kelly-systems-wordmark.ts`), so it stays sharp however far a
 * reader zooms into the PDF or however finely it prints.
 *
 * Returns the y the document's own first line sits under.
 */
function drawMasthead(p: Painter): number {
  const top = PAGE_HEIGHT - WORDMARK_TOP_GAP;
  drawWordmark(p, (PAGE_WIDTH - WORDMARK_WIDTH) / 2, top, { width: WORDMARK_WIDTH });

  // Thick over thin: the pair of rules is what makes a sheet read as issued
  // stationery rather than something typed up.
  const rule = top - wordmarkHeight(WORDMARK_WIDTH) - MASTHEAD_RULE_GAP;
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
 */
async function drawTaglineBanner(doc: PDFDocument, page: PDFPage): Promise<void> {
  const image = await doc.embedPng(assetBytes(taglineDataUrl));
  const height = (image.height / image.width) * BANNER_WIDTH;
  page.drawImage(image, {
    x: (PAGE_WIDTH - BANNER_WIDTH) / 2,
    y: MARGIN_TOP,
    width: BANNER_WIDTH,
    height
  });
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
