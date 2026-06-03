/**
 * engine.ts — TypeScript host for the portable wasm inference kernel.
 *
 * The host owns the model and orchestrates the forward pass; the wasm module
 * only performs raw float math on its linear memory. This mirrors the WASI-NN
 * split between a generic, portable backend and a host-defined graph.
 */

import { readFile } from "node:fs/promises";

/** Raw exports surfaced by build/kernel.wasm. */
interface KernelExports {
  memory: WebAssembly.Memory;
  alloc(nbytes: number): number;
  reset(): void;
  dense(inPtr: number, inLen: number, wPtr: number, bPtr: number, outPtr: number, outLen: number): void;
  relu(ptr: number, len: number): void;
  softmax(ptr: number, len: number): void;
  argmax(ptr: number, len: number): number;
}

export type Activation = "relu" | "none";

export interface Layer {
  inDim: number;
  outDim: number;
  weights: Float32Array; // outDim x inDim, row-major
  bias: Float32Array; // outDim
  activation: Activation;
}

export interface Model {
  name: string;
  inputDim: number;
  outputDim: number;
  layers: Layer[];
}

export interface Prediction {
  label: number; // argmax index
  probs: Float32Array; // softmax over final logits
  logits: Float32Array; // raw final-layer outputs
}

export class NeuralEngine {
  private readonly ex: KernelExports;

  private constructor(ex: KernelExports) {
    this.ex = ex;
  }

  /** Instantiate the engine from a compiled kernel.wasm on disk. */
  static async load(wasmPath: string): Promise<NeuralEngine> {
    const bytes = await readFile(wasmPath);
    const { instance } = await WebAssembly.instantiate(bytes, {});
    return new NeuralEngine(instance.exports as unknown as KernelExports);
  }

  /** Copy a JS float array into wasm memory, returning its pointer. */
  private put(data: Float32Array): number {
    const ptr = this.ex.alloc(data.length * 4);
    if (ptr === 0) throw new Error("wasm arena exhausted");
    new Float32Array(this.ex.memory.buffer, ptr, data.length).set(data);
    return ptr;
  }

  /** Copy `len` floats out of wasm memory at `ptr`. */
  private get(ptr: number, len: number): Float32Array {
    return new Float32Array(this.ex.memory.buffer.slice(ptr, ptr + len * 4));
  }

  /**
   * Run the full forward pass entirely inside the wasm kernel. The host only
   * stages tensors and sequences the layer/activation calls.
   */
  predict(model: Model, input: Float32Array): Prediction {
    if (input.length !== model.inputDim) {
      throw new Error(`expected input of ${model.inputDim}, got ${input.length}`);
    }
    this.ex.reset(); // recycle the wasm arena for this run

    let actPtr = this.put(input);
    let actLen = input.length;

    for (const layer of model.layers) {
      const wPtr = this.put(layer.weights);
      const bPtr = this.put(layer.bias);
      const outPtr = this.ex.alloc(layer.outDim * 4);
      this.ex.dense(actPtr, actLen, wPtr, bPtr, outPtr, layer.outDim);
      if (layer.activation === "relu") this.ex.relu(outPtr, layer.outDim);
      actPtr = outPtr;
      actLen = layer.outDim;
    }

    const logits = this.get(actPtr, actLen);
    this.ex.softmax(actPtr, actLen);
    const probs = this.get(actPtr, actLen);
    const label = this.ex.argmax(actPtr, actLen);
    return { label, probs, logits };
  }
}
