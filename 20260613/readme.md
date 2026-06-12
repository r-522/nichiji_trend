# 2026-06-13 (JST) トレンド技術調査ドキュメント

## 本日のテーマ

**npm v12 の Breaking Changes — install scripts デフォルト無効化とソフトウェアサプライチェーン・セキュリティ**

## トレンド技術の概要と要点

GitHub は 2026年6月9日、パッケージマネージャー **npm v12**（2026年7月リリース予定）における
重大な破壊的変更（breaking changes)を公式チェンジログで発表した。発表直後から
Hacker News やセキュリティ系メディア、SNS で大きな話題となり、6月11日〜12日（過去24時間）に
The Hacker News / BleepingComputer / Cybersecurity News など多数の媒体が相次いで報じ、
JavaScript エコシステム全体を巻き込む議論に発展している。

### 変更点の要点

1. **install scripts のデフォルト無効化**
   - `npm install` 時に、依存パッケージの `preinstall` / `install` / `postinstall`
     ライフサイクルスクリプトが **明示的に許可しない限り実行されなくなる**。
   - `binding.gyp` を持つネイティブパッケージに対する暗黙の `node-gyp rebuild` も
     ブロック対象（明示的な install script が無くても実行されるため）。
2. **`--allow-git` のデフォルトが `none` に**
   - Git リポジトリ直接参照の依存（直接・推移的どちらも）は明示許可が無い限り解決されない。
3. **`--allow-remote` のデフォルトが `none` に**
   - `https://` の tarball など、レジストリ外のリモート URL 依存も明示許可制になる。
4. **移行支援コマンド**
   - npm 11.16.0 以降で `npm approve-scripts --allow-scripts-pending` を実行すると、
     スクリプトを持つパッケージを確認し、信頼するものを許可リストとして
     `package.json` にコミットできる。

### バズっている背景・理由

- GitHub は install 時のライフサイクルスクリプトを
  **「npm エコシステムにおける単一最大のコード実行面 (the single largest code-execution
  surface in the npm ecosystem)」** と表現。`npm install` は推移的依存を含む
  **すべての依存パッケージのスクリプトを実行する**ため、依存ツリーのどこか1つが
  侵害されただけで開発者マシンや CI ランナー上で任意コードが実行されてしまう。
- 2025年〜2026年にかけて npm を標的にした大規模サプライチェーン攻撃
  （トークン窃取型ワーム、人気パッケージ乗っ取り等）が頻発しており、
  「ようやく根本対策が入る」「エコシステムが壊れる」と賛否両論で議論が過熱した。
- Hacker News では 2026年6月のトレンドとして「AI の派手なデモよりも信頼・セキュリティ・
  制御されたワークフローに関心が移っている」と総括されており、本件はその象徴的トピック。
- 既存プロジェクトの多くはネイティブモジュール（node-gyp）や postinstall に依存しており、
  **npm 12 へのアップグレードで「どの依存が壊れるか」を事前監査するニーズ**が
  急速に高まっている。本日開発するアプリはまさにこの監査を行うツールである。

## 参照ソース（URL）

- GitHub Changelog（一次情報）: https://github.blog/changelog/2026-06-09-upcoming-breaking-changes-for-npm-v12/
- The Hacker News: https://thehackernews.com/2026/06/github-to-disable-npm-install-scripts.html
- BleepingComputer: https://www.bleepingcomputer.com/news/security/github-announces-npm-security-changes-to-tackle-supply-chain-attacks/
- Cybersecurity News: https://cybersecuritynews.com/github-automated-disable-npm-script-installs/
- Rescana: https://www.rescana.com/post/github-disables-npm-install-scripts-by-default-in-v12-to-prevent-javascript-supply-chain-attacks
- LinuxSecurity: https://linuxsecurity.com/news/vendors-products/npm-v12-disable-install-scripts-default
- Hacker News（コミュニティ動向）: https://news.ycombinator.com/
- 参考・周辺トレンド（同週の他候補）:
  - Apple WWDC26「Core AI」フレームワーク発表: https://www.macrumors.com/2026/06/09/apple-outlines-major-ai-and-developer-tool-updates/
  - Microsoft Build 2026（.NET 11 / C# union types）: https://developer.microsoft.com/blog/build-recap
  - Google I/O 2026（agentic Gemini）: https://developers.googleblog.com/all-the-news-from-the-google-io-2026-developer-keynote/

## 本日の成果物

- **アプリ名**: `npm-script-sentinel`
- **使用言語**: TypeScript (Node.js 22, 外部依存ゼロ)
- **概要**: プロジェクトの `package-lock.json` と `node_modules` をオフラインで走査し、
  npm 12 で実行がブロックされる install scripts / 暗黙の node-gyp ビルド /
  git・remote URL 依存を検出して「npm 12 移行準備レポート」と許可リスト案
  （`package.json` に追記する形式）を生成する CLI 監査ツール。

## 言語選定の検証

| 直近エントリ (20260530) | 本日 (20260613) | 重複 |
| :--- | :--- | :--- |
| Rust | TypeScript | なし ✅ |
