//! TF-IDF over hashed character-trigram features with cosine similarity.
//!
//! This is *not* a neural embedding. The point is to demonstrate the fusion
//! algorithm: any retriever that emits a ranked list of doc-ids drops into the
//! same RRF call, whether it scores via cosine over OpenAI embeddings, ColBERT
//! late interaction, or — as here — character n-grams. The trigram signal does
//! give useful morphological matching (`encrypt` ~ `encryption`) without
//! needing model weights.

use std::collections::HashMap;

const NUM_BUCKETS: u64 = 1 << 18; // 262 144

#[inline]
fn fnv1a64(s: &str) -> u64 {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for b in s.as_bytes() {
        h ^= *b as u64;
        h = h.wrapping_mul(0x0000_0100_0000_01b3);
    }
    h
}

#[inline]
fn bucket(s: &str) -> u64 {
    fnv1a64(s) % NUM_BUCKETS
}

pub struct VectorIndex {
    docs: Vec<HashMap<u64, f64>>,
    norms: Vec<f64>,
    idf: HashMap<u64, f64>,
}

impl VectorIndex {
    pub fn build(docs: &[Vec<String>]) -> Self {
        let n = docs.len();
        let mut tfs: Vec<HashMap<u64, f64>> = Vec::with_capacity(n);
        let mut df: HashMap<u64, usize> = HashMap::new();

        for shingles in docs {
            let mut tf: HashMap<u64, f64> = HashMap::new();
            for s in shingles {
                *tf.entry(bucket(s)).or_insert(0.0) += 1.0;
            }
            for &b in tf.keys() {
                *df.entry(b).or_insert(0) += 1;
            }
            tfs.push(tf);
        }

        let mut idf: HashMap<u64, f64> = HashMap::with_capacity(df.len());
        for (b, d) in df {
            // sklearn-style smoothed IDF
            let v = ((1.0 + n as f64) / (1.0 + d as f64)).ln() + 1.0;
            idf.insert(b, v);
        }

        let mut docs_w: Vec<HashMap<u64, f64>> = Vec::with_capacity(n);
        let mut norms = Vec::with_capacity(n);
        for tf in tfs {
            let mut w = HashMap::with_capacity(tf.len());
            let mut sum_sq = 0.0;
            for (b, t) in tf {
                let v = t * idf.get(&b).copied().unwrap_or(0.0);
                sum_sq += v * v;
                w.insert(b, v);
            }
            norms.push(sum_sq.sqrt().max(1e-12));
            docs_w.push(w);
        }
        Self {
            docs: docs_w,
            norms,
            idf,
        }
    }

    /// Cosine similarity between the (sparse, hashed) query vector and every
    /// document vector. Documents are returned in descending similarity order;
    /// docs with zero overlap are omitted.
    pub fn score(&self, query_shingles: &[String]) -> Vec<(usize, f64)> {
        if query_shingles.is_empty() || self.docs.is_empty() {
            return Vec::new();
        }
        let mut qtf: HashMap<u64, f64> = HashMap::new();
        for s in query_shingles {
            *qtf.entry(bucket(s)).or_insert(0.0) += 1.0;
        }
        let mut qvec: HashMap<u64, f64> = HashMap::with_capacity(qtf.len());
        let mut qnorm_sq = 0.0;
        for (b, tf) in &qtf {
            let v = tf * self.idf.get(b).copied().unwrap_or(0.0);
            qnorm_sq += v * v;
            qvec.insert(*b, v);
        }
        let qnorm = qnorm_sq.sqrt().max(1e-12);

        let mut out = Vec::with_capacity(self.docs.len());
        for (i, dvec) in self.docs.iter().enumerate() {
            let mut dot = 0.0;
            let (small, large) = if dvec.len() < qvec.len() {
                (dvec, &qvec)
            } else {
                (&qvec, dvec)
            };
            for (b, sv) in small {
                if let Some(lv) = large.get(b) {
                    dot += sv * lv;
                }
            }
            if dot <= 0.0 {
                continue;
            }
            let cos = dot / (self.norms[i] * qnorm);
            out.push((i, cos));
        }
        out.sort_by(|a, b| {
            b.1.partial_cmp(&a.1)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then(a.0.cmp(&b.0))
        });
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tokenize::char_trigrams;

    #[test]
    fn morphological_match_beats_unrelated() {
        let docs: Vec<Vec<String>> = ["this paper studies encryption protocols",
                                      "the weather is nice today",
                                      "we encrypt every message before sending"]
            .iter()
            .map(|d| char_trigrams(d))
            .collect();
        let idx = VectorIndex::build(&docs);
        let q = char_trigrams("encryption");
        let ranked = idx.score(&q);
        // doc 0 contains "encryption" literally; doc 2 contains "encrypt".
        // Both should outrank doc 1 (weather).
        let positions: Vec<usize> = ranked.iter().map(|(d, _)| *d).collect();
        assert_eq!(positions.first(), Some(&0));
        assert!(positions.iter().position(|&d| d == 2).unwrap()
              < positions.iter().position(|&d| d == 1).unwrap_or(usize::MAX));
    }
}
