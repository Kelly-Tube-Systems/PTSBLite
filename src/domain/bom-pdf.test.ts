import { describe, expect, it } from "vitest";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { extractStreams, extractText } from "@/test/pdf-text";
import { KELLY_WORDMARK_PATHS } from "@/data/kelly-systems-wordmark";
import { generateBomPdf } from "@/domain/bom-pdf";
import type { ContactDetails } from "@/domain/contact-details";
import { designFromScene, emptyDesign } from "@/domain/design-state";
import { bomRows } from "@/domain/parts";
import { ACCENT, MARGIN_X } from "@/domain/pdf-typesetting";
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
 * A line only the parts list page draws, for finding that page's operators by.
 * The column heading rather than the document's own title: the title carries
 * the export date, which changes by the day.
 */
const PARTS_LIST_PAGE = "DESCRIPTION";

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

/**
 * Every line of text a page draws, with the point it was drawn at.
 *
 * The writer sets a text matrix per line and shows the line as hex, so a
 * page's typesetting can be read back as positioned strings — which is what
 * lets a test check that one block of the document sits clear of another.
 */
function drawnLines(stream: string): { x: number; y: number; text: string }[] {
  return [...stream.matchAll(/1 0 0 1 (-?[\d.]+) (-?[\d.]+) Tm\s*<([0-9A-Fa-f]+)>\s*Tj/g)].map(
    (m) => ({
      x: Number(m[1]),
      y: Number(m[2]),
      text: Buffer.from(m[3], "hex").toString("latin1")
    })
  );
}

/**
 * The top edge of the tagline banner, read off the page's own operators: the
 * image is placed at its bottom left and scaled by its drawn size, so the
 * translate and the scale together say where its top is.
 */
function bannerTop(stream: string): number {
  const at = stream.search(/\/Image-\S+ Do/);
  if (at < 0) throw new Error("no banner on the page");
  // An image is drawn into the unit square, so the block that draws one first
  // concatenates the matrices that put it where it goes: among them one
  // translate, to its bottom left corner, and one scale, the size it prints at.
  // The rest are identities.
  const matrices = [
    ...stream
      .slice(stream.lastIndexOf("q", at), at)
      .matchAll(/(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) cm/g)
  ].map((m) => m.slice(1, 7).map(Number));
  const bottom = matrices.find((m) => m[5] !== 0)?.[5];
  const height = matrices.find((m) => m[3] !== 1)?.[3];
  if (bottom === undefined || height === undefined) throw new Error("the banner is drawn at 0x0");
  return bottom + height;
}

/** The base font a page is set to where it draws `text`. */
function fontDrawing(doc: PDFDocument, bytes: Uint8Array, text: string): string {
  const stream = streamShowing(bytes, text);
  const hex = Buffer.from(text, "latin1").toString("hex").toUpperCase();
  const at = Math.max(stream.indexOf(hex), stream.indexOf(text));
  const settings = [...stream.slice(0, at).matchAll(/\/(\S+) [\d.]+ Tf/g)];
  const key = settings.at(-1)?.[1];
  if (key === undefined) throw new Error(`no font is set before "${text}"`);
  const fonts = doc.getPage(0).node.Resources()?.lookupMaybe(PDFName.of("Font"), PDFDict);
  return String(fonts?.lookupMaybe(PDFName.of(key), PDFDict)?.get(PDFName.of("BaseFont")));
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

  it("heads the page with the document's title, dated", async () => {
    // The client's own wording, with the date he wrote as "[date: 00/00/00]".
    const text = extractText(
      await generateBomPdf(designWith(sampleParts), {
        productName: "PTSBLite",
        date: "09/20/26"
      })
    );
    expect(text).toContain("Kelly Systems PTSBLite BOM 09/20/26");
  });

  it("carries the title in the PDF's own metadata too", async () => {
    // What a reader's viewer shows in its tab, and what a file manager reads.
    const doc = await PDFDocument.load(
      await generateBomPdf(designWith(sampleParts), { date: "09/20/26" })
    );
    expect(doc.getTitle()).toBe("Kelly Systems PTSBLite BOM 09/20/26");
  });

  it("prints the date once, in the title", async () => {
    // It used to sit against the right margin as well; two printings of one
    // date read as a mistake on a one-page document.
    const text = extractText(await generateBomPdf(designWith(sampleParts), { date: "09/20/26" }));
    expect(text.split("09/20/26").length - 1).toBe(1);
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

  it("prints the straight tube quantity as units and feet", async () => {
    // The client orders tube by the foot (2026-09-21), and the PDF is the copy
    // that reaches Kelly, so the QTY column carries both figures. The sample
    // run is one 6 ft length; bom.test.ts covers the arithmetic over several.
    const text = extractText(await generateBomPdf(designWith(sampleParts)));
    expect(text).toContain("1/(6ft)");
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
    expect(streamShowing(bytes, PARTS_LIST_PAGE)).toContain(fill);
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

  it("says how to reach Kelly Systems", async () => {
    // The client's five details, in his own spelling: a printed sheet that
    // carries the mark and no way to act on it was the thing he asked to fix.
    const text = extractText(await generateBomPdf(designWith(sampleParts)));
    for (const detail of [
      "Kelly Systems, Inc.",
      "422 N. Western Avenue",
      "Chicago, IL 60612-1491",
      "sales@kellytubesystems.com",
      "312.733.3224"
    ]) {
      expect(text).toContain(detail);
    }
  });

  it("carries the contact details on the parts list page alone", async () => {
    // The pages of pictures are branded by the watermark; a second copy of the
    // address on each of them would be a letterhead repeated mid-document.
    const bytes = await generateBomPdf(designWith(sampleParts), {
      views: [shot("North-west"), shot("Top-down")]
    });
    expect(streamShowing(bytes, PARTS_LIST_PAGE)).toBe(
      streamShowing(bytes, "sales@kellytubesystems.com")
    );
    expect(extractText(bytes).split("312.733.3224").length - 1).toBe(1);
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

describe("the client's disclaimer on the parts list", () => {
  /**
   * His wording, spelled out here rather than imported from the module: the
   * whole point of the card is that what he wrote reaches the sheet unedited,
   * and a test that imported the same constant could not tell us that.
   */
  const DISCLAIMER =
    "The BOM is to give a rough idea of what a KEL2020 system might look like and rough idea " +
    "of the pieces involved. This tool may allow systems and scenarios that cannot exist in " +
    "real life. To better understand your project's needs, please reach out to KELLY TUBE " +
    "SYSTEMS so we can discuss your specific application.";

  /**
   * A long system in a room the size of the whole build area, so every row of
   * the parts list carries its largest quantity and its note.
   */
  const longRun: Part[] = [
    { id: "b1", type: "blower", cell: [-140, 0, 0], dir: [1, 0, 0] },
    { id: "t1", type: "terminal", cell: [-139, 0, 0], axis: [1, 0, 0] },
    { id: "u1", type: "tube", from: [-137, 0, 0], to: [139, 0, 0] },
    { id: "t2", type: "terminal", cell: [140, 0, 0], axis: [1, 0, 0] }
  ];
  const bigRoom = { room: { width: 300, depth: 300, height: 12 } };

  it("prints it word for word, though it is set over several lines", async () => {
    // Wrapped to the measure, so the sheet shows it as a block of lines; closing
    // those back up has to give back exactly what he wrote, capitals and all.
    const text = extractText(await generateBomPdf(designWith(sampleParts)));
    expect(text.split("\n").join(" ")).toContain(DISCLAIMER);
  });

  it("sets it in italics, as he asked", async () => {
    const bytes = await generateBomPdf(designWith(sampleParts));
    const doc = await PDFDocument.load(bytes);
    expect(fontDrawing(doc, bytes, "The BOM is to give a rough idea")).toBe("/Helvetica-Oblique");
  });

  it.each([
    ["a short design", sampleParts, undefined],
    ["a long one", longRun, bigRoom]
  ])("keeps it between the parts list and the banner on %s", async (_case, parts, metadata) => {
    // It is laid out up from the foot of the sheet rather than down from the
    // last row, so the taller list is the one that would collide with it.
    const bytes = await generateBomPdf(designWith(parts, metadata));
    const stream = streamShowing(bytes, PARTS_LIST_PAGE);
    const lines = drawnLines(stream);
    const disclaimer = lines.filter((l) => l.text.length > 20 && DISCLAIMER.includes(l.text));
    // Everything the sheet says above the banner: the letterhead and the parts
    // list. The "Generated with" line is under it and is not in the comparison.
    const above = lines.filter(
      (l) => !disclaimer.includes(l) && !l.text.startsWith("Generated with")
    );

    expect(disclaimer.length).toBeGreaterThan(1);
    expect(Math.max(...disclaimer.map((l) => l.y))).toBeLessThan(
      Math.min(...above.map((l) => l.y))
    );
    expect(Math.min(...disclaimer.map((l) => l.y))).toBeGreaterThan(bannerTop(stream));
    // And inside the margins, which is what says the wrapping measured right.
    expect(Math.min(...disclaimer.map((l) => l.x))).toBeGreaterThan(MARGIN_X);
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
    expect(turnsOn(streamShowing(bytes, PARTS_LIST_PAGE))).toEqual([0]);
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
    expect(marksOn(streamShowing(bytes, PARTS_LIST_PAGE))).toBe(1);
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

describe("who the BOM was prepared for", () => {
  const ada: ContactDetails = {
    firstName: "Ada",
    lastName: "Lovelace",
    company: "Analytical Engines",
    phone: "555-0100",
    email: "ada@example.com",
    industry: "Medical",
    comments: "Two stations on the second floor."
  };

  it("prints every detail the contact form took", async () => {
    const text = extractText(await generateBomPdf(designWith(sampleParts), { customer: ada }));
    expect(text).toContain("PREPARED FOR");
    for (const value of [
      "Ada Lovelace",
      "Analytical Engines",
      "555-0100",
      "ada@example.com",
      "Medical",
      "Two stations on the second floor."
    ]) {
      expect(text).toContain(value);
    }
  });

  it("prints it on the parts list page", async () => {
    const bytes = await generateBomPdf(designWith(sampleParts), {
      customer: ada,
      views: [shot("Front")]
    });
    expect(streamShowing(bytes, "ada@example.com")).toBe(streamShowing(bytes, PARTS_LIST_PAGE));
  });

  it("leaves the space blank without details, and without comments prints none", async () => {
    const without = extractText(await generateBomPdf(designWith(sampleParts)));
    expect(without).not.toContain("PREPARED FOR");

    const quiet = extractText(
      await generateBomPdf(designWith(sampleParts), { customer: { ...ada, comments: "" } })
    );
    expect(quiet).toContain("Ada Lovelace");
    expect(quiet).not.toContain("Comments");
  });

  it("cuts long comments short rather than running into the disclaimer", async () => {
    // The long run's parts list is the tallest the sheet draws, and the form
    // puts no limit on the comments.
    const longRun: Part[] = [
      { id: "b1", type: "blower", cell: [-140, 0, 0], dir: [1, 0, 0] },
      { id: "t1", type: "terminal", cell: [-139, 0, 0], axis: [1, 0, 0] },
      { id: "u1", type: "tube", from: [-137, 0, 0], to: [139, 0, 0] },
      { id: "t2", type: "terminal", cell: [140, 0, 0], axis: [1, 0, 0] }
    ];
    const comments = "We need a system for every floor of the building. ".repeat(40);
    const bytes = await generateBomPdf(
      designWith(longRun, { room: { width: 300, depth: 300, height: 12 } }),
      { customer: { ...ada, comments } }
    );
    const lines = drawnLines(streamShowing(bytes, PARTS_LIST_PAGE));
    const disclaimerTop = Math.max(
      ...lines.filter((l) => l.text.startsWith("The BOM is to give")).map((l) => l.y)
    );
    const commentLines = lines.filter((l) => l.text.startsWith("We need a system"));

    expect(commentLines.length).toBeGreaterThan(1);
    expect(commentLines.at(-1)?.text.endsWith("\x85")).toBe(true);
    expect(Math.min(...commentLines.map((l) => l.y))).toBeGreaterThan(disclaimerTop);
  });
});
