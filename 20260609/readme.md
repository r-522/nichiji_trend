# 20260609 トレンド調査レポート — AGENTS.md（AIコーディングエージェント向けオープン標準）

> 調査基準日時: 2026-06-09（JST, UTC+9）。過去24時間以内にSNS・テック系記事で
> 話題になっているIT/AI技術要素を調査し、本日開発するアプリのテーマを選定した。

## 1. 本日採用したトレンド技術

**AGENTS.md** — AIコーディングエージェントにプロジェクト固有の指示を渡すための、
ツール横断のオープンフォーマット（Markdown 1ファイル）。

- README.md は「人間向け」、AGENTS.md は「エージェント向け」という棲み分けで、
  ビルド手順・テスト方法・コーディング規約・制約（boundaries）などを記述する。
- もともと OpenAI が提唱し、**2025年12月に Linux Foundation の
  「Agentic AI Foundation」**配下に移管された（Anthropic の Model Context Protocol、
  Block の Goose と並ぶ位置づけ）。メンバーには OpenAI / Anthropic / Google / AWS /
  Bloomberg / Cloudflare などが名を連ねる。
- 既に **GitHub 上の 60,000 以上のリポジトリ**が AGENTS.md を採用。Codex CLI /
  GitHub Copilot / Cursor / Windsurf / Amp / Devin などが**ネイティブに読み込む**
  （Claude Code は CLAUDE.md、Gemini CLI は GEMINI.md を使用）。

### 仕様の要点

- **フォーマット**: 構文上は「ただのMarkdown」。専用スキーマは強制されないが、
  実務上は以下のセクションが推奨される。
  - Project overview / context（プロジェクト概要）
  - Build & development commands（ビルド・起動コマンド）
  - Testing instructions（テスト手順）
  - Code style & conventions（コード規約）
  - Constraints / boundaries（やってはいけないこと）
  - Workflow / PR preferences（コミット・PR運用）
- **モノレポでの近接ファイル解決（nearest-file resolution）**: エージェントは
  リポジトリのルートから現在の作業ディレクトリ（cwd）に向かってパスを辿り、
  途中で見つかった**すべての AGENTS.md を結合**する。**cwd に近いファイルほど
  優先度が高い**（より具体的な指示が上位の汎用指示を上書きする）。
  サブパッケージごとに `packages/api/AGENTS.md` のように個別配置するのが
  デフォルト推奨。OpenAI 本体リポジトリには 88 個の AGENTS.md があるという。
- **@-参照（progressive disclosure）**: ルートの AGENTS.md から
  `@emails/AGENTS.md` のように相対参照でネストファイルへ誘導するパターンが
  推奨されている（v1.1 提案で明示化が議論中）。

## 2. バズっている背景・理由

- **2026年最大のトレンドが「AIエージェントの実用化」**であること。Claude Code /
  OpenAI Codex / GitHub Copilot Agent など自律型エージェントが普及し、開発者の
  仕事が「コードを書く」から「エージェントに指示を出す」へシフト。指示の品質を
  決める“コンテキストファイル”の標準化ニーズが急上昇した。
- **設定ファイルの乱立問題（CLAUDE.md / GEMINI.md / .cursorrules / .github/copilot-instructions.md など）**を
  一本化する動きとして AGENTS.md が支持され、Linux Foundation 移管により
  「中立な業界標準」という信頼が加わった。
- HN / X では「2026 will be the year of on-device agents」「MCP の復権」などと並び、
  エージェント運用の実務（trust / governance / 信頼性）に話題の重心が移っており、
  AGENTS.md はその“足回り”として注目度が高い。

## 3. 本日開発するアプリ

`agentsmd-toolkit` — AGENTS.md 標準を扱う**依存ゼロの TypeScript CLI**。

- `validate`: AGENTS.md をベストプラクティス仕様に照らして検証（推奨セクションの
  有無、壊れた @-参照、肥大化の警告 など）。
- `resolve`: 指定ディレクトリについて、ルートから cwd までを辿って AGENTS.md を
  収集し、**結合順・優先度（近接ファイル解決）**を可視化。
- `init`: 推奨セクション入りの AGENTS.md ひな形を生成。
- `migrate`: 既存の CLAUDE.md / GEMINI.md を AGENTS.md に変換。

→ 詳細は [`agentsmd-toolkit/README.md`](./agentsmd-toolkit/README.md) を参照。

### 言語選定について

CLAUDE.md の履歴より直近（20260530）の使用言語は **Rust**。重複禁止ルールに従い、
本日は **TypeScript** を選定（過去履歴 Python / Go / Rust いずれとも重複なし）。
AGENTS.md ツール群は JS/TS エコシステムが中心であり、テーマとの親和性も高い。

## 4. 参照ソース（各種SNS・記事・一次情報）

- AGENTS.md 公式サイト: https://agents.md/
- GitHub: agentsmd/agents.md（オープン標準のリポジトリ）: https://github.com/agentsmd/agents.md
- モノレポでの近接ファイル解決に関する Issue #53: https://github.com/agentsmd/agents.md/issues/53
- v1.1 提案（セマンティクスの明示化）Issue #135: https://github.com/agentsmd/agents.md/issues/135
- OpenAI Developers — Custom instructions with AGENTS.md: https://developers.openai.com/codex/guides/agents-md
- AGENTS.md Complete Guide 2026: https://codersera.com/blog/agents-md-complete-guide-2026/
- Augment Code — How to Build Your AGENTS.md (2026): https://www.augmentcode.com/guides/how-to-build-agents-md
- DEV — Steering AI Agents in Monorepos with AGENTS.md: https://dev.to/datadog-frontend-dev/steering-ai-agents-in-monorepos-with-agentsmd-13g0
- DEV — CLAUDE.md, AGENTS.md, and Every AI Config File Explained: https://dev.to/deployhq/claudemd-agentsmd-and-every-ai-config-file-explained-4pde
- HN: 2026 will be the year of on-device agents: https://news.ycombinator.com/item?id=46471524
- Hacker News Trends June 2026 (Startup Edition): https://blog.mean.ceo/hacker-news-trends-june-2026/
- TECH+（マイナビ）開発者が選ぶ2026年注目のAI技術: https://news.mynavi.jp/techplus/article/20251230-3877710/
- Qiita —【2026年版】エンジニアが押さえるべき技術トレンド10選: https://qiita.com/kotaro_ai_lab/items/a5c954b8c9955fe1e113
