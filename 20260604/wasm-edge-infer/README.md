# wasm-edge-infer

> A portable WebAssembly **neural-inference kernel** (C → `wasm32`) driven by a
> **TypeScript** host — built in the spirit of the WASI-NN / "Wasm AI inference
> at the edge" trend of 2026.

The whole forward pass — dense layers, ReLU, softmax, argmax — runs **inside a
freestanding 2.5 KB wasm module**. The same `.wasm` binary would run unchanged
in a browser, in Node.js, on a Raspberry Pi, or inside an edge runtime
(Wasmtime / WasmEdge / Cloudflare Workers). The TypeScript host owns the model
and only *stages tensors and sequences layers* — exactly the host/backend split
that the WASI-NN proposal standardises.

The shipped demo is a **5×7 bitmap digit recognizer (0–9)**.

## Why this architecture

```
   ┌────────────────────────── TypeScript host (Node 22) ──────────────────────────┐
   │  model.ts   builds weights/biases        engine.ts   stages tensors, sequences │
   │  font.ts    glyph ⇄ vector               index.ts    CLI demo                  │
   └───────────────────────────────┬────────────────────────────────────────────────┘
                                    │  alloc / dense / relu / softmax / argmax
                                    ▼
   ┌──────────────── kernel.wasm (freestanding wasm32, no WASI imports) ────────────┐
   │  pure float math over its own linear memory — portable to any host             │
   └────────────────────────────────────────────────────────────────────────────────┘
```

- **Portable**: no libc, no WASI imports, no syscalls — pure compute. Drop it on
  any WebAssembly host.
- **Capability-isolated**: the kernel can only touch its own 64 KB linear
  memory; the host explicitly hands it every byte (the Wasm security story).
- **Decoupled model**: the same kernel runs *any* stack of dense+ReLU layers the
  host configures — swap in a larger model without recompiling the wasm.

## The model (no training loop needed)

The classifier is a single dense layer (35 → 10) whose weights *are* the digit
prototypes, with bias `-0.5·‖prototype‖²`. With that bias,
`argmax(W·x + b)` is provably the nearest prototype by squared distance:

```
argmin_d ‖x − t_d‖²  ==  argmax_d ( t_d·x − 0.5‖t_d‖² )
```

…because `‖x‖²` is constant across classes. So it's an *exact* nearest-prototype
classifier expressed as one linear layer — yet it flows through the identical
portable wasm forward pass any deeper network would use.

## Requirements

- **Node.js ≥ 22.6** (runs the TypeScript sources directly via native type
  stripping — no build step, no dependencies).
- **clang with the `wasm32` target** (LLVM ≥ 8) — only needed if you want to
  rebuild the kernel. A prebuilt `build/kernel.wasm` is committed.

## Quick start

```bash
# (optional) rebuild the wasm kernel from C
npm run build:wasm

# classify every glyph + a 20%-noise stress test
npm run demo

# classify a single digit's glyph, optionally corrupting pixels
node src/index.ts --glyph 7
node src/index.ts --glyph 8 --noise 0.15

# classify your own 7-row × 5-col grid ('#' = ink, '.' = blank)
printf '####.\n....#\n....#\n.###.\n....#\n....#\n####.\n' | node src/index.ts --read

# run the assertion test suite
npm test
```

## Files

| Path | Role |
| :--- | :--- |
| `src/kernel.c` | The inference kernel — compiles to `build/kernel.wasm`. |
| `scripts/build-wasm.sh` | `clang --target=wasm32 -nostdlib` build command. |
| `build/kernel.wasm` | Prebuilt freestanding wasm module (committed). |
| `src/engine.ts` | Host: loads the wasm, stages tensors, runs the forward pass. |
| `src/model.ts` | Builds the nearest-prototype digit classifier. |
| `src/font.ts` | 5×7 bitmap glyphs and vector ⇄ ASCII helpers. |
| `src/index.ts` | CLI demo. |
| `test/run.ts` | Dependency-free assertion harness. |

## License

MIT
