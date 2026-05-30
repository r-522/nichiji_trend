# 20260531 日次トレンド調査 — Hybrid Search (BM25 + Vector) と Reciprocal Rank Fusion

**調査日 (JST): 2026年5月31日**

## 1. 本日のトレンド技術

**Reciprocal Rank Fusion (RRF) を用いたハイブリッド検索 (BM25 + Dense Vector)。**
RAG (Retrieval-Augmented Generation) の本番運用において 2025〜2026 年にかけて
事実上のデファクト・スタンダードに昇格した検索手法。

### 要点

- **ハイブリッド検索が本番 RAG のデフォルト**: スパース (BM25 など語彙ベース) と
  デンス (ベクトル類似度) を**併用**するパターンが、両者の弱点
  (BM25 は語彙一致ベース、ベクトルは語彙バイアスを過剰補正) を埋め合うため、
  シングル・リトリーバーを単独で使うより堅牢。
- **Reciprocal Rank Fusion (RRF) が「事実上の標準」**:
  順位だけを使う一行アルゴリズム
  ```
  score(d) = Σ_i 1 / (k + rank_i(d))    （通常 k = 60）
  ```
  によりスコア正規化問題を回避できるため、Elasticsearch / OpenSearch /
  Azure AI Search / Weaviate / Qdrant / MongoDB Atlas など主要ベクトル DB の
  **既定のフュージョン方式**として採用されている。
- **2026 年の最新ベンチマーク**: 直近の比較研究で
  "Hybrid + Diverse" 構成が NDCG@10 で +19%、MRR で +18% の改善を示し、
  クロスエンコーダ・リランカーを併用するとさらに支配的になることが報告されている。
- **2026 年 2〜5 月に技術ブログが集中**: Medium / DEV / 各社エンジニアリングブログで
  「RAG Is Not Dead」「Hybrid Search Done Right」「Advanced RAG — RRF in Hybrid Search」
  などの記事が短期間に集中して公開されており、現在進行形でバズっているテーマ。

## 2. バズっている背景・理由

1. **「RAG は死んだ」言説への揺り戻し**: 大規模 LLM の長文コンテキスト化により
   "RAG はもう不要" との論調がいったん広がったが、コスト・遅延・更新頻度・
   ハルシネーション抑止の観点で 2026 年に **「RAG はまだ生きている、ただし
   ハイブリッド検索が前提」** という揺り戻しが発生。これが直近の記事ラッシュの背景。
2. **ベクトル単独の限界が顕在化**: 固有名詞・型番・略語・コードシンボルなど
   "exact match が効くべき場所" でデンス検索のリコールが落ちる事例が共有され、
   BM25 を **捨てない** ことの重要性が再確認された。
3. **RRF のシンプルさ**: 順位だけで動くため
   各リトリーバーのスコア分布を気にせず、新しい埋め込みモデルを差し替えても
   フュージョン側のチューニングがほぼ不要。ハイパーパラメータが `k` 1 個だけ、
   かつ k = 60 が paper / 実装ともに「無調整で動く」値として確立している点も
   採用障壁を下げている。
4. **ベクトル DB ベンダーの一斉対応**: 2024〜2026 年にかけて主要ベンダーが
   `rrf` リトリーバーを API のファーストクラス機能として揃え、
   "ハイブリッド検索 = RRF" という用語の固定化が一気に進んだ。
5. **Cross-Encoder リランクとの組み合わせ**: RRF で粗い候補集合を作り
   クロスエンコーダで再ランクする 2 段構成が **production RAG の定番パターン** に
   なった。RRF はその "1 段目" として欠かせない部品となっている。

## 3. 本日の成果物 (アプリ)

`X25519+ML-KEM` のような暗号系ではなく、本日は **情報検索 (IR) 系トレンド** を採用し、
**`rrf-hybrid-search`** という CLI ツールを **Rust 標準ライブラリのみ** で実装した。
詳細は `rrf-hybrid-search/README.md` を参照。

- **BM25** (k1=1.2, b=0.75) によるスパース検索器
- **文字トリグラムの TF-IDF + コサイン類似度** によるデンス検索器
  (ニューラル埋め込みの代わりに語形変化耐性を確保。実運用では OpenAI/Cohere/BGE
  などの埋め込みに差し替えれば、フュージョン側のコードは一切変更不要。)
- **Reciprocal Rank Fusion** (k=60) による融合
- サブコマンド: `demo` / `search`
- 単体テスト 10 件 + 結合テスト 4 件、計 14 件パス (BM25 単独・ベクトル単独・
  RRF 融合のラウンドトリップ、語彙ミスマッチ復元、未知語の挙動、k による
  単調性などを検証)

### 使用言語の選定について

直近 (20260528) の使用言語は **Go**、その前 (20260527) は **Python**。
重複禁止ルールに従い、本日は **Rust** を採用した。Rust 1.94 標準ライブラリのみで
HashMap・cargo test までフル実装でき、外部クレート (ベクトル DB ライブラリ等) に
依存せず RRF/BM25/TF-IDF の本体ロジックを **読める粒度** で示せるため適している。

## 4. 参照したソース (各種記事・SNS・ニュース)

- [Hybrid Search: BM25, Vector & Reranking Reference 2026 (Digital Applied)](https://www.digitalapplied.com/blog/hybrid-search-bm25-vector-reranking-reference-2026)
- [Reciprocal Rank Fusion: Making RAG Retrieval Smarter (Medium, 2026-03)](https://medium.com/@sumannitian/reciprocal-rank-fusion-making-rag-retrieval-smarter-ec75fc0df802)
- [Hybrid Search Done Right: Fixing RAG Retrieval Failures using BM25 + HNSW + RRF in Elasticsearch (Medium, 2026-02)](https://ashutoshkumars1ngh.medium.com/hybrid-search-done-right-fixing-rag-retrieval-failures-using-bm25-hnsw-reciprocal-rank-fusion-a73596652d22)
- [RAG Is Not Dead: Advanced Retrieval Patterns That Actually Work in 2026 (DEV Community)](https://dev.to/young_gao/rag-is-not-dead-advanced-retrieval-patterns-that-actually-work-in-2026-2gbo)
- [Advanced RAG — Understanding Reciprocal Rank Fusion in Hybrid Search (Guillaume Laforge, 2026-02-10)](https://glaforge.dev/posts/2026/02/10/advanced-rag-understanding-reciprocal-rank-fusion-in-hybrid-search/)
- [Implementing Hybrid Semantic-Lexical Search in RAG (Machine Learning Mastery)](https://machinelearningmastery.com/implementing-hybrid-semantic-lexical-search-in-rag/)
- [Reciprocal Rank Fusion (RRF): How It Works and When to Use It (BigData Boutique)](https://bigdataboutique.com/blog/reciprocal-rank-fusion-how-it-works-and-when-to-use-it)
- [Optimizing RAG with Hybrid Search & Reranking (VectorHub by Superlinked)](https://superlinked.com/vectorhub/articles/optimizing-rag-with-hybrid-search-reranking)
- [Reciprocal Rank Fusion: the one-line algorithm behind hybrid search (Serghei's Blog)](https://blog.serghei.pl/posts/reciprocal-rank-fusion-explained/)
- [Hybrid retrieval with reciprocal rank fusion: solving the score normalization problem (Andrey Chauzov)](https://avchauzov.github.io/blog/2025/hybrid-retrieval-rrf-rank-fusion/)
- [10 Things That Matter in AI Right Now (MIT Technology Review, 2026-04-21)](https://www.technologyreview.com/2026/04/21/1135643/10-ai-artificial-intelligence-trends-technologies-research-2026/)

> 注: 上記 URL は調査時点 (2026-05-31 JST 03:02 頃) の Web 検索結果に基づく。
