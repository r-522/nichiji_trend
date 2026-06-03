#!/usr/bin/env bash
# Compile the C inference kernel to a freestanding wasm32 module.
# Requires clang with the wasm32 target (bundled with LLVM >= 8).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/src/kernel.c"
OUT="$ROOT/build/kernel.wasm"

mkdir -p "$ROOT/build"

clang \
  --target=wasm32 \
  -nostdlib \
  -O3 \
  -Wl,--no-entry \
  -Wl,--export-dynamic \
  -Wl,--export-memory \
  -o "$OUT" \
  "$SRC"

echo "built $OUT ($(wc -c < "$OUT") bytes)"
