//! Build a minimal in-memory GGUF buffer for tests and the `--demo` subcommand.
//!
//! The fixture mimics a tiny "Phi-3-mini-like" model header: it carries the
//! standard `general.*` and `llama.*` metadata keys plus a handful of tensors
//! using a mix of F32, F16, Q4_K and Q6_K quantization so the breakdown report
//! has something interesting to show.

use crate::gguf::{GGUF_MAGIC, MetaValue};
use crate::types::GgmlType;

struct Writer {
    buf: Vec<u8>,
}

impl Writer {
    fn new() -> Self { Self { buf: Vec::new() } }
    fn u8(&mut self, v: u8) { self.buf.push(v); }
    fn u32(&mut self, v: u32) { self.buf.extend_from_slice(&v.to_le_bytes()); }
    fn u64(&mut self, v: u64) { self.buf.extend_from_slice(&v.to_le_bytes()); }
    fn i32(&mut self, v: i32) { self.buf.extend_from_slice(&v.to_le_bytes()); }
    fn f32(&mut self, v: f32) { self.buf.extend_from_slice(&v.to_le_bytes()); }
    fn string(&mut self, s: &str) {
        self.u64(s.len() as u64);
        self.buf.extend_from_slice(s.as_bytes());
    }

    fn meta(&mut self, key: &str, v: &MetaValue) {
        self.string(key);
        write_value(self, v);
    }
}

fn write_value(w: &mut Writer, v: &MetaValue) {
    match v {
        MetaValue::U8(x)   => { w.u32(0);  w.u8(*x); }
        MetaValue::I8(x)   => { w.u32(1);  w.u8(*x as u8); }
        MetaValue::U16(x)  => { w.u32(2);  w.buf.extend_from_slice(&x.to_le_bytes()); }
        MetaValue::I16(x)  => { w.u32(3);  w.buf.extend_from_slice(&x.to_le_bytes()); }
        MetaValue::U32(x)  => { w.u32(4);  w.u32(*x); }
        MetaValue::I32(x)  => { w.u32(5);  w.i32(*x); }
        MetaValue::F32(x)  => { w.u32(6);  w.f32(*x); }
        MetaValue::Bool(b) => { w.u32(7);  w.u8(if *b {1} else {0}); }
        MetaValue::String(s) => { w.u32(8); w.string(s); }
        MetaValue::Array(items) => {
            w.u32(9);
            // Inner type tag is taken from the first item; arrays must be homogeneous.
            let inner_type = items.first().map(meta_value_type_id).unwrap_or(8);
            w.u32(inner_type);
            w.u64(items.len() as u64);
            for it in items {
                write_value_payload(w, it);
            }
        }
        MetaValue::U64(x)  => { w.u32(10); w.u64(*x); }
        MetaValue::I64(x)  => { w.u32(11); w.buf.extend_from_slice(&x.to_le_bytes()); }
        MetaValue::F64(x)  => { w.u32(12); w.buf.extend_from_slice(&x.to_le_bytes()); }
    }
}

fn write_value_payload(w: &mut Writer, v: &MetaValue) {
    // Like `write_value` but without the leading type tag — used inside arrays.
    match v {
        MetaValue::U8(x)   => w.u8(*x),
        MetaValue::I8(x)   => w.u8(*x as u8),
        MetaValue::U16(x)  => w.buf.extend_from_slice(&x.to_le_bytes()),
        MetaValue::I16(x)  => w.buf.extend_from_slice(&x.to_le_bytes()),
        MetaValue::U32(x)  => w.u32(*x),
        MetaValue::I32(x)  => w.i32(*x),
        MetaValue::F32(x)  => w.f32(*x),
        MetaValue::Bool(b) => w.u8(if *b {1} else {0}),
        MetaValue::String(s) => w.string(s),
        MetaValue::U64(x)  => w.u64(*x),
        MetaValue::I64(x)  => w.buf.extend_from_slice(&x.to_le_bytes()),
        MetaValue::F64(x)  => w.buf.extend_from_slice(&x.to_le_bytes()),
        MetaValue::Array(_) => panic!("nested arrays not used in fixture"),
    }
}

fn meta_value_type_id(v: &MetaValue) -> u32 {
    match v {
        MetaValue::U8(_)=>0, MetaValue::I8(_)=>1, MetaValue::U16(_)=>2, MetaValue::I16(_)=>3,
        MetaValue::U32(_)=>4, MetaValue::I32(_)=>5, MetaValue::F32(_)=>6, MetaValue::Bool(_)=>7,
        MetaValue::String(_)=>8, MetaValue::Array(_)=>9, MetaValue::U64(_)=>10,
        MetaValue::I64(_)=>11, MetaValue::F64(_)=>12,
    }
}

pub struct FixtureTensor {
    pub name: &'static str,
    pub dims: &'static [u64],
    pub ggml_type: GgmlType,
}

/// Build a complete in-memory GGUF v3 buffer (header + metadata + tensor info).
/// No tensor data section is appended — the inspector doesn't need it.
pub fn build() -> Vec<u8> {
    let metadata: Vec<(&str, MetaValue)> = vec![
        ("general.architecture",    MetaValue::String("phi3".into())),
        ("general.name",            MetaValue::String("phi3-mini-fixture".into())),
        ("general.alignment",       MetaValue::U32(32)),
        ("general.file_type",       MetaValue::U32(15)), // Q4_K_M
        ("phi3.context_length",     MetaValue::U32(4096)),
        ("phi3.embedding_length",   MetaValue::U32(3072)),
        ("phi3.block_count",        MetaValue::U32(32)),
        ("phi3.attention.head_count", MetaValue::U32(32)),
        ("phi3.attention.head_count_kv", MetaValue::U32(32)),
        ("tokenizer.ggml.bos_token_id", MetaValue::U32(1)),
        ("tokenizer.ggml.eos_token_id", MetaValue::U32(32000)),
        ("tokenizer.ggml.tokens", MetaValue::Array(vec![
            MetaValue::String("<s>".into()),
            MetaValue::String("</s>".into()),
            MetaValue::String("<|user|>".into()),
            MetaValue::String("<|assistant|>".into()),
        ])),
    ];

    let tensors: Vec<FixtureTensor> = vec![
        FixtureTensor { name: "token_embd.weight",         dims: &[3072, 32064], ggml_type: GgmlType::Q4K },
        FixtureTensor { name: "output_norm.weight",        dims: &[3072],        ggml_type: GgmlType::F32 },
        FixtureTensor { name: "output.weight",             dims: &[3072, 32064], ggml_type: GgmlType::Q6K },
        FixtureTensor { name: "blk.0.attn_norm.weight",    dims: &[3072],        ggml_type: GgmlType::F32 },
        FixtureTensor { name: "blk.0.attn_qkv.weight",     dims: &[3072, 9216],  ggml_type: GgmlType::Q4K },
        FixtureTensor { name: "blk.0.attn_output.weight",  dims: &[3072, 3072],  ggml_type: GgmlType::Q4K },
        FixtureTensor { name: "blk.0.ffn_norm.weight",     dims: &[3072],        ggml_type: GgmlType::F32 },
        FixtureTensor { name: "blk.0.ffn_gate.weight",     dims: &[3072, 8192],  ggml_type: GgmlType::Q4K },
        FixtureTensor { name: "blk.0.ffn_up.weight",       dims: &[3072, 8192],  ggml_type: GgmlType::Q4K },
        FixtureTensor { name: "blk.0.ffn_down.weight",     dims: &[8192, 3072],  ggml_type: GgmlType::Q6K },
        FixtureTensor { name: "rope_freqs.weight",         dims: &[48],          ggml_type: GgmlType::F16 },
    ];

    let mut w = Writer::new();
    w.u32(GGUF_MAGIC);
    w.u32(3);
    w.u64(tensors.len() as u64);
    w.u64(metadata.len() as u64);

    for (k, v) in &metadata {
        w.meta(k, v);
    }

    // Tensor info section. Offsets are synthetic but deterministic.
    let mut offset: u64 = 0;
    for t in &tensors {
        w.string(t.name);
        w.u32(t.dims.len() as u32);
        for &d in t.dims {
            w.u64(d);
        }
        w.u32(ggml_type_to_u32(t.ggml_type));
        w.u64(offset);

        let n_elements: u64 = t.dims.iter().copied().product();
        let bytes = t.ggml_type.estimate_bytes(n_elements);
        offset = (offset + bytes + 31) & !31; // 32-byte alignment between tensors
    }

    w.buf
}

fn ggml_type_to_u32(t: GgmlType) -> u32 {
    use GgmlType::*;
    match t {
        F32=>0, F16=>1, Q4_0=>2, Q4_1=>3, Q5_0=>6, Q5_1=>7, Q8_0=>8, Q8_1=>9,
        Q2K=>10, Q3K=>11, Q4K=>12, Q5K=>13, Q6K=>14, Q8K=>15,
        IQ2XXS=>16, IQ2XS=>17, IQ3XXS=>18, IQ1S=>19, IQ4NL=>20, IQ3S=>21,
        IQ2S=>22, IQ4XS=>23,
        I8=>24, I16=>25, I32=>26, I64=>27, F64=>28,
        IQ1M=>29, BF16=>30, TQ1_0=>34, TQ2_0=>35, MXFP4=>39,
        Unknown(v) => v,
    }
}
