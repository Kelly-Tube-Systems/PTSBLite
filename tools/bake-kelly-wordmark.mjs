#!/usr/bin/env node
/**
 * Bake the Kelly Systems wordmark into path data the PDF can draw.
 *
 * Reads `src/assets/kelly-systems-watermark.svg` — the viewport's watermark
 * tile, and the only Kelly Systems wordmark artwork in the repository — and
 * writes `src/data/kelly-systems-wordmark.ts`.
 *
 * Two things have to change on the way through, which is why this is a bake and
 * not an import. The tile lays the mark out three times through `<use>`, so one
 * copy has to be lifted out of the `<symbol>`; and most of the mark sits inside
 * a `<g transform="translate(0,158) scale(0.01,-0.01)">` — the signature of a
 * traced outline — whose flip and scale `pdf-lib` has no way to apply. The
 * transform is folded into the coordinates here instead, leaving path data in
 * the artwork's own 1316 x 158 box with y running down, which is what both SVG
 * and `drawSvgPath` expect.
 *
 * Hand-run, like the CAD bake beside it (ADR-0033):
 *
 *   node tools/bake-kelly-wordmark.mjs
 *
 * Pass `--svg <path>` to also write a single mark back out as SVG, which is how
 * the baked paths get checked against the artwork by eye.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SOURCE = resolve(ROOT, "src/assets/kelly-systems-watermark.svg");
const OUT = resolve(ROOT, "src/data/kelly-systems-wordmark.ts");

/** Every path command the artwork uses. Anything else stops the bake. */
const ARGC = { M: 2, m: 2, l: 2, c: 6, H: 1, V: 1, L: 2, Z: 0, z: 0 };

const TOKEN = /([A-Za-z])|(-?\d*\.?\d+(?:e-?\d+)?)/g;

function tokenize(d) {
  const out = [];
  for (const [, letter, number] of d.matchAll(TOKEN)) {
    out.push(letter ?? Number(number));
  }
  return out;
}

/** Trim a baked coordinate: the scale is 1/100 of an integer grid. */
function round(n) {
  return Number(n.toFixed(2));
}

/**
 * Apply `translate(0, height) scale(scale, -scale)` to one path's coordinates.
 *
 * Absolute coordinates take the whole transform; relative ones are deltas, so
 * they take the scale and the flip but not the translation.
 */
function flatten(d, { scale, height }) {
  const tokens = tokenize(d);
  const out = [];
  let command = null;
  for (let i = 0; i < tokens.length;) {
    if (typeof tokens[i] === "string") {
      command = tokens[i];
      if (!(command in ARGC)) throw new Error(`unhandled path command "${command}"`);
      out.push(command);
      i += 1;
      continue;
    }
    if (command === null) throw new Error("path data starts with a coordinate");
    const argc = ARGC[command];
    const args = tokens.slice(i, i + argc);
    i += argc;
    if (command === "M") {
      out.push(round(scale * args[0]), round(height - scale * args[1]));
    } else if (command === "H" || command === "V") {
      throw new Error(`"${command}" cannot be flattened without tracking the current point`);
    } else {
      // Deltas, in x/y pairs: "c" carries three of them.
      for (let k = 0; k < args.length; k += 2) {
        out.push(round(scale * args[k]), round(-scale * args[k + 1]));
      }
    }
  }
  return out;
}

/** Re-emit tokens as path data, with the minimum punctuation SVG needs. */
function serialize(tokens) {
  let out = "";
  for (const token of tokens) {
    if (typeof token === "string") {
      out += token;
      continue;
    }
    const text = String(token);
    const needsSeparator = out.length > 0 && !/[A-Za-z]$/.test(out) && !text.startsWith("-");
    out += (needsSeparator ? " " : "") + text;
  }
  return out;
}

function parseTransform(attribute) {
  const translate = /translate\(([-\d.]+),\s*([-\d.]+)\)/.exec(attribute);
  const scale = /scale\(([-\d.]+),\s*([-\d.]+)\)/.exec(attribute);
  if (!translate || !scale) throw new Error(`unrecognised transform "${attribute}"`);
  const [, tx, ty] = translate.map(Number);
  const [, sx, sy] = scale.map(Number);
  if (tx !== 0 || sx !== -sy) {
    throw new Error(`transform "${attribute}" is not a y-flip about a horizontal axis`);
  }
  return { scale: sx, height: ty };
}

const svg = readFileSync(SOURCE, "utf-8");

const symbol = /<symbol id="mark"[^>]*viewBox="0 0 (\d+) (\d+)"[\s\S]*?<\/symbol>/.exec(svg);
if (!symbol) throw new Error('no <symbol id="mark"> with a viewBox in the artwork');
const [, width, height] = symbol.map(Number);
const body = symbol[0];

const group = /<g transform="([^"]*)"[^>]*>([\s\S]*?)<\/g>/.exec(body);
if (!group) throw new Error("no transformed <g> in the mark");

const paths = [];
for (const [, d] of body.slice(0, body.indexOf("<g ")).matchAll(/<path d="([^"]*)"/g)) {
  paths.push(d);
}
const transform = parseTransform(group[1]);
for (const [, d] of group[2].matchAll(/<path d="([^"]*)"/g)) {
  paths.push(serialize(flatten(d, transform)));
}

const source = `/**
 * The Kelly Systems wordmark, as path data in its own 1316 x ${height} box with y
 * running down — the coordinates SVG uses, and the ones \`pdf-lib\`'s
 * \`drawSvgPath\` consumes unchanged.
 *
 * Generated by \`tools/bake-kelly-wordmark.mjs\` from
 * \`src/assets/kelly-systems-watermark.svg\`, the viewport watermark tile that
 * holds the same artwork. Do not edit by hand: re-run the bake.
 *
 * Path data rather than the asset itself, for ADR-0034's reason — the mark is
 * drawn by a synchronous painter that has nowhere to await an image decode, and
 * a few kilobytes of outline stays sharp at any size the document prints at.
 */
export const KELLY_WORDMARK_BOX = { width: ${width}, height: ${height} } as const;

/** Filled with a single colour, in order, non-zero winding. */
export const KELLY_WORDMARK_PATHS: readonly string[] = [
${paths.map((d) => `  "${d}"`).join(",\n")}
];
`;

writeFileSync(OUT, source);
process.stdout.write(`${OUT}: ${paths.length} paths\n`);

const svgFlag = process.argv.indexOf("--svg");
if (svgFlag !== -1) {
  const target = process.argv[svgFlag + 1];
  if (!target) throw new Error("--svg needs a path to write");
  writeFileSync(
    target,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n` +
      paths.map((d) => `  <path d="${d}" />`).join("\n") +
      `\n</svg>\n`
  );
  process.stdout.write(`${target}: one mark, for checking by eye\n`);
}
