# 20260529 — トレンド調査ノート: マルチエージェント・オーケストレーション (Parallel Sub-Agents)

- **JST 日付**: 2026-05-29 (金)
- **調査対象期間**: 過去24時間（2026-05-28 〜 2026-05-29 JST 早朝）
- **本日の採用技術**: マルチエージェント・オーケストレーション（オーケストレーター＋サブエージェント並列実行 / 共有メモリ）
- **本日の使用言語**: TypeScript（Node.js 22+ / strict mode）
  - 直近の使用言語（20260528: Go, 20260527: Python）と重複していないことを確認。

---

## 1. なぜ今この技術がバズっているのか

2026 年 5 月の AI/開発者ツール業界で最も顕著なシフトは、「単発の LLM 呼び出し」から
「複数エージェントを **並列に走らせて結果をマージする** オーケストレーション」への移行である。
過去 24 時間以内のトレンドは、以下の流れを直接的に強化している:

1. **Google I/O 2026 (2026-05-19) で発表された Antigravity 2.0**
   - スタンドアロンのエージェント特化デスクトップアプリ + CLI + SDK + Managed Agents API。
   - 「**オーケストレーターエージェント**が高レベルの目標を受け取り、
     サブタスクへ分解 → 各サブエージェントを独立コンテキストで spawn → 並列実行 →
     共有メモリ層に成果を push → オーケストレーターが検証して統合」 という
     パターンを“OS レベル”で標準化した。
   - 直近の解説記事・チュートリアル（DataCamp、MarkTechPost、9to5Google、Medium）が
     本日まで連日上位にランクインしており、HN/X/Reddit のテック系タイムラインの上位を占めている。

2. **Gemini 3.5 Flash (2026-05-19 リリース)** が「**Agentic Coding Model**」として
   Terminal-Bench 2.1 76.2% / MCP Atlas 83.6% などのエージェントベンチマークで
   Gemini 3.1 Pro を超え、Flash 系で 4 倍速いトークン出力を実現。
   → 「軽量モデル × 多数並列」によるオーケストレーションが現実的なコストで回るようになった。

3. **MCP 2026-07-28 仕様 RC (2026-05-21 ロック)**
   - 新しい **Tasks 拡張** で、長時間ジョブを `task handle` として返し
     `tasks/get` / `tasks/update` / `tasks/cancel` で駆動できる。
   - これは「サブエージェントを非同期で並列実行」するための基盤として位置付けられている。
   - つまり Antigravity の orchestrator/subagent パターンと
     MCP の Tasks 拡張が同じ方向を向いて収束しつつある。

4. **HN / 個人開発界隈のトレンド**
   - 「ruflo」（Claude 向けオーケストレーション）や「open-design」（ローカル先行型の
     Anthropic デザインツール代替）のような、**専門化されたサブエージェント群を
     ローカルで走らせる** プロジェクトがフロントページ常連化。
   - 「wrapper 時代の終わり、agentic execution の時代」というナラティブが定着。

---

## 2. 技術要素の要点（実装ターゲット）

本日のアプリは、Antigravity 2.0 が標準化した次のアーキテクチャを
**最小限・ローカル・依存ゼロ寄り**で再現する:

| レイヤ | 役割 |
| :--- | :--- |
| Orchestrator | 高レベル目標を受け取り、サブタスクへ分解。サブエージェントを spawn・依存関係管理・結果統合を行う。 |
| Subagent | 1 つのサブタスクに集中し、**独立したコンテキストウィンドウ**を持つ Plan → Act → Observe ループを実行。 |
| Shared Memory | すべてのエージェントが read 可能、orchestrator のみ write 権限を制御する構造化コンテキストストア。 |
| Tool Registry | 各エージェントが呼べる安全なツール群（FS 読み込み、シェル実行（allowlist）、メモリ操作、done）。 |
| Tracer | 全イベントを JSON Lines で構造化出力（Antigravity の trace ビューと同じ思想）。 |

ポイント:

- **並列実行**: サブエージェントは Promise.all で並列に走り、各々が **isolated context** を持つ。
- **共有メモリの書き込み権限**: サブエージェントは自分の専用領域にしか write できず、
  orchestrator のみが他領域への merge 権限を持つ（コンフリクト回避）。
- **Pluggable Planner**: デフォルトはオフライン動作する決定論的 heuristic planner。
  OpenAI 互換 API（OpenAI / Gemini OpenAI 互換 / Ollama 等）も差し替え可能。
- **再現性**: トレースは決定論的に再生でき、CI で検証可能。

---

## 3. 参照ソース

- Google Antigravity 2.0 公式発表 (Google blog, 2026-05-19):
  https://blog.google/innovation-and-ai/technology/developers-tools/google-io-2026-developer-highlights/
- TechCrunch: "Google launches Antigravity 2.0 with an updated desktop app and CLI tool at IO 2026":
  https://techcrunch.com/2026/05/19/google-launches-antigravity-2-0-with-an-updated-desktop-app-and-cli-tool-at-io-2026/
- MarkTechPost: "Google Launches Antigravity 2.0 at I/O 2026":
  https://www.marktechpost.com/2026/05/19/google-launches-antigravity-2-0-at-i-o-2026-a-standalone-agent-first-platform-with-cli-sdk-managed-execution-and-enterprise-support/
- DataCamp チュートリアル: "Google Antigravity CLI: Orchestrating Parallel AI Agents":
  https://www.datacamp.com/tutorial/antigravity-cli
- 9to5Google: "Google Antigravity 2.0 becoming full agentic development suite":
  https://9to5google.com/2026/05/19/google-antigravity-agentic-developer-suite/
- MindStudio 解説: "Google Anti-Gravity 2.0: The Agentic Dev Platform That Built an OS in 12 Hours":
  https://www.mindstudio.ai/blog/google-anti-gravity-2-agentic-dev-platform
- Gemini 3.5 Flash 発表 (TechCrunch, 2026-05-19):
  https://techcrunch.com/2026/05/19/with-gemini-3-5-flash-google-bets-its-next-ai-wave-on-agents-not-chatbots/
- Gemini 3.5 公式 (DeepMind):
  https://deepmind.google/models/gemini/flash/
- Google I/O 2026 まとめ: https://blog.google/innovation-and-ai/technology/ai/google-io-2026-all-our-announcements/
- MCP 2026-07-28 Release Candidate (Tasks 拡張ほか):
  https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/
- This Week in Rust 651（同週の周辺コンテキスト）:
  https://this-week-in-rust.org/blog/2026/05/13/this-week-in-rust-651/
- Hacker News フロント (2026-05-27):
  https://news.ycombinator.com/front?day=2026-05-27

---

## 4. 本日の成果物

- 調査ノート: `20260529/readme.md`（本ファイル）
- アプリ実装: `20260529/subagent-orchestrator-ts/`
  - 言語: TypeScript
  - ランタイム: Node.js 22+
  - 依存: なし（dev のみ: `typescript`）
  - 実行: `npm run build && node dist/index.js run "<goal>"`
  - テスト: `npm test`（`node --test` ベース）
