/**
 * font.ts — 5x7 bitmap glyphs for the digits 0-9.
 *
 * Each glyph is 7 rows of 5 columns => a 35-dimensional input vector.
 * '#' is ink (1.0), '.' is background (0.0). These double as both the demo
 * inputs and, after vectorisation, the prototype weights of the classifier.
 */

export const ROWS = 7;
export const COLS = 5;
export const DIM = ROWS * COLS; // 35

export const GLYPHS: Record<number, string[]> = {
  0: [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  1: ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  2: [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  3: ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  4: ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  5: ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  6: [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  7: ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  8: [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  9: [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
};

/** Convert a glyph (7 strings) into a Float32 vector of length DIM. */
export function glyphToVector(glyph: string[]): Float32Array {
  const v = new Float32Array(DIM);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      v[r * COLS + c] = glyph[r][c] === "#" ? 1.0 : 0.0;
    }
  }
  return v;
}

/** Render a vector back to an ASCII grid for terminal display. */
export function vectorToAscii(v: Float32Array): string {
  const lines: string[] = [];
  for (let r = 0; r < ROWS; r++) {
    let line = "";
    for (let c = 0; c < COLS; c++) line += v[r * COLS + c] >= 0.5 ? "█" : "·";
    lines.push(line);
  }
  return lines.join("\n");
}
