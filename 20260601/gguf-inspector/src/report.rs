//! Human-readable and JSON renderers for a parsed `GgufFile`.

use std::collections::BTreeMap;
use std::fmt::Write as _;

use crate::gguf::{GgufFile, MetaValue};
use crate::types::GgmlType;

pub struct Report<'a> {
    pub file: &'a GgufFile,
}

#[derive(Debug, Clone)]
pub struct QuantBreakdown {
    pub type_name: &'static str,
    pub tensor_count: usize,
    pub estimated_bytes: u64,
}

impl<'a> Report<'a> {
    pub fn new(file: &'a GgufFile) -> Self { Self { file } }

    pub fn quant_breakdown(&self) -> Vec<QuantBreakdown> {
        let mut by_type: BTreeMap<&'static str, (GgmlType, usize, u64)> = BTreeMap::new();
        for t in &self.file.tensors {
            let entry = by_type
                .entry(t.ggml_type.name())
                .or_insert((t.ggml_type, 0, 0));
            entry.1 += 1;
            entry.2 = entry.2.saturating_add(t.estimated_bytes());
        }
        let mut out: Vec<_> = by_type
            .into_iter()
            .map(|(name, (_, count, bytes))| QuantBreakdown {
                type_name: name,
                tensor_count: count,
                estimated_bytes: bytes,
            })
            .collect();
        out.sort_by(|a, b| b.estimated_bytes.cmp(&a.estimated_bytes));
        out
    }

    pub fn render_human(&self, max_metadata: usize, max_tensors: usize) -> String {
        let mut s = String::new();
        let f = self.file;

        let _ = writeln!(s, "GGUF file");
        let _ = writeln!(s, "  version           : {}", f.version);
        let _ = writeln!(s, "  alignment         : {}", f.alignment());
        let _ = writeln!(s, "  architecture      : {}", f.architecture().unwrap_or("-"));
        let _ = writeln!(s, "  name              : {}", f.name().unwrap_or("-"));
        let _ = writeln!(s, "  metadata entries  : {}", f.metadata.len());
        let _ = writeln!(s, "  tensor entries    : {}", f.tensors.len());

        let total: u64 = f.tensors.iter().map(|t| t.estimated_bytes()).sum();
        let _ = writeln!(s, "  estimated weights : {}", human_bytes(total));

        let _ = writeln!(s);
        let _ = writeln!(s, "Quantization breakdown");
        let _ = writeln!(s, "  {:<10} {:>8}  {:>14}  {:>8}", "type", "tensors", "est. bytes", "share");
        for b in self.quant_breakdown() {
            let share = if total == 0 { 0.0 } else { (b.estimated_bytes as f64 / total as f64) * 100.0 };
            let _ = writeln!(
                s,
                "  {:<10} {:>8}  {:>14}  {:>7.2}%",
                b.type_name, b.tensor_count, human_bytes(b.estimated_bytes), share
            );
        }

        let _ = writeln!(s);
        let _ = writeln!(s, "Metadata (showing up to {} of {})", max_metadata, f.metadata.len());
        for (k, v) in f.metadata.iter().take(max_metadata) {
            let _ = writeln!(s, "  {} <{}> = {}", k, v.type_name(), short_value(v));
        }

        let _ = writeln!(s);
        let _ = writeln!(s, "Tensors (showing up to {} of {})", max_tensors, f.tensors.len());
        for t in f.tensors.iter().take(max_tensors) {
            let dims = t
                .dimensions
                .iter()
                .map(|d| d.to_string())
                .collect::<Vec<_>>()
                .join("x");
            let _ = writeln!(
                s,
                "  [{:>6}] {:<40} {:<8} dims={:<20} ~{}",
                t.offset,
                truncate(&t.name, 40),
                t.ggml_type.name(),
                dims,
                human_bytes(t.estimated_bytes()),
            );
        }

        s
    }

    pub fn render_json(&self) -> String {
        let mut s = String::new();
        let f = self.file;

        s.push('{');
        let _ = write!(s, r#""version":{}"#, f.version);
        let _ = write!(s, r#","alignment":{}"#, f.alignment());
        let _ = write!(
            s,
            r#","architecture":{}"#,
            json_opt_str(f.architecture())
        );
        let _ = write!(s, r#","name":{}"#, json_opt_str(f.name()));

        let total: u64 = f.tensors.iter().map(|t| t.estimated_bytes()).sum();
        let _ = write!(s, r#","tensor_count":{},"metadata_count":{},"estimated_bytes":{}"#,
            f.tensors.len(), f.metadata.len(), total);

        s.push_str(r#","quant_breakdown":["#);
        for (i, b) in self.quant_breakdown().iter().enumerate() {
            if i > 0 { s.push(','); }
            let _ = write!(
                s,
                r#"{{"type":"{}","tensors":{},"estimated_bytes":{}}}"#,
                b.type_name, b.tensor_count, b.estimated_bytes
            );
        }
        s.push(']');

        s.push_str(r#","metadata":["#);
        for (i, (k, v)) in f.metadata.iter().enumerate() {
            if i > 0 { s.push(','); }
            let _ = write!(
                s,
                r#"{{"key":{},"type":"{}","value":{}}}"#,
                json_str(k), v.type_name(), json_value(v)
            );
        }
        s.push(']');

        s.push_str(r#","tensors":["#);
        for (i, t) in f.tensors.iter().enumerate() {
            if i > 0 { s.push(','); }
            let dims = t
                .dimensions
                .iter()
                .map(|d| d.to_string())
                .collect::<Vec<_>>()
                .join(",");
            let _ = write!(
                s,
                r#"{{"name":{},"type":"{}","dims":[{}],"offset":{},"estimated_bytes":{}}}"#,
                json_str(&t.name), t.ggml_type.name(), dims, t.offset, t.estimated_bytes()
            );
        }
        s.push(']');

        s.push('}');
        s
    }
}

fn short_value(v: &MetaValue) -> String {
    match v {
        MetaValue::String(s) => format!("\"{}\"", truncate(s, 60)),
        MetaValue::Array(items) => {
            let preview = items
                .iter()
                .take(4)
                .map(short_value)
                .collect::<Vec<_>>()
                .join(", ");
            if items.len() > 4 {
                format!("[{}, … {} items]", preview, items.len())
            } else {
                format!("[{}]", preview)
            }
        }
        MetaValue::U8(x) => x.to_string(), MetaValue::I8(x) => x.to_string(),
        MetaValue::U16(x) => x.to_string(), MetaValue::I16(x) => x.to_string(),
        MetaValue::U32(x) => x.to_string(), MetaValue::I32(x) => x.to_string(),
        MetaValue::U64(x) => x.to_string(), MetaValue::I64(x) => x.to_string(),
        MetaValue::F32(x) => format!("{x}"),  MetaValue::F64(x) => format!("{x}"),
        MetaValue::Bool(x) => x.to_string(),
    }
}

fn truncate(s: &str, max: usize) -> String {
    if s.chars().count() <= max { s.to_owned() }
    else {
        let mut out: String = s.chars().take(max.saturating_sub(1)).collect();
        out.push('…');
        out
    }
}

fn json_str(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('"');
    for ch in s.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => {
                let _ = write!(out, "\\u{:04x}", c as u32);
            }
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

fn json_opt_str(s: Option<&str>) -> String {
    match s {
        Some(v) => json_str(v),
        None => "null".to_owned(),
    }
}

fn json_value(v: &MetaValue) -> String {
    match v {
        MetaValue::String(s) => json_str(s),
        MetaValue::Bool(b) => b.to_string(),
        MetaValue::U8(x) => x.to_string(), MetaValue::I8(x) => x.to_string(),
        MetaValue::U16(x) => x.to_string(), MetaValue::I16(x) => x.to_string(),
        MetaValue::U32(x) => x.to_string(), MetaValue::I32(x) => x.to_string(),
        MetaValue::U64(x) => x.to_string(), MetaValue::I64(x) => x.to_string(),
        MetaValue::F32(x) => {
            if x.is_finite() { format!("{x}") } else { "null".into() }
        }
        MetaValue::F64(x) => {
            if x.is_finite() { format!("{x}") } else { "null".into() }
        }
        MetaValue::Array(items) => {
            let inner = items.iter().map(json_value).collect::<Vec<_>>().join(",");
            format!("[{inner}]")
        }
    }
}

fn human_bytes(n: u64) -> String {
    const UNITS: &[&str] = &["B", "KiB", "MiB", "GiB", "TiB"];
    let mut v = n as f64;
    let mut unit = 0;
    while v >= 1024.0 && unit < UNITS.len() - 1 {
        v /= 1024.0;
        unit += 1;
    }
    if unit == 0 {
        format!("{n} B")
    } else {
        format!("{v:.2} {}", UNITS[unit])
    }
}
