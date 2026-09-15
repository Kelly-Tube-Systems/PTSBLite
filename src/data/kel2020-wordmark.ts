/**
 * The KEL2020 wordmark, as the SVG artwork Kelly Tube Systems supplied on
 * 2026-09-15 (ADR-0034). Path data, not an asset: every mesh builder in the
 * renderer is synchronous and the ghost rebuilds on each cell the cursor
 * crosses, so there is nowhere to await a fetch or an image decode.
 *
 * Coordinates are the artwork's own, in its 1575 x 366 viewBox with y running
 * down — which is also how a 2D canvas measures, so `Path2D` consumes these
 * strings unchanged. The artwork draws "2020" by reusing one "2" and one "0"
 * twice over, which is why those two appear here with an x offset rather than
 * as four separate paths.
 */
export const KEL2020_WORDMARK_BOX = { width: 1575, height: 366 } as const;

export type WordmarkGlyph = {
  /** SVG path data in the artwork's coordinates. */
  d: string;
  /** Left offset, for the digits the artwork repeats with `<use>`. */
  x?: number;
  /** The artwork marks the counter of a zero with `fill-rule="evenodd"`. */
  evenOdd?: boolean;
};

export const KEL2020_WORDMARK_GLYPHS: readonly WordmarkGlyph[] = [
  { d: "M33 65H369V155L454 65H513L428 151L522 283H462L397 186L369 214V283H33Z" },
  { d: "M538 65H701V105H586V152H691V189H586V242H704V283H538Z" },
  { d: "M722 65H770V242H877V283H722Z" },
  {
    d: "M897 151C897 97 928 65 973 65C1017 65 1047 95 1047 134C1047 176 1019 198 990 217C969 231 956 237 948 245H1049V283H892C892 228 920 205 960 180C988 162 1003 151 1003 132C1003 114 991 103 973 103C952 103 939 119 939 151Z"
  },
  {
    d: "M1135 65C1188 65 1210 108 1210 177C1210 246 1188 288 1135 288C1082 288 1059 246 1059 177C1059 108 1082 65 1135 65ZM1136 100C1111 100 1102 124 1102 177C1102 230 1111 250 1136 250C1161 250 1171 230 1171 177C1171 124 1161 100 1136 100Z",
    evenOdd: true
  },
  {
    d: "M897 151C897 97 928 65 973 65C1017 65 1047 95 1047 134C1047 176 1019 198 990 217C969 231 956 237 948 245H1049V283H892C892 228 920 205 960 180C988 162 1003 151 1003 132C1003 114 991 103 973 103C952 103 939 119 939 151Z",
    x: 328
  },
  {
    d: "M1135 65C1188 65 1210 108 1210 177C1210 246 1188 288 1135 288C1082 288 1059 246 1059 177C1059 108 1082 65 1135 65ZM1136 100C1111 100 1102 124 1102 177C1102 230 1111 250 1136 250C1161 250 1171 230 1171 177C1171 124 1161 100 1136 100Z",
    x: 331,
    evenOdd: true
  }
];
