# 20260610 トレンド調査レポート — Slopsquatting（AIハルシネーション・パッケージ攻撃）

> 調査基準日: **2026-06-10（JST）** / 過去24時間のIT・AI・テック系トレンドより選定

## 1. 本日採用するトレンド技術要素

**Slopsquatting（スロップスクワッティング）** — AIコーディングアシスタントが「存在しないパッケージ名を幻覚（ハルシネーション）」して提案し、
攻撃者がその架空のパッケージ名を npm / PyPI などの公開レジストリに先回りで登録してマルウェアを配布する、
**ソフトウェアサプライチェーン攻撃**の新カテゴリ。

「typosquatting（タイポスクワッティング＝打ち間違いを狙う）」がAI時代に進化した派生形で、
打ち間違いではなく**LLMの出力の癖（同じ幻覚名が繰り返し再現される性質）**を悪用する点が新しい。

### 要点

- **再現性が高い**: 研究で同一プロンプトを10回再実行したところ、幻覚パッケージ名の **43%** が毎回出現。攻撃者は「狙って」名前を登録できる。
- **発生率**: OSSモデルの幻覚率は平均 **21.7%**、商用モデルは平均 **5.2%**。CodeLlama系は一部構成で **33%超**。GPT-4 Turbo が最低の **3.59%**。
- **コンフレーション（名前の混同合成）**: LLMが実在する2つのパッケージ名を混ぜて架空名を生成する典型パターン。
  例: `jscodeshift` + `react-codemod` → 架空の **`react-codeshift`**（2026年1月に237リポジトリへ波及）。
- **自律エージェントで危険度が上昇**: 従来は「人間がAIの提案コードをレビューしてからインストール」という暗黙のチェックポイントがあったが、
  自律型コーディングエージェントはそれを飛ばして直接 `install` するため、リスクが質的に別次元へ。

## 2. バズっている背景・理由

2026年5〜6月にかけて、npmエコシステムを標的にした大規模サプライチェーン攻撃が立て続けに観測され、
「AI × サプライチェーンセキュリティ」が一気にテック話題の中心へ移動した。

- **2026/06/01**: `@redhat-cloud-services` namespace の **32パッケージ**が侵害され、`Miasma` と名付けられたペイロードを混入（週間平均 約8万DL）。
- 直後のローリングキャンペーンでは **2時間未満**で **57 npmパッケージ / 286+ 悪性バージョン**が侵害。最大の被害は公式 `@vapi-ai/server-sdk`（月間40.8万DL+）。
- 共通手口: `preinstall` スクリプトでインストール時に `index.js` を自動実行 → CI/CD・クラウドID・GitHub認証情報・npm publish ワークフロー・AI開発ツールを標的。
- Hacker News のスタートアップ動向でも「派手なAIデモより、信頼・セキュリティ・依存関係チェックといった**堅実なシステム**」への需要シフトが鮮明に。
- Cloud Security Alliance が2026年4月に slopsquatting の研究ノートを公開し、「**model distillation raids / indirect prompt injection** と並ぶ2026年AIスタック三大攻撃ベクトル」と位置づけ。

## 3. 本日の成果物

- **アプリ名**: `slopguard`
- **言語**: TypeScript（Node.js）— 直近(20260530)の Rust と重複せず、かつ npm エコシステムを直接扱うため最適。
- **概要**: プロジェクトの依存関係（`package.json` / ソース内 `import`・`require`）を走査し、
  **幻覚パッケージ / slopsquat 候補**を検出するオフラインファースト＋オプションでnpmレジストリ照合する防御的CLIスキャナ。
- 詳細は `slopguard/README.md` を参照。

## 4. 参照したSNS・記事アプリ・情報ソース（URL）

- Cloud Security Alliance Labs — *Slopsquatting: AI Code Hallucinations Fuel Supply Chain Attacks* (2026-04): https://labs.cloudsecurityalliance.org/research/csa-research-note-slopsquatting-ai-supply-chain-20260419-csa/
- Aikido — *Slopsquatting: The AI Package Hallucination Attack Already Happening*: https://www.aikido.dev/blog/slopsquatting-ai-package-hallucination-attacks
- Mend.io — *The Hallucinated Package Attack: Slopsquatting Explained*: https://www.mend.io/blog/the-hallucinated-package-attack-slopsquatting/
- ToxSec — *What is Slopsquatting? AI Hallucinations Ship Malware*: https://www.toxsec.com/p/what-is-slopsquatting-ai-hallucinations
- DZone — *Slopsquatting: Catching AI-Hallucinated Packages*: https://dzone.com/articles/slopsquatting-ai-package-scanner
- Palo Alto Unit42 — *The npm Threat Landscape: Attack Surface and Mitigations* (Updated Jun 2): https://unit42.paloaltonetworks.com/monitoring-npm-supply-chain-attacks/
- Wiz Blog — *Miasma: Supply Chain Attack Targeting RedHat npm Packages*: https://www.wiz.io/blog/miasma-supply-chain-attack-targeting-redhat-npm-packages
- Microsoft Security Blog — *Typosquatted npm packages used to steal cloud and CI/CD secrets* (2026-05-28): https://www.microsoft.com/en-us/security/blog/2026/05/28/typosquatted-npm-packages-used-steal-cloud-ci-cd-secrets/
- Orca Security — *TanStack and 160+ npm/PyPI Packages Compromised in Supply Chain Worm Attack*: https://orca.security/resources/blog/tanstack-npm-supply-chain-worm/
- Hacker News Trends — June 2026 (Startup Edition): https://blog.mean.ceo/hacker-news-trends-june-2026/
- LogRocket — *AI dev tool power rankings [June 2026]*: https://blog.logrocket.com/ai-dev-tool-power-rankings/
