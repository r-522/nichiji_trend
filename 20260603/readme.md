# 20260603 日次トレンド調査 — Agent2Agent (A2A) プロトコル × Agent Mesh フェデレーション (TypeScript)

**調査日 (JST): 2026年6月3日**

## 1. 本日のトレンド技術

**Agent2Agent (A2A) プロトコル と「Agent Mesh」によるフェデレーテッド・マルチエージェント実行。**

異なるベンダー・言語・フレームワークで作られた AI エージェント同士が、共通の
オープン標準で**相互発見・相互運用 (interoperability)** し、タスクを委譲し合うための
プロトコルが A2A。各エージェントは自分の能力を記した **AgentCard**
(`/.well-known/agent-card.json`) を公開し、通信は **JSON-RPC 2.0** を土台に
**Task / Message / Artifact** のライフサイクルで行われる。

その A2A を土台に、**複数のクラウド・オンプレ・エッジ・デバイスにまたがる
異種混在のエージェント群を「メッシュ」として束ね、統一されたガバナンス
(identity / data classification) と可観測性のもとでフェデレーテッドに実行する**
というのが「Agent Mesh」の考え方である。

## 2. なぜ今バズっているのか（直近24〜72時間の背景）

本テーマは、**2026年6月2〜3日に開催された Microsoft Build 2026** の発表で一気に
タイムライン上の話題をさらった。直近24時間で連続して報じられた主な事項：

- **Azure Agent Mesh（Build 2026 で発表）**: 個々のエージェント・フレームワークが
  単一環境の実行を担うのに対し、Agent Mesh は **Azure / AWS Bedrock / Google Cloud /
  Azure Arc 経由のオンプレ / Windows 365 Cloud PC** といった**異種環境をまたいで
  実行をフェデレーション**する。レイテンシと GPU 空き状況で最寄りのノードに
  ルーティングし、**Entra ID（identity）と Purview（data classification）による
  完全な監査証跡 (audit trail)** を付与する。GA は2026年Q4予定。
  デモは「オンプレ DB の取引ログ読取 → Azure の規制 KB 照会 → Cloud PC のリスク
  モデル検証 → コンプライアンスレポート生成」を**単一の協調ワークフロー**として提示。
- **Windows Agent Framework 1.0 / Microsoft Agent Framework (MAF)**: マルチエージェント・
  ワークフローを Python と .NET 双方で構築するフレームワークが MIT で公開・更新
  (python-1.7.0, 2026-05-28)。グラフベースの sequential / concurrent / handoff /
  group collaboration パターン、A2A ホスティング、MCP 連携を備える。
- **GitHub Copilot のマルチエージェント化 / Project Polaris**: Build 2026 で Copilot が
  GPT-4 を Microsoft 自前モデル「Project Polaris」へ置換、VS Code で**複数エージェント
  並列実行**を出荷。Cursor 3 の Agents Window（並列エージェント）と並び、
  「複数の自律エージェントが協調・相互運用する」流れが決定的に。
- **A2A の標準化進展**: Google Cloud 発（2025年4月）の A2A は2025年6月に **Linux
  Foundation** へガバナンス移管され、ベンダー中立の相互運用標準として2026年に
  本格普及。AgentCard / JSON-RPC 2.0 / Task ライフサイクルが各社実装で共通言語化。

要するに、2025年が「単体エージェント」、2026年前半が「サブエージェント並列実行」
だったのに対し、**Build 2026 を契機に焦点は『異種エージェントの“相互運用”と
“フェデレーテッド実行”』へ移った**——これが本日のトレンドの核心である。

## 3. 本日の実装テーマと使用言語

- **採用技術要素**: Agent2Agent (A2A) プロトコル + Agent Mesh フェデレーション
  （AgentCard 発見、JSON-RPC 2.0 over HTTP、Task/Message/Artifact、能力＋レイテンシ
  によるルーティング、ガバナンス監査証跡）
- **使用言語**: **TypeScript** (Node.js 22 / `tsx`)
  - 前日（20260530）の使用言語 **Rust** とは重複しない。
  - 過去履歴の Python・Go とも重複しない、本リポジトリ初の言語。
- **成果物**: [`a2a-agent-mesh/`](./a2a-agent-mesh/) — 依存ゼロ（Node 標準モジュール
  のみ）で動く A2A メッシュの参照実装。`npm run demo` でフェデレーテッドな
  コンプライアンス・ワークフローが、`npm test` で7件の統合テストが走る。

## 4. 参照したソース（SNS / 記事 / 一次情報）

- Microsoft Build 2026 まとめ（AI Tools Recap）: https://aitoolsrecap.com/Blog/microsoft-build-2026-windows-agent-framework-wsl3-azure-mesh
- Build 2026: Windows is now an Agent Platform（ChatForest）: https://chatforest.com/builders-log/microsoft-build-2026-recap-windows-agent-platform-project-polaris-copilot-workspace/
- GitHub Copilot Replaces GPT-4 With Project Polaris, Multi-Agent VS Code（Tech Times）: https://www.techtimes.com/articles/317596/20260602/github-copilot-replaces-gpt-4-project-polaris-ships-multi-agent-vs-code-build.htm
- Build 2026: Microsoft Makes Windows an Agent Platform（Windows News）: https://windowsnews.ai/article/build-2026-makes-windows-an-agent-platform-for-ai-developers.420496
- AI News Today – June 2, 2026: 11 Biggest Stories（buildfastwithai）: https://www.buildfastwithai.com/blogs/ai-news-today-june-2-2026
- microsoft/agent-framework（GitHub, Python & .NET）: https://github.com/microsoft/agent-framework
- Agent2Agent (A2A) Protocol Specification（Linux Foundation）: https://a2a-protocol.org/latest/specification/
- a2aproject/A2A（GitHub）: https://github.com/a2aproject/A2A
- What Is Agent2Agent (A2A) Protocol?（IBM）: https://www.ibm.com/think/topics/agent2agent-protocol
- AgentCard – A2A Protocol concepts: https://agent2agent.info/docs/concepts/agentcard/
- AI Agent Protocols 2026: Complete Guide（ruh.ai）: https://www.ruh.ai/blogs/ai-agent-protocols-2026-complete-guide

> 注: 一部の二次情報は速報性の高いテックブログ・SNS 拡散記事を含む。一次仕様は
> a2a-protocol.org / microsoft/agent-framework を参照のこと。
