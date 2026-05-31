//! GGUF v3 binary layout parser.
//!
//! Layout (little-endian, per ggml-org/ggml docs/gguf.md):
//!   u32 magic = 0x46554747 ("GGUF")
//!   u32 version
//!   u64 tensor_count
//!   u64 metadata_kv_count
//!   metadata_kv[metadata_kv_count]
//!     gguf_string key            (u64 len + bytes)
//!     u32         value_type     (0..=12)
//!     value                       (variable; ARRAY is recursive)
//!   tensor_info[tensor_count]
//!     gguf_string name           (u64 len + bytes)
//!     u32         n_dimensions
//!     u64         dimensions[n_dimensions]
//!     u32         ggml_type
//!     u64         offset          (within tensor data section, aligned)
//!   padding to alignment
//!   tensor_data[]                 (we don't read these)

use std::fmt;

use crate::types::GgmlType;

pub const GGUF_MAGIC: u32 = 0x4655_4747; // "GGUF" little-endian
pub const DEFAULT_ALIGNMENT: u64 = 32;

#[derive(Debug)]
pub enum ParseError {
    Eof { needed: usize, remaining: usize },
    BadMagic(u32),
    UnsupportedVersion(u32),
    BadValueType(u32),
    BadUtf8,
    TooManyDims(u32),
}

impl fmt::Display for ParseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Eof { needed, remaining } => {
                write!(f, "unexpected EOF: needed {needed} bytes, have {remaining}")
            }
            Self::BadMagic(m) => write!(f, "bad magic: 0x{m:08x} (expected 'GGUF')"),
            Self::UnsupportedVersion(v) => write!(f, "unsupported GGUF version: {v}"),
            Self::BadValueType(t) => write!(f, "bad metadata value type id: {t}"),
            Self::BadUtf8 => write!(f, "invalid UTF-8 in string"),
            Self::TooManyDims(n) => write!(f, "tensor has {n} dimensions (max supported: 8)"),
        }
    }
}

impl std::error::Error for ParseError {}

#[derive(Debug, Clone, PartialEq)]
pub enum MetaValue {
    U8(u8), I8(i8),
    U16(u16), I16(i16),
    U32(u32), I32(i32),
    U64(u64), I64(i64),
    F32(f32), F64(f64),
    Bool(bool),
    String(String),
    Array(Vec<MetaValue>),
}

impl MetaValue {
    pub fn type_name(&self) -> &'static str {
        match self {
            Self::U8(_) => "u8", Self::I8(_) => "i8",
            Self::U16(_) => "u16", Self::I16(_) => "i16",
            Self::U32(_) => "u32", Self::I32(_) => "i32",
            Self::U64(_) => "u64", Self::I64(_) => "i64",
            Self::F32(_) => "f32", Self::F64(_) => "f64",
            Self::Bool(_) => "bool",
            Self::String(_) => "string",
            Self::Array(_) => "array",
        }
    }
}

#[derive(Debug, Clone)]
pub struct TensorInfo {
    pub name: String,
    pub dimensions: Vec<u64>,
    pub ggml_type: GgmlType,
    pub offset: u64,
}

impl TensorInfo {
    pub fn n_elements(&self) -> u64 {
        self.dimensions.iter().copied().fold(1u64, u64::saturating_mul)
    }
    pub fn estimated_bytes(&self) -> u64 {
        self.ggml_type.estimate_bytes(self.n_elements())
    }
}

#[derive(Debug, Clone)]
pub struct GgufFile {
    pub version: u32,
    pub metadata: Vec<(String, MetaValue)>,
    pub tensors: Vec<TensorInfo>,
}

impl GgufFile {
    pub fn get(&self, key: &str) -> Option<&MetaValue> {
        self.metadata.iter().find(|(k, _)| k == key).map(|(_, v)| v)
    }
    pub fn alignment(&self) -> u64 {
        match self.get("general.alignment") {
            Some(MetaValue::U32(v)) => *v as u64,
            Some(MetaValue::U64(v)) => *v,
            _ => DEFAULT_ALIGNMENT,
        }
    }
    pub fn architecture(&self) -> Option<&str> {
        match self.get("general.architecture") {
            Some(MetaValue::String(s)) => Some(s.as_str()),
            _ => None,
        }
    }
    pub fn name(&self) -> Option<&str> {
        match self.get("general.name") {
            Some(MetaValue::String(s)) => Some(s.as_str()),
            _ => None,
        }
    }
}

/// Streaming cursor over a borrowed byte slice.
struct Cursor<'a> {
    buf: &'a [u8],
    pos: usize,
}

impl<'a> Cursor<'a> {
    fn new(buf: &'a [u8]) -> Self { Self { buf, pos: 0 } }

    fn take(&mut self, n: usize) -> Result<&'a [u8], ParseError> {
        if self.pos + n > self.buf.len() {
            return Err(ParseError::Eof {
                needed: n,
                remaining: self.buf.len().saturating_sub(self.pos),
            });
        }
        let s = &self.buf[self.pos..self.pos + n];
        self.pos += n;
        Ok(s)
    }

    fn u8(&mut self) -> Result<u8, ParseError> { Ok(self.take(1)?[0]) }
    fn i8(&mut self) -> Result<i8, ParseError> { Ok(self.take(1)?[0] as i8) }
    fn u16(&mut self) -> Result<u16, ParseError> {
        let b = self.take(2)?; Ok(u16::from_le_bytes([b[0], b[1]]))
    }
    fn i16(&mut self) -> Result<i16, ParseError> {
        let b = self.take(2)?; Ok(i16::from_le_bytes([b[0], b[1]]))
    }
    fn u32(&mut self) -> Result<u32, ParseError> {
        let b = self.take(4)?; Ok(u32::from_le_bytes([b[0], b[1], b[2], b[3]]))
    }
    fn i32(&mut self) -> Result<i32, ParseError> {
        let b = self.take(4)?; Ok(i32::from_le_bytes([b[0], b[1], b[2], b[3]]))
    }
    fn u64(&mut self) -> Result<u64, ParseError> {
        let b = self.take(8)?;
        Ok(u64::from_le_bytes([b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]]))
    }
    fn i64(&mut self) -> Result<i64, ParseError> {
        let b = self.take(8)?;
        Ok(i64::from_le_bytes([b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]]))
    }
    fn f32(&mut self) -> Result<f32, ParseError> { Ok(f32::from_bits(self.u32()?)) }
    fn f64(&mut self) -> Result<f64, ParseError> { Ok(f64::from_bits(self.u64()?)) }

    fn string(&mut self) -> Result<String, ParseError> {
        let len = self.u64()? as usize;
        let bytes = self.take(len)?;
        std::str::from_utf8(bytes)
            .map(|s| s.to_owned())
            .map_err(|_| ParseError::BadUtf8)
    }
}

fn read_value(c: &mut Cursor<'_>, type_id: u32) -> Result<MetaValue, ParseError> {
    Ok(match type_id {
        0 => MetaValue::U8(c.u8()?),
        1 => MetaValue::I8(c.i8()?),
        2 => MetaValue::U16(c.u16()?),
        3 => MetaValue::I16(c.i16()?),
        4 => MetaValue::U32(c.u32()?),
        5 => MetaValue::I32(c.i32()?),
        6 => MetaValue::F32(c.f32()?),
        7 => MetaValue::Bool(c.u8()? != 0),
        8 => MetaValue::String(c.string()?),
        9 => {
            let inner_type = c.u32()?;
            let len = c.u64()? as usize;
            let mut items = Vec::with_capacity(len.min(1024));
            for _ in 0..len {
                items.push(read_value(c, inner_type)?);
            }
            MetaValue::Array(items)
        }
        10 => MetaValue::U64(c.u64()?),
        11 => MetaValue::I64(c.i64()?),
        12 => MetaValue::F64(c.f64()?),
        other => return Err(ParseError::BadValueType(other)),
    })
}

pub fn parse(buf: &[u8]) -> Result<GgufFile, ParseError> {
    let mut c = Cursor::new(buf);

    let magic = c.u32()?;
    if magic != GGUF_MAGIC {
        return Err(ParseError::BadMagic(magic));
    }
    let version = c.u32()?;
    if version != 2 && version != 3 {
        return Err(ParseError::UnsupportedVersion(version));
    }
    let tensor_count = c.u64()?;
    let kv_count = c.u64()?;

    let mut metadata = Vec::with_capacity(kv_count.min(4096) as usize);
    for _ in 0..kv_count {
        let key = c.string()?;
        let vtype = c.u32()?;
        let value = read_value(&mut c, vtype)?;
        metadata.push((key, value));
    }

    let mut tensors = Vec::with_capacity(tensor_count.min(65536) as usize);
    for _ in 0..tensor_count {
        let name = c.string()?;
        let n_dims = c.u32()?;
        if n_dims > 8 {
            return Err(ParseError::TooManyDims(n_dims));
        }
        let mut dims = Vec::with_capacity(n_dims as usize);
        for _ in 0..n_dims {
            dims.push(c.u64()?);
        }
        let ggml_type = GgmlType::from_u32(c.u32()?);
        let offset = c.u64()?;
        tensors.push(TensorInfo {
            name,
            dimensions: dims,
            ggml_type,
            offset,
        });
    }

    Ok(GgufFile { version, metadata, tensors })
}
