import { describe, expect, it } from "vitest";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { extractStreams, extractText } from "@/test/pdf-text";
import { KELLY_WORDMARK_PATHS } from "@/data/kelly-systems-wordmark";
import { generateBomPdf } from "@/domain/bom-pdf";
import { designFromScene, emptyDesign } from "@/domain/design-state";
import { bomRows } from "@/domain/parts";
import { ACCENT } from "@/domain/pdf-typesetting";
import type { DesignMetadata, DesignState, Part } from "@/types";

/**
 * A 1x1 JPEG. Small enough to inline, and real enough that `embedJpg` parses
 * it — the point of the tests using it is that a view reaches the document at
 * all.
 */
const TINY_JPEG =
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a" +
  "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA" +
  "AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";

function shot(label: string) {
  return { label, jpeg: Uint8Array.from(atob(TINY_JPEG), (c) => c.charCodeAt(0)) };
}

/** How many images one page of a document draws. */
function imagesOn(doc: PDFDocument, index: number): number {
  const xobjects = doc.getPage(index).node.Resources()?.lookupMaybe(PDFName.of("XObject"), PDFDict);
  return xobjects ? xobjects.keys().length : 0;
}

/**
 * The operators of the page that typesets a given line, found by the line
 * itself: the writer encodes drawn text as hex, so both spellings are searched.
 */
function streamShowing(bytes: Uint8Array, text: string): string {
  const hex = Buffer.from(text, "latin1").toString("hex").toUpperCase();
  const stream = extractStreams(bytes).find((s) => s.includes(hex) || s.includes(text));
  if (stream === undefined) throw new Error(`no page draws "${text}"`);
  return stream;
}

/**
 * How many Kelly Systems marks a page's operators draw.
 *
 * The mark is filled path by path in the accent green, so the page's fills of
 * that colour divide by the artwork's path count — which is also the check that
 * nothing drew a partial mark.
 */
function marksOn(stream: string): number {
  const fill = `${ACCENT.red} ${ACCENT.green} ${ACCENT.blue} rg`;
  const fills = stream.split(fill).length - 1;
  expect(fills % KELLY_WORDMARK_PATHS.length).toBe(0);
  return fills / KELLY_WORDMARK_PATHS.length;
}

/**
 * The angles, in degrees, a page turns the artwork through.
 *
 * `drawSvgPath` writes each path as a translate, then a rotation, then the flip
 * that puts the artwork's downward y axis the PDF's way up — so a rotation
 * counts as the mark's when that flip is the operator after it.
 */
function turnsOn(stream: string): number[] {
  const matrices = [
    ...stream.matchAll(/(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) cm/g)
  ].map((m) => m.slice(1, 7).map(Number));
  const angles: number[] = [];
  matrices.forEach(([a, b, c, d, e, f], i) => {
    const isRotation = Math.abs(Math.hypot(a, b) - 1) < 1e-9 && a === d && b === -c && e === 0;
    const next = matrices[i + 1];
    const isFlip = next !== undefined && next[1] === 0 && next[2] === 0 && next[3] === -next[0];
    if (isRotation && f === 0 && isFlip)
      angles.push(Math.round((Math.atan2(b, a) * 180) / Math.PI));
  });
  return [...new Set(angles)].sort((x, y) => x - y);
}

const sampleParts: Part[] = [
  { id: "b", type: "blower", cell: [0, 0, 0], dir: [1, 0, 0] },
  { id: "t1", type: "terminal", cell: [1, 0, 0], axis: [1, 0, 0] },
  { id: "t2", type: "terminal", cell: [9, 0, 0], axis: [1, 0, 0] },
  // The run starts a foot past the terminal at [1, 0, 0]: it lies along X, so
  // [2, 0, 0] is its second foot (ADR-0027).
  { id: "u1", type: "tube", from: [3, 0, 0], to: [9, 0, 0] },
  {
    id: "n1",
    type: "bend",
    entry: [20.5, 0.5, 0.5],
    exit: [23.5, 0.5, 3.5],
    center: [20.5, 0.5, 3.5],
    inDir: [1, 0, 0],
    outDir: [0, 0, 1]
  }
];

function designWith(parts: Part[], metadata?: Partial<DesignMetadata>): DesignState {
  return designFromScene({ parts, obstacles: [] }, metadata);
}

describe("generateBomPdf", () => {
  it("produces a readable PDF", async () => {
    const bytes = await generateBomPdf(designWith(sampleParts));
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it("lists every part number the BOM has a quantity for", async () => {
    const design = designWith(sampleParts);
    const text = extractText(await generateBomPdf(design));
    for (const row of bomRows(design)) {
      if (row.qty === 0) continue;
      expect(text).toContain(row.partNo);
    }
  });

  it("carries the design's own dimensions", async () => {
    // Designs have no name, so the room is what identifies one document from
    // another; it has to survive onto the page.
    const design = designWith(sampleParts, { room: { width: 44, depth: 22, height: 11 } });
    const text = extractText(await generateBomPdf(design));
    expect(text).toContain("44");
    expect(text).toContain("22");
    expect(text).toContain("11");
  });

  it("names the product that generated it", async () => {
    const text = extractText(
      await generateBomPdf(designWith(sampleParts), { productName: "PTSBLite" })
    );
    expect(text).toContain("PTSBLite");
  });

  it("prints no money of any kind", async () => {
    // The defining constraint of PTSBLite. A currency symbol, a decimal
    // amount, or any of the quote's money headings reaching this document means
    // the separation has failed somewhere upstream (ADR-0011).
    const text = extractText(await generateBomPdf(designWith(sampleParts)));
    const drawn = [...text.matchAll(/\((.*?)\)\s*Tj/g)].map((m) => m[1]).join(" ");
    expect(drawn).not.toContain("$");
    expect(drawn).not.toMatch(/\d+\.\d{2}\b/);
    for (const heading of ["Subtotal", "Tax", "Total", "QUOTE", "Bill To", "EACH"]) {
      expect(drawn).not.toContain(heading);
    }
  });

  it("prints the control box the blower units imply, though nothing draws one", async () => {
    // The row exists only on the parts list (ADR-0038), so the PDF is the only
    // artifact that can be checked for it end to end.
    const text = extractText(await generateBomPdf(designWith(sampleParts)));
    expect(text).toContain("Control Box");
    expect(text).toContain("AEA751032");
  });

  it("leaves the control box off a design with no blower in it", async () => {
    const noBlower = sampleParts.filter((p) => p.type !== "blower");
    const text = extractText(await generateBomPdf(designWith(noBlower)));
    expect(text).not.toContain("AEA751032");
  });

  it("says so rather than printing an empty table for a design with no parts", async () => {
    const text = extractText(await generateBomPdf(emptyDesign()));
    expect(text).toContain("no parts yet");
  });
});

describe("the Kelly Systems letterhead on the parts list page", () => {
  it("draws the wordmark in the artwork's own green", async () => {
    // Vector, not an image: a mark that prints sharp at any size, and the one
    // thing on the page that has to be Kelly's green rather than near-black.
    const fill = `${ACCENT.red} ${ACCENT.green} ${ACCENT.blue} rg`;
    const bytes = await generateBomPdf(designWith(sampleParts));
    expect(streamShowing(bytes, "Bill of Materials")).toContain(fill);
  });

  it("carries the tagline banner, and carries it only here", async () => {
    // The later pages are the pictures of the system, and their own branding is
    // a watermark rather than a second copy of the footer.
    const doc = await PDFDocument.load(
      await generateBomPdf(designWith(sampleParts), {
        views: [shot("North-west"), shot("Top-down")]
      })
    );
    expect(imagesOn(doc, 0)).toBe(1);
    expect(imagesOn(doc, 1)).toBe(2);
  });

  it("leaves the parts list itself alone", async () => {
    // The branding is furniture around the table, so every row the BOM has a
    // quantity for still has to reach the page — and no price with it.
    const design = designWith(sampleParts);
    const text = extractText(await generateBomPdf(design));
    for (const row of bomRows(design)) {
      if (row.qty === 0) continue;
      expect(text).toContain(row.name);
      expect(text).toContain(row.partNo);
    }
  });
});

describe("the views appended to a BOM", () => {
  it("adds a page for every two views, after the parts list", async () => {
    const design = designWith(sampleParts);
    const plain = await PDFDocument.load(await generateBomPdf(design));
    const withViews = await PDFDocument.load(
      await generateBomPdf(design, {
        views: [shot("North-west"), shot("North-east"), shot("Top-down")]
      })
    );
    expect(plain.getPageCount()).toBe(1);
    expect(withViews.getPageCount()).toBe(3);
  });

  it("tiles the Kelly Systems logo across every page of pictures", async () => {
    // Three views make two pages, and the client asked for the mark on each of
    // them rather than once in the document — the artwork repeated small, the
    // way the viewport tiles it behind the build area, rather than one stamp.
    const bytes = await generateBomPdf(designWith(sampleParts), {
      views: [shot("North-west"), shot("North-east"), shot("Top-down")]
    });
    for (const label of ["North-west", "Top-down"]) {
      const marks = marksOn(streamShowing(bytes, label));
      expect(marks).toBeGreaterThan(1);
    }
  });

  it("runs the tiling across the 45 degree diagonal", async () => {
    // The stamp this replaced was turned 45 degrees and tiling it lost the
    // angle; the client asked for it back, so every mark on a page of pictures
    // is turned and the masthead's, which is not a watermark, is not.
    const bytes = await generateBomPdf(designWith(sampleParts), {
      views: [shot("North-west")]
    });
    expect(turnsOn(streamShowing(bytes, "North-west"))).toEqual([45]);
    expect(turnsOn(streamShowing(bytes, "Bill of Materials"))).toEqual([0]);
  });

  it("draws the watermark as the logo artwork, not the words", async () => {
    // What it replaced was "KELLY SYSTEMS" typeset across the diagonal. The
    // client asked for the real mark, so no page typesets the name any more.
    const text = extractText(
      await generateBomPdf(designWith(sampleParts), { views: [shot("North-west")] })
    );
    expect(text).not.toContain("KELLY SYSTEMS");
  });

  it("leaves the parts list page unstamped", async () => {
    // The first page carries the branding its own way — one mark, the
    // masthead's — and a document with no pictures in it gets no watermark.
    const bytes = await generateBomPdf(designWith(sampleParts));
    expect(marksOn(streamShowing(bytes, "Bill of Materials"))).toBe(1);
  });

  it("captions each view with the angle it was taken from", async () => {
    const bytes = await generateBomPdf(designWith(sampleParts), {
      views: [shot("North-west"), shot("Top-down")]
    });
    const text = extractText(Buffer.from(bytes));
    expect(text).toContain("North-west");
    expect(text).toContain("Top-down");
  });
});
