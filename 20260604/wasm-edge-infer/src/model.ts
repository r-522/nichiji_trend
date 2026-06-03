/**
 * model.ts — builds the digit classifier consumed by the wasm kernel.
 *
 * The model is a single dense (linear) layer of 35 -> 10. Its weights are the
 * digit prototypes themselves, with a bias of -0.5*||prototype||^2. With that
 * bias, argmax(W·x + b) is provably equivalent to picking the nearest prototype
 * by squared Euclidean distance:
 *
 *   argmin_d ||x - t_d||^2  ==  argmax_d ( t_d·x - 0.5||t_d||^2 )
 *
 * because ||x||^2 is constant across classes. So this "neural network" is an
 * exact nearest-prototype classifier expressed as one linear layer — no
 * training loop required, yet it runs through the same portable wasm forward
 * pass as any larger model would.
 */

import { DIM, GLYPHS, glyphToVector } from "./font.ts";
import type { Model } from "./engine.ts";

export const NUM_CLASSES = 10;

export function buildDigitModel(): Model {
  const weights = new Float32Array(NUM_CLASSES * DIM);
  const bias = new Float32Array(NUM_CLASSES);

  for (let d = 0; d < NUM_CLASSES; d++) {
    const proto = glyphToVector(GLYPHS[d]);
    let normSq = 0;
    for (let i = 0; i < DIM; i++) {
      weights[d * DIM + i] = proto[i];
      normSq += proto[i] * proto[i];
    }
    bias[d] = -0.5 * normSq;
  }

  return {
    name: "digit-prototype-linear",
    inputDim: DIM,
    outputDim: NUM_CLASSES,
    layers: [{ inDim: DIM, outDim: NUM_CLASSES, weights, bias, activation: "none" }],
  };
}
