# 2026-06-11 (JST) トレンド調査ドキュメント

## 本日のトレンド技術: Agent Skills（SKILL.md オープン標準）

### 概要

**Agent Skills** は、AI コーディングエージェントに専門知識やワークフローを追加するための
軽量・オープンなパッケージ形式。実体は `SKILL.md` ファイル（YAML フロントマター + Markdown 本文）を
含むディレクトリで、スクリプト・テンプレート等の補助ファイルを同梱できる。

- Anthropic が Claude Code 向けに導入後、**オープン標準**として公開（MCP と同じ戦略）
- 2026年現在、**Claude Code / OpenAI Codex CLI / Gemini CLI / GitHub Copilot / Cursor / Cline / Windsurf** が
  同一の SKILL.md 形式をサポートし、エージェント横断の事実上の標準に
- 中核となる設計思想は **プログレッシブ・ディスクロージャ**:
  まずフロントマターのメタデータ（name / description）だけをコンテキストに載せ、
  タスクに関連すると判断されたときのみ本文・補助ファイルを読み込むことでトークンを節約する

### バズっている背景・理由（過去24時間の動向）

1. **本日（2026-06-10〜11）の GitHub Trending をスキル系リポジトリが独占**
   - `mvanhorn/last30days-skill`（Python製リサーチスキル）: **+2,561★/日**
   - `obra/superpowers`（スキルフレームワーク、累計22万★超）: +1,011★/日
   - `addyosmani/agent-skills`（Google Chrome チーム Addy Osmani による実務級スキル集）: +781★/日
   - `phuryn/pm-skills`（PM向けスキルマーケットプレイス）: +775★/日
2. **エコシステムの爆発的成長**: 2026年1月16日の2,179スキルから20日間で40,000超へ（**18.5倍**）。
   3月時点で主要マーケットプレイス（SkillsMP / Skills.sh / ClawHub）合計 **49万スキル** に到達
3. **マルチエージェント対応の確立**: OpenAI が Codex 公式ドキュメントで SKILL.md サポートを明記し、
   「一度書けばどのエージェントでも動く」状態になったことで企業導入が加速
4. **日本国内でも Qiita / Zenn で連日トレンド入り**: 「チーム知識のコード化」というキーワードで
   サイボウズ等の大規模チームの採用事例が共有され、CLAUDE.md・サブエージェント・スラッシュコマンドとの
   使い分け論が活発化

### スキルが増えたことによる新たな課題（＝本日のアプリの着眼点）

- スキルが数十万単位で乱立し、**スペック違反（必須フィールド欠落、name の文字種違反、
  description の肥大化）や品質のばらつき**が問題化
- description が長すぎるスキルを大量に入れると、プログレッシブ・ディスクロージャの利点が消えて
  **コンテキスト汚染**が起きる
- → SKILL.md の **scaffold / validate / lint / 棚卸し** を行う開発者ツールの需要が高い

### 参照ソース（SNS・記事アプリ等）

- GitHub Trending（本日のスキル系リポジトリ独占を確認）: https://github.com/trending
- The New Stack「Agent Skills: Anthropic's Next Bid to Define AI Standards」: https://thenewstack.io/agent-skills-anthropics-next-bid-to-define-ai-standards/
- Firecrawl Blog「Agent Skills Explained: How SKILL.md Files Work and Why They're Everywhere」: https://www.firecrawl.dev/blog/agent-skills
- SKILL.md オープン標準 仕様解説: https://www.agensi.io/learn/skill-md-specification-open-standard
- OSS Insight「Agent Skills Are Not the Endgame」（18.5倍成長の分析）: https://ossinsight.io/blog/agent-skills-explosion-2026
- OpenAI Codex 公式 Agent Skills ドキュメント: https://developers.openai.com/codex/skills
- Agent Skills 公式サイト: https://agentskills.io/home
- Qiita「SKILL.mdでClaude Codeのワークフローを自動化する実践ガイド」: https://qiita.com/nogataka/items/c59defafd0dfb88c4a90
- Qiita「Claude Code・Copilot・Codex・Gemini・Cursorが同じスキルを読める時代」: https://qiita.com/nogataka/items/7476eb9dfc8bca4e0bb8
- Zenn「Agent Skillsに全部賭ける価値はあるか」: https://zenn.dev/tkithrta/articles/f07b7b8cdb7d0c
- Zenn「Claude Code: エージェントスキルとは」: https://zenn.dev/kyash/articles/805ae9729a70bc

## 本日の成果物

- **アプリ名**: `skillforge` — SKILL.md（Agent Skills オープン標準）の scaffold / validate / list / inspect を行う CLI
- **使用言語**: **TypeScript**（Node.js 22）
  - 前日（20260530）の使用言語 Rust と重複しないことを確認済み（履歴: Python → Go → Rust → **TypeScript**）
- **依存ライブラリゼロ**: フロントマターのパーサも自前実装し、`tsc` のみでビルド可能
