use rrf_hybrid_search::HybridIndex;

fn corpus() -> Vec<String> {
    vec![
        "Post-quantum encryption migration to ML-KEM is the urgent topic of 2026.".into(),
        "Schema migrations in Postgres trip up CI pipelines for novices.".into(),
        "Quantum-safe key encapsulation ships in Chrome, VPNs and messaging apps.".into(),
        "The best ramen in Tokyo, a 2026 spring guide.".into(),
        "Hybrid search fuses BM25 with vector retrievers using RRF.".into(),
    ]
}

#[test]
fn rrf_promotes_documents_with_consistent_relevance() {
    let idx = HybridIndex::build(corpus());
    let hits = idx.search("post quantum encryption migration", 3, 60.0);
    assert!(!hits.is_empty());
    // doc 0 matches lexically AND morphologically, so it must be #1.
    assert_eq!(hits[0].doc_id, 0);
}

#[test]
fn rrf_recovers_vocabulary_mismatch() {
    // Query uses "encrypt"; doc 2 says "encapsulation" — purely morphological
    // overlap through trigrams. BM25 alone may miss it; RRF should still
    // surface a sensible ordering.
    let idx = HybridIndex::build(corpus());
    let hits = idx.search("encryption", 5, 60.0);
    let ids: Vec<usize> = hits.iter().map(|h| h.doc_id).collect();
    assert!(ids.contains(&0));
    // The ramen doc and the postgres doc must be ranked below the
    // cryptography docs.
    let crypto_positions: Vec<usize> = ids
        .iter()
        .enumerate()
        .filter(|(_, d)| **d == 0 || **d == 2)
        .map(|(p, _)| p)
        .collect();
    let distractor_positions: Vec<usize> = ids
        .iter()
        .enumerate()
        .filter(|(_, d)| **d == 1 || **d == 3)
        .map(|(p, _)| p)
        .collect();
    if let (Some(&worst_crypto), Some(&best_distractor)) =
        (crypto_positions.iter().max(), distractor_positions.iter().min())
    {
        assert!(
            worst_crypto < best_distractor,
            "crypto docs should outrank distractors, got crypto={crypto_positions:?} distractors={distractor_positions:?}"
        );
    }
}

#[test]
fn no_overlap_returns_empty_hits() {
    let idx = HybridIndex::build(corpus());
    let hits = idx.search("zzzzzzz", 5, 60.0);
    assert!(hits.is_empty());
}

#[test]
fn k_parameter_changes_ranking_smoothing() {
    let idx = HybridIndex::build(corpus());
    let hits_k1 = idx.search("post quantum encryption", 5, 1.0);
    let hits_k1000 = idx.search("post quantum encryption", 5, 1000.0);
    // The order may or may not change but the absolute RRF scores must
    // decrease monotonically as k grows.
    let s1: f64 = hits_k1.iter().map(|h| h.rrf_score).sum();
    let s1000: f64 = hits_k1000.iter().map(|h| h.rrf_score).sum();
    assert!(s1 > s1000, "RRF scores should shrink as k grows: {s1} vs {s1000}");
}
