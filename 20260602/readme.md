# 20260602 日次トレンド調査レポート

## 調査日時 (JST)
2026-06-02

## 採用したトレンド技術
**Agentic AI / マルチエージェント・スーパーバイザーパターン (Multi-Agent Supervisor Orchestration)**

## 技術概要

2026年に入って爆発的に伸びたテーマが「Agentic AI」、特に**複数の専門エージェントを1人の Supervisor が動的にルーティング・統合する Supervisor パターン**である。これは LangGraph / LangGraph.js が広めたアーキテクチャで、現在は LangGraph・CrewAI・Microsoft Agent Framework (GA 2026 Q1)・Mastra（TypeScript）・OpenClaw・Hermes Agent などほぼ全ての主要フレームワークが採用している。

### Supervisor パターンの要点
1. **Supervisor エージェント**がユーザー要求を受け取り、適切な専門 Worker エージェントを選択する。
2. 各 **Worker エージェント**（Researcher / Coder / Writer など）は専門タスクのみを担当する。
3. Worker の出力は **共有 State**（メッセージ履歴 + 中間成果物）に書き戻される。
4. Supervisor は State を見て次の Worker をルーティングし、終了条件を満たしたら最終回答を合成する。
5. 全体は **有向グラフ（State Graph）**として表現され、ノード = エージェント、エッジ = 条件付き遷移となる。

### バズっている背景・理由
- **OpenClaw が GitHub 史上最多スター（373,616 stars, 2026年4月時点）に到達**し、Personal AI Agent カテゴリが一気に主流化した。
- **LangGraph v1.2**（2026年5月）が per-node timeout / error recovery / DeltaChannel を追加し、本番運用に必要なレジリエンス機能が揃った。
- **Microsoft Agent Framework**（AutoGen + Semantic Kernel 統合）が 2026 Q1 に GA を迎え、エンタープライズ採用が加速。
- **MCP（Model Context Protocol）TypeScript SDK の npm 累計 6,600万 DL 突破**（2026年6月）。Supervisor 配下の Worker が MCP 経由でツールを呼び出す構成が事実上の標準アーキテクチャに。
- 2026年5月公開の 11x のブログで「LangGraph.js の限界を感じて Mastra（TypeScript ネイティブな Agent Framework）に移行した」事例が話題となり、**TypeScript エコシステムでの Agent 開発**が一段と加速した。
- 「2026年は82%の企業がAIエージェント導入を計画」（SS&C Blue Prism）。日本国内では2026年5月時点で Sierra の評価額が100億ドルを突破し、商用導入が一気に拡大。

## 参照ソース（複数）
- [The trends that will shape AI and tech in 2026 | IBM](https://www.ibm.com/think/news/ai-tech-trends-predictions-2026)
- [2026 10 Things That Matter in AI Right Now | MIT Technology Review](https://www.technologyreview.com/2026/04/21/1135643/10-ai-artificial-intelligence-trends-technologies-research-2026/)
- [Trending AI GitHub Repos — May 2026 | Professor Glitch](https://www.askglitch.com/blog/top-5-trending-ai-github-repos-may-2026)
- [The AI Agent Star Race: 20 Frameworks in May 2026 | Medium](https://medium.com/@rosgluk/the-ai-agent-star-race-i-pulled-live-github-data-for-20-frameworks-in-may-2026-b4919dfba5e4)
- [GitHub - langchain-ai/langgraphjs](https://github.com/langchain-ai/langgraphjs)
- [GitHub - microsoft/agent-framework](https://github.com/microsoft/agent-framework)
- [LangGraph Multi-Agent Orchestration — Official Guide 2026](https://www.lifetideshub.com/docs/langgraph-multi-agent-orchestration/)
- [Mastra AI: The Complete Guide to the TypeScript Agent Framework (2026)](https://www.generative.inc/mastra-ai-the-complete-guide-to-the-typescript-agent-framework-2026)
- [Top 11 Agentic AI Trends to Watch in 2026 | Firecrawl](https://www.firecrawl.dev/blog/agentic-ai-trends)
- [2026年ITトレンド5選（エージェンティックAI、量子コンピューター） | 三菱電機](https://www.mind.co.jp/column/064.html)
- [AIエージェントサービス比較 2026年版 | vottia](https://vottia.jp/ai-agent-service-comparison-2026/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)

## 今日作成するアプリ
`multi-agent-supervisor` — Supervisor パターンで複数の専門 Worker エージェントを協調動作させる **TypeScript** 製の State-Graph オーケストレーターのリファレンス実装。LLM を使わずに動作するルールベースのモック LLM を内蔵し、ネットワーク不要で完結する。

## 言語選定理由
- 前日（20260528）の使用言語は **Go**。
- 前々日（20260527）の使用言語は **Python**。
- 重複を避け、かつ Mastra・LangGraph.js・MCP TS SDK など 2026 年に最も勢いのある Agentic AI エコシステムの中心言語である **TypeScript** を選定。
