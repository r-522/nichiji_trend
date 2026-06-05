# 20260606 日次トレンド調査 — Agent Skills（SKILL.md）オープン標準 (TypeScript)

**調査日 (JST): 2026年6月6日**

## 1. 本日のトレンド技術

**Agent Skills（エージェント・スキル） / `SKILL.md` オープン標準** —
AIエージェントに「特定タスクのやり方」を後付けで教えるための、極めてシンプルなパッケージ形式。
スキルは **1つのフォルダ＋`SKILL.md` ファイル** で表現され、ファイル先頭の YAML フロントマターに
「**このスキルは何をするか／いつ使うか**（`name` / `description`）」を書き、本文に実際の手順を書く、
というだけのものである。

```
my-skill/
├── SKILL.md          # name / description + 手順本文
├── scripts/          # （任意）実行スクリプト
├── references/       # （任意）詳細ドキュメント（必要時のみ読み込む）
└── assets/           # （任意）テンプレート等
```

この「**設定をMarkdownで書く（configuration-as-markdown）**」発想と、
必要になった時だけ詳細を読み込む「**プログレッシブ・ディスクロージャ**」が、
肥大化しがちなシステムプロンプト／コンテキストの問題に対するシンプルな解として強く支持されている。

## 2. バズっている背景・理由

- **Anthropic が `agentskills.io` でオープン標準として公開**（Apache-2.0 / CC-BY-4.0）。
  仕様が公開されてから **数週間で業界標準化** という異例の速度で普及した。
- **マルチベンダーが即座に採用**: 公開から数日で **Microsoft が VS Code / GitHub Copilot に
  `SKILL.md` サポートを統合**、**OpenAI が Codex CLI / ChatGPT に構造的に同一のアーキテクチャを採用**、
  さらに **Cursor / Amp / Goose / OpenCode / Letta** などが続いた。
- **「MCP は終わったのか？」論争**: 直近のテック界隈では *「MCP（外部アクションの実行）vs CLI vs Skills
  （推論・手順の構造化）」* という比較記事が量産され、結論として
  **「Skills で計画を構造化し、MCP でアクションを実行する」ハイブリッド構成**に落ち着きつつある、
  という整理が繰り返し共有されている。
- **コミュニティ・エコシステムの爆発**: 2026年3月時点でコミュニティの
  「Awesome Skills」ライブラリには **16以上のエージェントに対応した 1,234 以上のスキル**が登録され、
  Microsoft の `microsoft/skills` リポジトリでも **128スキル / 1,158テストシナリオ**が整備されるなど、
  「スキルにも受け入れ基準・テストを」という**スキルの品質保証（CI）**が次のテーマになっている。
- **`.md` ファイル群の標準化トレンド**: `SKILL.md` / `AGENTS.md` / `CLAUDE.md` といった
  「エージェント向けMarkdownファイル」の比較・ガイド記事が SNS・技術ブログで急増している。

> つまり「フォーマットは普及した。次は**それを検証・lint・カタログ化する周辺ツール**が要る」という
> フェーズに入っており、本日はそこに当てるツールを開発する。

## 3. 本日の成果物（採用言語: TypeScript）

直近履歴の使用言語（20260530 = **Rust**）と重複しないよう、本日は **TypeScript / Node.js** を採用。
`SKILL.md` エコシステムのツーリング（VS Code / Copilot 等）が TS 中心であることとも整合する。

### アプリ名: `skillsmith`

Agent Skills 標準のための **依存ゼロ（zero-dependency）な検証・lint・カタログ化・雛形生成 CLI**。
ランタイム依存パッケージを一切持たず（YAML フロントマターのパーサも自前実装）、`tsx` でそのまま実行できる。

| サブコマンド | 機能 |
| :--- | :--- |
| `validate <path...>` | `SKILL.md` を**仕様準拠検証**。エラー時は終了コード 1（CI 連携可） |
| `lint <path...>` | 作法・ベストプラクティスの助言（warning / info） |
| `check <path...>` | validate + lint を一括実行 |
| `index <dir>` | ツリーを再帰探索し**レジストリ・カタログ（JSON）**を生成 |
| `init <name>` | 仕様準拠スキルの**雛形を生成** |

**検証ルール（抜粋）**:
- フロントマター（`---`）の有無とパース可否
- 必須 `name` / `description` の有無
- `name`: `a-z0-9` と単一ハイフンのみ・64文字以下・**フォルダ名と一致**
- `description`: 非空・1024文字以下
- `compatibility` 500文字以下、`metadata` はマッピング
- 本文（手順）が非空であること
- プログレッシブ・ディスクロージャ（本文の肥大化を warning）

主要モジュール: `frontmatter.ts`（自前YAMLパーサ）/ `spec.ts`（仕様定数）/ `validator.ts` /
`linter.ts` / `indexer.ts` / `scaffold.ts` / `cli.ts`。
`node:test` による単体テスト 18 件、`tsc --noEmit` 型チェック、CLI の E2E 動作（validate / lint /
index / init）まで確認済み。

## 4. 参照した情報ソース

- Agent Skills 公式仕様 — https://agentskills.io/specification
- SKILL.md Spec フィールド・リファレンス（agensi.io）— https://www.agensi.io/learn/skill-md-format-reference
- 「MCP, Skills, and Agents」(cra.mr) — https://cra.mr/mcp-skills-and-agents/
- 「Is MCP Dead? MCP vs CLI vs Agent Skills Compared」(Milvus) — https://milvus.io/blog/is-mcp-dead-cli-and-skills-for-ai-agents.md
- 「Closing the Context Gap: Why MCP + Skills Works」(AAIF) — https://aaif.io/blog/closing-the-context-gap-why-mcp-skills-works/
- Agent Markdown Files 完全ガイド (explainx.ai) — https://explainx.ai/blog/agent-markdown-files-complete-guide-2026
- Microsoft `skills` リポジトリ — https://github.com/microsoft/skills
- Agent Skills | Microsoft Learn — https://learn.microsoft.com/en-us/agent-framework/agents/skills
- Agent Skills – Codex | OpenAI Developers — https://developers.openai.com/codex/skills
- anthropics/skills（参考実装・Issue #249）— https://github.com/anthropics/skills/issues/249
- Best AI Tools for Developers 2026（GitHub community discussion）— https://github.com/orgs/community/discussions/187143
- Latest AI Trends June 2026 — https://blog.mean.ceo/latest-ai-trends-june-2026/

> ※調査は 2026年6月6日（JST）時点。各記事はトレンドの背景把握に用い、仕様詳細は公式仕様および
> 参考実装の記述を一次情報として実装に反映した。
