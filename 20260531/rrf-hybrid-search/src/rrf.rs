//! Reciprocal Rank Fusion (Cormack, Clarke & Buettcher, SIGIR'09).
//!
//! ```text
//! score(d) = Σ_i 1 / (k + rank_i(d))
//! ```
//!
//! where `rank_i(d)` is the 1-based position of `d` in the i-th ranked list.
//! Documents absent from a ranking simply contribute nothing — they neither
//! penalise nor benefit from that retriever. The original paper recommends
//! k = 60; production engines (Elastic, OpenSearch, Azure AI Search, Weaviate,
//! Qdrant, MongoDB Atlas) ship the same default.

use std::collections::HashMap;

/// Fuse N ranked result lists into a single ranking via Reciprocal Rank
/// Fusion. The input lists are `(doc_id, original_score)` pairs already sorted
/// best-first; the original scores are intentionally ignored.
pub fn reciprocal_rank_fusion(rankings: &[&[(usize, f64)]], k: f64) -> Vec<(usize, f64)> {
    let mut fused: HashMap<usize, f64> = HashMap::new();
    for ranking in rankings {
        for (rank, &(doc_id, _)) in ranking.iter().enumerate() {
            *fused.entry(doc_id).or_insert(0.0) += 1.0 / (k + (rank as f64 + 1.0));
        }
    }
    let mut out: Vec<(usize, f64)> = fused.into_iter().collect();
    out.sort_by(|a, b| {
        b.1.partial_cmp(&a.1)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then(a.0.cmp(&b.0))
    });
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn perfect_agreement_keeps_order() {
        let a = vec![(10, 0.9), (11, 0.5), (12, 0.1)];
        let b = vec![(10, 0.8), (11, 0.4), (12, 0.05)];
        let fused = reciprocal_rank_fusion(&[&a, &b], 60.0);
        let ids: Vec<usize> = fused.iter().map(|(d, _)| *d).collect();
        assert_eq!(ids, vec![10, 11, 12]);
    }

    #[test]
    fn document_in_both_beats_document_in_one() {
        // doc 0 is rank 2 in both; doc 1 is rank 1 in only one list.
        let a = vec![(1, 0.9), (0, 0.5)];
        let b = vec![(2, 0.9), (0, 0.5)];
        let fused = reciprocal_rank_fusion(&[&a, &b], 60.0);
        assert_eq!(fused.first().map(|x| x.0), Some(0));
    }

    #[test]
    fn missing_documents_contribute_zero() {
        let a = vec![(0, 1.0)];
        let b: Vec<(usize, f64)> = vec![];
        let fused = reciprocal_rank_fusion(&[&a, &b], 60.0);
        assert_eq!(fused.len(), 1);
        assert!((fused[0].1 - 1.0 / 61.0).abs() < 1e-12);
    }
}
