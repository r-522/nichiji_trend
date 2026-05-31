//! GGML tensor type table.
//!
//! Block size and bytes-per-block are taken from ggml's `type_traits` table so we
//! can estimate the on-disk weight bytes of every tensor without reading the
//! tensor data section itself.

#[derive(Copy, Clone, Debug, Eq, PartialEq, Hash)]
pub enum GgmlType {
    F32, F16,
    Q4_0, Q4_1,
    Q5_0, Q5_1, Q8_0, Q8_1,
    Q2K, Q3K, Q4K, Q5K, Q6K, Q8K,
    IQ2XXS, IQ2XS, IQ3XXS, IQ1S, IQ4NL, IQ3S, IQ2S, IQ4XS,
    I8, I16, I32, I64,
    F64,
    IQ1M, BF16,
    TQ1_0, TQ2_0,
    MXFP4,
    Unknown(u32),
}

impl GgmlType {
    pub fn from_u32(v: u32) -> Self {
        use GgmlType::*;
        match v {
            0 => F32, 1 => F16,
            2 => Q4_0, 3 => Q4_1,
            6 => Q5_0, 7 => Q5_1, 8 => Q8_0, 9 => Q8_1,
            10 => Q2K, 11 => Q3K, 12 => Q4K, 13 => Q5K, 14 => Q6K, 15 => Q8K,
            16 => IQ2XXS, 17 => IQ2XS, 18 => IQ3XXS, 19 => IQ1S, 20 => IQ4NL,
            21 => IQ3S, 22 => IQ2S, 23 => IQ4XS,
            24 => I8, 25 => I16, 26 => I32, 27 => I64,
            28 => F64,
            29 => IQ1M, 30 => BF16,
            34 => TQ1_0, 35 => TQ2_0,
            39 => MXFP4,
            other => Unknown(other),
        }
    }

    pub fn name(&self) -> &'static str {
        use GgmlType::*;
        match self {
            F32 => "F32", F16 => "F16",
            Q4_0 => "Q4_0", Q4_1 => "Q4_1",
            Q5_0 => "Q5_0", Q5_1 => "Q5_1", Q8_0 => "Q8_0", Q8_1 => "Q8_1",
            Q2K => "Q2_K", Q3K => "Q3_K", Q4K => "Q4_K", Q5K => "Q5_K",
            Q6K => "Q6_K", Q8K => "Q8_K",
            IQ2XXS => "IQ2_XXS", IQ2XS => "IQ2_XS", IQ3XXS => "IQ3_XXS",
            IQ1S => "IQ1_S", IQ4NL => "IQ4_NL", IQ3S => "IQ3_S",
            IQ2S => "IQ2_S", IQ4XS => "IQ4_XS",
            I8 => "I8", I16 => "I16", I32 => "I32", I64 => "I64",
            F64 => "F64",
            IQ1M => "IQ1_M", BF16 => "BF16",
            TQ1_0 => "TQ1_0", TQ2_0 => "TQ2_0",
            MXFP4 => "MXFP4",
            Unknown(_) => "UNKNOWN",
        }
    }

    /// Number of scalar elements packed into a single quantization block.
    pub fn block_size(&self) -> u64 {
        use GgmlType::*;
        match self {
            F32 | F16 | BF16 | F64 | I8 | I16 | I32 | I64 => 1,
            Q4_0 | Q4_1 | Q5_0 | Q5_1 | Q8_0 | Q8_1 => 32,
            Q2K | Q3K | Q4K | Q5K | Q6K | Q8K
            | IQ2XXS | IQ2XS | IQ3XXS | IQ1S | IQ4NL | IQ3S | IQ2S | IQ4XS
            | IQ1M | TQ1_0 | TQ2_0 | MXFP4 => 256,
            Unknown(_) => 1,
        }
    }

    /// Bytes occupied by a single block of `block_size()` elements.
    pub fn bytes_per_block(&self) -> u64 {
        use GgmlType::*;
        match self {
            F32 | I32 => 4,
            F16 | BF16 | I16 => 2,
            I8 => 1,
            F64 | I64 => 8,
            Q4_0 => 18, Q4_1 => 20,
            Q5_0 => 22, Q5_1 => 24, Q8_0 => 34, Q8_1 => 36,
            Q2K => 84, Q3K => 110, Q4K => 144, Q5K => 176, Q6K => 210, Q8K => 292,
            IQ2XXS => 66, IQ2XS => 74, IQ3XXS => 98,
            IQ1S => 50, IQ4NL => 18, IQ3S => 110, IQ2S => 82, IQ4XS => 136,
            IQ1M => 56,
            TQ1_0 => 54, TQ2_0 => 66,
            MXFP4 => 136,
            Unknown(_) => 0,
        }
    }

    /// Estimate the byte footprint of a tensor with `n_elements` scalar elements.
    pub fn estimate_bytes(&self, n_elements: u64) -> u64 {
        let bs = self.block_size();
        if bs == 0 {
            return 0;
        }
        let blocks = n_elements / bs;
        // Round up if not aligned; ggml pads tensors so partial blocks count.
        let blocks = if n_elements % bs == 0 { blocks } else { blocks + 1 };
        blocks * self.bytes_per_block()
    }
}
