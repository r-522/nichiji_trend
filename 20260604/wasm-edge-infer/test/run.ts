/**
 * run.ts — assertion-based test harness (no external deps).
 * Exits non-zero on any failure so CI can gate on it.
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { NeuralEngine } from "../src/engine.ts";
import { buildDigitModel } from "../src/model.ts";
import { GLYPHS, glyphToVector } from "../src/font.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const WASM = join(HERE, "..", "build", "kernel.wasm");

let failures = 0;
function assert(cond: boolean, msg: string): void {
  if (cond) {
    console.log(`  ✓ ${msg}`);
  } else {
    console.error(`  ✗ ${msg}`);
    failures++;
  }
}

async function main(): Promise<void> {
  const engine = await NeuralEngine.load(WASM);
  const model = buildDigitModel();

  console.log("clean glyphs classify correctly:");
  for (let d = 0; d < 10; d++) {
    const { label, probs } = engine.predict(model, glyphToVector(GLYPHS[d]));
    assert(label === d, `digit ${d} -> ${label} (conf ${(probs[label] * 100).toFixed(1)}%)`);
  }

  console.log("\nprobabilities form a valid distribution:");
  const { probs } = engine.predict(model, glyphToVector(GLYPHS[3]));
  const sum = probs.reduce((a, b) => a + b, 0);
  assert(Math.abs(sum - 1) < 1e-3, `softmax sums to 1 (got ${sum.toFixed(5)})`);
  assert([...probs].every((p) => p >= 0 && p <= 1), "all probabilities in [0,1]");

  console.log("\nreruns are deterministic (arena reset works):");
  const a = engine.predict(model, glyphToVector(GLYPHS[8])).label;
  const b = engine.predict(model, glyphToVector(GLYPHS[8])).label;
  assert(a === b && a === 8, `digit 8 stable across reruns (${a}, ${b})`);

  console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
