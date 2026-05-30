# rrf-hybrid-search

Minimal **hybrid retrieval** engine in pure Rust (standard library only).
Built to demonstrate the production-RAG pattern that became the de-facto
default through 2025–2026: BM25 + a dense retriever, fused with
**Reciprocal Rank Fusion**.

```
            ┌────────────┐
   query ──▶│   BM25     │── ranking₁ ─┐
            └────────────┘             │     ┌──────┐
            ┌────────────┐             ├────▶│ RRF  │──▶ fused ranking
   query ──▶│ trigram cos│── ranking₂ ─┘     └──────┘
            └────────────┘
```

* **BM25** — Robertson/Spärck-Jones lexical scorer (k₁ = 1.2, b = 0.75)
  over an inverted index.
* **Trigram cosine** — TF-IDF over hashed space-padded **character
  trigrams** with cosine similarity. This is *not* a neural embedding; it
  is here to (a) keep the binary dependency-free and (b) capture
  morphological similarity (`encrypt ~ encryption ~ encrypts`). In a real
  deployment, swap in OpenAI / Cohere / BGE embeddings — RRF doesn't care.
* **RRF** — `score(d) = Σ 1 / (k + rank_i(d))` with `k = 60`. The fusion
  uses ranks only, sidestepping the score-incompatibility problem that
  breaks naïve `α·BM25 + (1-α)·cosine` blending. The same algorithm now
  ships as the default hybrid retriever in Elasticsearch, OpenSearch,
  Weaviate, Qdrant, Azure AI Search and MongoDB Atlas.

## Build & run

```sh
cargo build --release
cargo test                          # 10 unit + 4 integration tests
cargo run -- demo                   # built-in corpus + sample query
cargo run -- demo --query "ramen"   # try a different query
cargo run -- search --corpus ./docs --query "post quantum encryption"
echo -e "first doc\nsecond doc" | cargo run -- search --corpus - --query "doc"
```

## Demo output

```
$ cargo run -- demo
corpus       : 10 documents
query        : post quantum encryption migration
RRF k        : 60

--- BM25 (lexical) top 2 ---
   1. score=7.311  doc#0   Post-quantum encryption migration: enterprises plan…
   2. score=1.569  doc#5   Quantum-safe key encapsulation mechanisms are now…

--- Trigram cosine (morphological) top 5 ---
   1. score=0.547  doc#0   Post-quantum encryption migration…
   2. score=0.234  doc#5   Quantum-safe key encapsulation…
   3. score=0.203  doc#4   Schema migrations in Postgres still trip up CI…
   4. score=0.106  doc#1   Cryptographers warn that harvest-now-decrypt-later…
   5. score=0.104  doc#2   Google Chrome already encrypts TLS handshakes…

=== RRF-fused top 5 ===
#  rrf       bm25#  bm25    vec#  vec     doc
1  0.032787  1      7.311   1     0.547   Post-quantum encryption migration…
2  0.032258  2      1.569   2     0.234   Quantum-safe key encapsulation…
3  0.015873  -      0.000   3     0.203   Schema migrations in Postgres…
4  0.015625  -      0.000   4     0.106   Cryptographers warn…
5  0.015385  -      0.000   5     0.104   Google Chrome already encrypts…
```

The interesting rows are #3 and below — documents BM25 missed entirely
(score 0, not in its ranking) still surface because RRF rewards
*consistent* relevance across retrievers.

## Layout

```
src/
├── main.rs       CLI entry (demo / search subcommands)
├── lib.rs        HybridIndex façade
├── tokenize.rs   Unicode-aware tokeniser + char-trigram extractor
├── bm25.rs       Inverted index + BM25 scoring
├── vector.rs     Hashed-feature TF-IDF + cosine
└── rrf.rs        Reciprocal Rank Fusion
tests/
└── integration.rs
```

## Why no external crates

The fusion algorithm is ~10 lines. The point of this app is to make that
visible, not to hide it behind `tantivy` or `qdrant-client`. Everything
else (tokeniser, BM25, TF-IDF cosine) is small enough to read in one
sitting.

## References

* Cormack, Clarke, Buettcher — *Reciprocal Rank Fusion outperforms Condorcet
  and individual rank learning methods* (SIGIR 2009).
* Robertson & Zaragoza — *The Probabilistic Relevance Framework: BM25 and
  Beyond* (2009).
* See the top-level `../readme.md` for the 2026 trend write-up that
  motivated this app.
