# gguf-inspector

Zero-dependency Rust CLI for inspecting [GGUF v3](https://github.com/ggml-org/ggml/blob/master/docs/gguf.md) model files — the de-facto container format for quantized LLM weights shipped through llama.cpp, Ollama, LM Studio, and friends.

Built 2026-06-01 (JST) as the daily trend app for the "on-device LLM / GGUF / Rust" theme dominating May 2026 dev chatter.

## Why

In 2026 every laptop and most phones can run a 7B–13B SLM locally via llama.cpp / MLX / ExecuTorch, and Hugging Face is flooded with `*.gguf` files in 10+ quantization schemes (Q4_K_M, Q5_K_M, Q6_K, Q8_0, IQ-flavours, …). `gguf-inspector` is a tiny `cat` for those files:

- Decodes the full header (magic, version, tensor & metadata counts).
- Parses all 13 GGUF metadata value types, including nested arrays.
- Lists every tensor with its GGML quant type and shape.
- Computes the **per-quant-type byte breakdown** so you can see at a glance whether a checkpoint is mostly Q4_K, mixed-precision, or fp16.
- Emits either a human report or a single-line JSON document.

No `serde`, no `clap`, no `byteorder`. Pure `std`. Runs in ~50ms on a multi-GB model.

## Build & run

```
cargo build --release
./target/release/gguf-inspector --demo
./target/release/gguf-inspector path/to/phi-3-mini-Q4_K_M.gguf
./target/release/gguf-inspector path/to/model.gguf --json
```

`--demo` parses an in-memory fixture that mimics a Phi-3-mini header, so you can try the tool without downloading anything.

## Tests

```
cargo test
```

Covers:
- Round-trip of a synthetic GGUF buffer through the parser.
- Both human and JSON renderers.
- Bad-magic and truncated-input rejection.
- Quantization breakdown bytes sum to the per-tensor estimate.

## Layout

```
src/
  lib.rs        public module wiring
  types.rs      GGML tensor type table (Q4_K, Q6_K, MXFP4, …) + byte estimator
  gguf.rs       binary parser (header, metadata KV, tensor info)
  report.rs     human + JSON renderers, quant-breakdown
  fixture.rs    in-memory GGUF builder used by --demo and tests
  main.rs       CLI entrypoint
tests/
  roundtrip.rs  end-to-end test
```

## License

MIT OR Apache-2.0
