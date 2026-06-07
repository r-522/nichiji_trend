# 20260608 日次トレンド調査 — AIエージェント・メモリ / コンテキスト・エンジニアリング (TypeScript)

**調査日 (JST): 2026年6月8日**

## 1. 本日のトレンド技術

**AI エージェント・メモリ (Agent Memory) × コンテキスト・エンジニアリング (Context Engineering)** —
LLM 単体ではなく、エージェントが**セッションをまたいで「記憶」を保持・想起・整理する仕組み**こそが
プロダクトの本体である、という潮流。2026 年前半にかけて「**memory, not the model, is the product
（モデルではなくメモリが製品だ）**」という標語とともに、ベンチマーク・専用ライブラリ・専用 DB 機能が
一気に出揃い、直近 24〜72 時間でも関連リポジトリ・記事が継続的にバズっている。

具体的には、人間の記憶科学を模した**多層メモリ階層**が事実上のリファレンス・アーキテクチャになりつつある：

- **Working memory（作業記憶）**: 直近の観測を保持する小さな固定長バッファ（=エージェントの注意範囲）。
- **Episodic memory（エピソード記憶）**: タイムスタンプ付きの出来事。**忘却曲線**に沿って減衰する。
- **Semantic memory（意味記憶）**: エピソード記憶から蒸留・統合された永続的な「事実」。ほぼ減衰しない。
- **Context Graph（コンテキスト・グラフ）**: 単なるログより賢い連想構造。共起したエンティティを
  重み付きエッジで結び、想起時に**拡散活性化（spreading activation）**で関連記憶を引き出す。

### 要点

- **減衰（forgetting curve）と強化（reinforcement）**: エビングハウスの忘却曲線に基づき、古い記憶は
  指数的に弱まる一方、重要度（importance）が高い記憶は減衰が遅く、何度も想起された記憶は強化される。
- **コンソリデーション（consolidation / 「エージェントが眠る」）**: 重要 or 高頻度アクセスのエピソード記憶を
  意味記憶へ昇格させ、減衰し切った些末な記憶を破棄するバッチ処理。
- **ハイブリッド検索**: 「関連度（ベクトル類似）＋ 新しさ ＋ 重要度 ＋ 強化」の重み付き合算でランク付けし、
  *なぜその記憶が想起されたか* を説明可能にする。
- **コンテキスト・グラフ**: ベクトル検索だけでは取りこぼす連想的な想起（例：「プロジェクト」の話題から
  「締切」を思い出す）を補完する。

## 2. バズっている背景・理由

- **「メモリこそ製品」言説の主流化**: mem0 の「**State of AI Agent Memory 2026**」が、メモリは独自の
  ベンチマーク群・研究文献・計測可能な性能差・専用エコシステムを持つ「一級のアーキテクチャ構成要素」だと位置づけ。
  エージェント・メモリ市場は 2026 年に **約 62.7 億ドル**、2030 年には 284 億ドル（CAGR 約 35%）への成長予測。
- **専用インフラの登場**: **Redis が Context Engine** を発表し、エージェント向けメモリ基盤を提供。
  Neo4j・Foundation Capital は「**コンテキスト・グラフ**」を agentic システムの中核トレンドと指摘。
- **OSS の急伸**: `agentmemory` のようなメモリ特化リポジトリが本日も GitHub トレンド入り（数千スター規模、
  ベンチマーク駆動の検証・信頼度スコア・ナレッジグラフ機能）。新しいトークン効率的メモリアルゴリズムが
  2026 年 4 月に公開され、時系列クエリ・マルチホップ推論で大幅な精度向上を報告。
- **MCP の再加熱との相乗**: Model Context Protocol の利用が直近 1 か月で約 35% 増と再燃し、
  「ツール接続（MCP）」と「記憶（memory）」がコンテキスト・エンジニアリングの両輪として語られている。
- **エージェントの実運用化**: A2A v1.0 が 150 組織で本番稼働するなど、エージェントが「会話」から「実行」へ移り、
  長期タスクを完走させるために**永続メモリ**が必須要件になった。

## 3. 本日の成果物

調査したトレンドを実証するため、外部依存ゼロ・ネットワーク不要で**実際に動作する**
多層エージェント・メモリエンジンを **TypeScript** で実装した。

- アプリ名: **`agent-memory-engine`**
- 使用言語: **TypeScript**（Node.js のネイティブ TypeScript 実行＝型ストリッピングで、ビルド不要で動く）
- 実装した技術要素:
  - 多層メモリ階層（working / episodic / semantic）
  - エビングハウス忘却曲線による減衰 ＋ 重要度・強化スコアリング
  - 軽量・決定論的なローカル埋め込み（feature hashing）＋ コサイン類似度によるベクトル検索
  - コンテキスト・グラフと拡散活性化による連想的想起
  - コンソリデーション（昇格＆忘却）バッチ
- 検証: `npm test`（Node 標準テストランナーで **14 件すべて pass**）、`npm run typecheck`（`tsc` クリーン）、
  `npm run demo`（コーディング支援エージェントが日をまたいで記憶を保持するシミュレーション）。

> **言語選定について**: 履歴上、直近 20260530 は **Rust**（その前は Go、Python）。
> 本日はそれらと重複しない **TypeScript** を採用した。GitHub の 2025 年コントリビューター数で
> Python を抜き最多となった、現在最も勢いのある言語であり、エージェント・メモリのライブラリ実装にも好適。

## 4. 参照した各種ソース（SNS・記事・リポジトリ）

- mem0 — State of AI Agent Memory 2026: https://mem0.ai/blog/state-of-ai-agent-memory-2026
- MachineLearningMastery — 6 Best AI Agent Memory Frameworks (2026): https://machinelearningmastery.com/the-6-best-ai-agent-memory-frameworks-you-should-try-in-2026/
- Redis launches Context Engine for memory AI agents (Techzine): https://www.techzine.eu/news/data-management/141415/redis-launches-context-engine-for-memory-ai-agents/
- Neo4j — Context graphs: Why AI agents need three types of memory: https://neo4j.com/blog/agentic-ai/context-graph-ai-agent-memory/
- byteiota — Persistent Memory for AI Agents: 2026 Implementation: https://byteiota.com/persistent-memory-for-ai-agents-2026-implementation/
- Firecrawl — Top 13 Agentic AI Trends to Watch in 2026: https://www.firecrawl.dev/blog/agentic-ai-trends
- The AI Corner — AI agent memory / context-as-topology playbook 2026: https://www.the-ai-corner.com/p/ai-agent-memory-context-as-topology-playbook-2026
- aiagentstore — Daily AI Agent News (Last 7 days): https://aiagentstore.ai/ai-agent-news/this-week
- Medium — The AI Update, June 5, 2026: https://medium.com/adi-insights-innovations-collective/the-ai-update-june-5-2026-agents-are-working-regulation-is-moving-and-the-hype-is-over-b475b737bd76
- note.com — GitHub TOP 10 (June 01, 2026): https://note.com/trend_idea_bit/n/nbb0c72b541a5
