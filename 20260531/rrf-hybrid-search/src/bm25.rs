//! Okapi BM25 inverted index over already-tokenised documents.

use std::collections::HashMap;

pub struct Bm25Index {
    pub k1: f64,
    pub b: f64,
    pub avgdl: f64,
    pub n_docs: usize,
    pub doc_lens: Vec<usize>,
    postings: HashMap<String, Vec<(usize, u32)>>,
    df: HashMap<String, usize>,
}

impl Bm25Index {
    pub fn build(docs: &[Vec<String>]) -> Self {
        let n_docs = docs.len();
        let mut doc_lens = Vec::with_capacity(n_docs);
        let mut total_len = 0usize;
        let mut postings: HashMap<String, Vec<(usize, u32)>> = HashMap::new();
        let mut df: HashMap<String, usize> = HashMap::new();

        for (i, tokens) in docs.iter().enumerate() {
            doc_lens.push(tokens.len());
            total_len += tokens.len();
            let mut tfs: HashMap<&str, u32> = HashMap::new();
            for t in tokens {
                *tfs.entry(t.as_str()).or_insert(0) += 1;
            }
            for (t, tf) in tfs {
                postings.entry(t.to_string()).or_default().push((i, tf));
                *df.entry(t.to_string()).or_insert(0) += 1;
            }
        }
        let avgdl = if n_docs == 0 {
            0.0
        } else {
            total_len as f64 / n_docs as f64
        };
        Self {
            k1: 1.2,
            b: 0.75,
            avgdl,
            n_docs,
            doc_lens,
            postings,
            df,
        }
    }

    /// Score the corpus against `query` tokens; returns (doc_id, score) sorted
    /// by descending score. Documents that share no terms with the query are
    /// omitted (their BM25 score is 0).
    pub fn score(&self, query: &[String]) -> Vec<(usize, f64)> {
        let mut scores: HashMap<usize, f64> = HashMap::new();
        for q in query {
            let Some(plist) = self.postings.get(q) else {
                continue;
            };
            let df = *self.df.get(q).unwrap_or(&0) as f64;
            // BM25+ smoothed IDF; always non-negative.
            let idf = ((self.n_docs as f64 - df + 0.5) / (df + 0.5) + 1.0).ln();
            for &(doc_id, tf) in plist {
                let dl = self.doc_lens[doc_id] as f64;
                let denom =
                    tf as f64 + self.k1 * (1.0 - self.b + self.b * dl / self.avgdl.max(1.0));
                let term_score = idf * (tf as f64 * (self.k1 + 1.0)) / denom;
                *scores.entry(doc_id).or_insert(0.0) += term_score;
            }
        }
        let mut out: Vec<(usize, f64)> = scores.into_iter().collect();
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
    use crate::tokenize::tokens;

    fn corpus() -> Vec<Vec<String>> {
        ["the quick brown fox",
         "lazy dogs sleep all day",
         "the quick brown dog jumps over the lazy fox",
         "foxes are not dogs"]
            .iter()
            .map(|d| tokens(d))
            .collect()
    }

    #[test]
    fn perfect_match_outranks_partial() {
        let idx = Bm25Index::build(&corpus());
        let q = tokens("quick brown fox");
        let ranked = idx.score(&q);
        assert_eq!(ranked.first().map(|x| x.0), Some(0));
    }

    #[test]
    fn unknown_terms_return_zero_results() {
        let idx = Bm25Index::build(&corpus());
        let q = tokens("xylophone");
        assert!(idx.score(&q).is_empty());
    }
}
