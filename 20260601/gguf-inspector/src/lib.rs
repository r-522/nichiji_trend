//! gguf-inspector: a zero-dependency parser for the GGUF v3 container format.
//!
//! Public surface:
//! - [`types::GgmlType`]   — enum of all GGML tensor types with block size + bytes-per-block.
//! - [`gguf::GgufFile`]    — parsed representation of a GGUF file (header + metadata + tensor info).
//! - [`gguf::parse`]       — read a `&[u8]` buffer into a [`GgufFile`].
//! - [`report::Report`]    — human / JSON renderable summary.
//! - [`fixture::build`]    — build a minimal in-memory GGUF buffer (used by tests and `--demo`).

pub mod fixture;
pub mod gguf;
pub mod report;
pub mod types;
