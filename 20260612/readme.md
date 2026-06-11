# 20260612 トレンド調査ドキュメント（JST）

## 本日のトレンド技術: Claude Fable 5 / Mythos 5（Mythosクラスモデルと安全分類器アーキテクチャ）

### 概要

2026年6月9日、Anthropicは新モデルファミリー **Claude Fable 5** と **Claude Mythos 5** をリリースした。
従来のOpus/Sonnet/Haikuの上位に位置する新ティア「Mythosクラス」のモデルで、両者は**同一の基盤モデル**を共有しつつ、

- **Claude Fable 5** (`claude-fable-5`): 安全分類器（safety classifiers）を組み込んだ一般提供（GA）版
- **Claude Mythos 5** (`claude-mythos-5`): 分類器なし、承認済み組織（Project Glasswing）限定版

という「能力ではなく安全レイヤーで製品を分ける」初の試みとして提供される。

### 技術的な要点（API観点）

| 項目 | 内容 |
| :--- | :--- |
| モデルID | `claude-fable-5`（1Mコンテキスト / 128K最大出力） |
| 思考（thinking） | 常時ON。`thinking` パラメータは省略（`disabled` や `budget_tokens` は400エラー） |
| 深さ制御 | `output_config.effort`: `low` / `medium` / `high` / `xhigh` / `max` の5段階 |
| 新トークナイザ | 同一テキストでOpus系比 **約+30%** のトークン数。`count_tokens` が新旧両方のカウントを返す |
| refusal stop reason | 安全分類器が拒否するとHTTP 200 + `stop_reason: "refusal"`（`stop_details.category` に `cyber`/`bio` 等） |
| フォールバック | beta `fallbacks` パラメータで拒否時に `claude-opus-4-8` へサーバーサイド再試行可能 |
| 価格 | $10 / $50 per 1M tokens（入力/出力） |
| データ保持 | 30日保持が必須（ZDR組織では利用不可） |

### バズっている背景・理由

1. **「Mythosクラス」一般開放のインパクト**: これまで招待制だったMythos Preview級の能力が
   一般開発者に開放された。CursorBenchでSOTA、長時間の自律エージェントタスクで従来モデルを大幅に上回ると報告され、
   Ethan Mollick等の著名研究者が「他のあらゆる公開モデルをかなりの差で上回る」と評価。
2. **安全分類器を巡る論争**: フロンティアLLM開発の検知時にモデルが暗黙的に能力を制限する仕様が開示され、
   「secret sabotage（密かな妨害）だ」とAI研究者コミュニティで大論争に。Nathan Lambert（Arcee AI）らが強く批判し、
   リリースから48時間以上経った6月10日〜11日もFortune、Decrypt等で連日記事化され炎上が継続中。
3. **エンタープライズへの波及**: AWS（Bedrock）で同日提供開始。30日データ保持必須のため
   ゼロデータ保持（ZDR）契約の欧州企業が利用できない問題も議論を呼んでいる。
4. **「AIが危険になりすぎている」と警告した数日後のリリース**という矛盾を突くTechCrunch等の報道も拡散を後押し。

### 参照ソース（SNS・記事アプリ・ニュースサイト）

- Anthropic 公式発表: https://www.anthropic.com/news/claude-fable-5-mythos-5
- TechCrunch: https://techcrunch.com/2026/06/09/anthropic-released-claude-fable-5-its-most-powerful-model-publicly-days-after-warning-ai-is-getting-too-dangerous/
- CNBC: https://www.cnbc.com/2026/06/09/anthropic-mythos-claude-fable-5.html
- Fortune（6/10）: https://fortune.com/2026/06/10/anthropic-accu-claude-fable-5-limits-capabilities-ai-researchers-developers/
- Fortune（6/11）: https://fortune.com/2026/06/11/anthropic-mythos-fable-5-ceos-govern-ai/
- Decrypt: https://decrypt.co/370688/internet-furious-anthropic-claude-mythos-fable-5
- The New Stack: https://thenewstack.io/anthropic-claude-mythos-fable-5/
- Fast Company: https://www.fastcompany.com/91556393/anthropic-mythos-developer-version
- AWS公式ブログ: https://aws.amazon.com/blogs/aws/anthropic-claude-fable-5-on-aws-mythos-class-capabilities-with-built-in-safeguards-now-available/
- Hacker News トレンドまとめ: https://blog.mean.ceo/hacker-news-trends-june-2026/

### その他に検討したトレンド候補（過去24〜72時間）

- **Apple WWDC 2026**（6/9）: Foundation Models フレームワークのPrivate Cloud Compute無償開放、
  Swift API経由でClaude/Gemini等サードパーティモデル呼び出し → 実装言語Swiftがこの環境でビルド不可のため見送り
- **Microsoft Agent 365 SDK GA**（Build 2026）
- **NVIDIA Cosmos 3**: 物理AI向け初の完全オープン「オムニモデル」
- **Google I/O 2026**: Gemini 3.5系、Antigravityのエージェントオーケストレーション強化

## 本日の成果物

- **アプリ名**: `fable-effort-lab`
- **使用言語**: TypeScript（前日20260530のRustと重複なし。履歴上のPython/Go/Rustとも重複なし）
- **内容**: Claude Fable 5 の新API仕様（effortパラメータ、常時ONのadaptive thinking、refusal stop reason、
  新トークナイザ）を実際に体験・計測できるCLIツール。同一プロンプトを複数のeffortレベルで実行し、
  レイテンシ・トークン使用量・コストを比較する。
