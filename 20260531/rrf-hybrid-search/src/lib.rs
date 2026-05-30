//! rrf-hybrid-search — minimal, dependency-free hybrid retrieval.
//!
//! Combines two retrievers over the same corpus:
//!
//! * **BM25** — the classic sparse / lexical scorer (Robertson, 1994).
//! * **Vector cosine** — TF-IDF over hashed *character trigrams*, which gives a
//!   light morphological signal ("encrypt" ~ "encryption" ~ "encrypts"). Real
//!   systems plug in a neural embedding here; the rank-fusion code below does
//!   not care which retriever produced the ranking.
//!
//! Their rankings are merged with **Reciprocal Rank Fusion** (Cormack, Clarke
//! & Buettcher, SIGIR'09), the rank-only fusion that has become the default
//! hybrid-search algorithm in Elasticsearch, OpenSearch, Weaviate, Qdrant and
//! Azure AI Search.

pub mod bm25;
pub mod rrf;
pub mod tokenize;
pub mod vector;

pub use bm25::Bm25Index;
pub use rrf::reciprocal_rank_fusion;
pub use vector::VectorIndex;

/// A retrieval engine bundling BM25 + a trigram vector index over the same
/// corpus, fused with Reciprocal Rank Fusion.
pub struct HybridIndex {
    pub docs: Vec<String>,
    pub bm25: Bm25Index,
    pub vector: VectorIndex,
}

#[derive(Debug, Clone)]
pub struct Hit {
    pub doc_id: usize,
    pub bm25_rank: Option<usize>,
    pub bm25_score: f64,
    pub vector_rank: Option<usize>,
    pub vector_score: f64,
    pub rrf_score: f64,
}

impl HybridIndex {
    /// Build BM25 and trigram-vector indices from a slice of documents.
    pub fn build(docs: Vec<String>) -> Self {
        let bm25_tokens: Vec<Vec<String>> = docs.iter().map(|d| tokenize::tokens(d)).collect();
        let trigram_tokens: Vec<Vec<String>> =
            docs.iter().map(|d| tokenize::char_trigrams(d)).collect();
        let bm25 = Bm25Index::build(&bm25_tokens);
        let vector = VectorIndex::build(&trigram_tokens);
        Self { docs, bm25, vector }
    }

    /// Score every document against `query` and return at most `top_k` hits,
    /// ordered by RRF score (highest first).
    ///
    /// `k_rrf` is the RRF smoothing constant; 60 is the value from the
    /// original paper and the de-facto default in production systems.
    pub fn search(&self, query: &str, top_k: usize, k_rrf: f64) -> Vec<Hit> {
        let q_tokens = tokenize::tokens(query);
        let q_trigrams = tokenize::char_trigrams(query);
        let bm25_ranked = self.bm25.score(&q_tokens);
        let vector_ranked = self.vector.score(&q_trigrams);

        let bm25_rank: std::collections::HashMap<usize, (usize, f64)> = bm25_ranked
            .iter()
            .enumerate()
            .map(|(r, (d, s))| (*d, (r, *s)))
            .collect();
        let vec_rank: std::collections::HashMap<usize, (usize, f64)> = vector_ranked
            .iter()
            .enumerate()
            .map(|(r, (d, s))| (*d, (r, *s)))
            .collect();

        let fused = reciprocal_rank_fusion(&[&bm25_ranked, &vector_ranked], k_rrf);
        fused
            .into_iter()
            .take(top_k)
            .map(|(doc_id, rrf_score)| Hit {
                doc_id,
                bm25_rank: bm25_rank.get(&doc_id).map(|(r, _)| *r + 1),
                bm25_score: bm25_rank.get(&doc_id).map(|(_, s)| *s).unwrap_or(0.0),
                vector_rank: vec_rank.get(&doc_id).map(|(r, _)| *r + 1),
                vector_score: vec_rank.get(&doc_id).map(|(_, s)| *s).unwrap_or(0.0),
                rrf_score,
            })
            .collect()
    }
}
