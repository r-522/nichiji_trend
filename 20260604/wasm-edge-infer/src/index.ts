/**
 * index.ts — CLI demo for wasm-edge-infer.
 *
 * Usage:
 *   node src/index.ts                 # classify every clean glyph + a noisy demo
 *   node src/index.ts --glyph 7       # classify one digit's glyph
 *   node src/index.ts --noise 0.15    # flip ~15% of pixels before classifying
 *   node src/index.ts --read          # read a 7x5 '#/.' grid from stdin
 *
 * The forward pass runs entirely inside the portable wasm kernel; this file is
 * just the host that stages tensors and prints results.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { NeuralEngine } from "./engine.ts";
import { buildDigitModel } from "./model.ts";
import { COLS, DIM, GLYPHS, ROWS, glyphToVector, vectorToAscii } from "./font.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const WASM = join(HERE, "..", "build", "kernel.wasm");

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Flip each pixel with probability p, using a deterministic LCG for repeatable demos. */
function addNoise(v: Float32Array, p: number, seed = 12345): Float32Array {
  const out = Float32Array.from(v);
  let s = seed >>> 0;
  for (let i = 0; i < out.length; i++) {
    s = (1664525 * s + 1013904223) >>> 0;
    if (s / 0xffffffff < p) out[i] = out[i] >= 0.5 ? 0 : 1;
  }
  return out;
}

function bar(p: number, width = 24): string {
  const n = Math.round(p * width);
  return "▉".repeat(n) + "·".repeat(width - n);
}

function report(engine: NeuralEngine, input: Float32Array, truth?: number): boolean {
  const model = buildDigitModel();
  const { label, probs } = engine.predict(model, input);
  const conf = probs[label];
  console.log(vectorToAscii(input));
  const ok = truth === undefined ? true : label === truth;
  const verdict = truth === undefined ? "" : ok ? "  ✓" : `  ✗ (truth ${truth})`;
  console.log(`→ predicted ${label}  conf ${(conf * 100).toFixed(1)}%  ${bar(conf)}${verdict}\n`);
  return ok;
}

function readStdinGrid(): Float32Array {
  const raw = readFileSync(0, "utf8");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0).slice(0, ROWS);
  if (lines.length !== ROWS) throw new Error(`expected ${ROWS} rows, got ${lines.length}`);
  const v = new Float32Array(DIM);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) v[r * COLS + c] = lines[r][c] === "#" ? 1 : 0;
  }
  return v;
}

async function main(): Promise<void> {
  const engine = await NeuralEngine.load(WASM);
  console.log("wasm-edge-infer — portable Wasm neural inference\n");

  const glyphArg = argValue("--glyph");
  const noise = parseFloat(argValue("--noise") ?? "0");

  if (process.argv.includes("--read")) {
    report(engine, readStdinGrid());
    return;
  }

  if (glyphArg !== undefined) {
    const d = Number(glyphArg);
    const v = addNoise(glyphToVector(GLYPHS[d]), noise);
    report(engine, v, d);
    return;
  }

  // Default: sweep all clean glyphs, then a noisy stress test.
  let correct = 0;
  for (let d = 0; d < 10; d++) {
    if (report(engine, addNoise(glyphToVector(GLYPHS[d]), noise), d)) correct++;
  }
  console.log(`clean accuracy: ${correct}/10`);

  console.log("\n--- noisy stress test (20% pixel flips) ---\n");
  let ncorrect = 0;
  for (let d = 0; d < 10; d++) {
    if (report(engine, addNoise(glyphToVector(GLYPHS[d]), 0.2, 999 + d), d)) ncorrect++;
  }
  console.log(`noisy accuracy: ${ncorrect}/10`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
