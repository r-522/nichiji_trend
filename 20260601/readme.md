# 20260601 日次トレンド調査レポート

調査対象期間: 2026-05-31 〜 2026-06-01 (JST)
担当: 自動開発ボット

## 1. 本日採用したトレンド技術

**オンデバイス LLM 推論 / GGUF (GGML Universal Format)**

- GGUF は llama.cpp が定義した量子化済み LLM ウェイトのバイナリコンテナ形式で、2026 年現在「量子化モデル配布のデファクトスタンダード」になっている。
- 2026 年に入ってからは、SLM (Small Language Model) のオンデバイス推論が急速に普及しており、Microsoft Phi-3 (3.8B)、Google Gemma 2 (9B)、Meta Llama 3.2 (1B/3B)、Qwen 2.5 などが GGUF 形式で Hugging Face に大量公開されている。
- Meta の ExecuTorch (50KB ベースランタイム / 12 種以上のハードウェアバックエンド対応) や Apple MLX が話題で、エッジ推論 / プライバシー / コスト最適化の文脈で「オンデバイス AI」が SNS や開発者コミュニティでバズり中。
- 同時期、Anthropic が買収した Bun の Zig → Rust リライトが 2026-05-10 に Jarred Sumner からアナウンスされ、システムプログラミング言語としての Rust の存在感がさらに大きくなった。GGUF パーサのような低レベルバイナリ I/O は Rust と相性が非常によい。

## 2. バズっている背景・理由

1. **量子化モデルの爆発的流通**: GGUF + Q4_K_M / Q5_K_M / Q8_0 などの k-quants が普及し、ノート PC や iPhone / Android でも 7B〜13B クラスの LLM が走る時代になった。
2. **大手の参入**: Llama 4 Scout (10M トークン文脈) を Hugging Face / AWS Bedrock で展開、Microsoft Agent 365 が 2026-05-01 GA、Cursor SDK が 2026-05-04 公開、と「エージェント×ローカル推論」の組み合わせが今四半期の主戦場。
3. **インフラ最適化への揺り戻し**: 巨大汎用モデルから「メモリ / 文脈 / ローカル実行速度に最適化された専門ツール」への移行が GitHub Trending 上でも明白 (May 21 のリーダーボードで一週間 73,000+ stars を稼ぐカテゴリ)。
4. **ツール不足**: GGUF ファイルの中身 (メタデータ・テンソル種別・量子化内訳) を素早く確認する CLI ツールはまだ少なく、`gguf-dump.py` 系の Python スクリプトに依存している。Rust 製の軽量 CLI は需要がある。

## 3. 本日構築するアプリ

- アプリ名: **gguf-inspector**
- 言語: **Rust** (前日 20260528 は Go、20260527 は Python のため言語重複なし)
- 機能:
  - GGUF v3 ファイルのバイナリ層をフルパース (magic / version / tensor_count / metadata_kv_count)
  - メタデータ KV ペアを 13 種類のバリュー型 (UINT8〜FLOAT64 + STRING + ARRAY) すべてサポートして抽出
  - テンソル情報 (name / 次元 / GGML 型 / オフセット) を一覧化
  - GGML 型ごとのテンソル数・推定バイト数で量子化内訳サマリを生成
  - 人間向け表示と `--json` モードの両対応
  - 実ファイル不要のセルフテスト用フィクスチャジェネレータ付属

## 4. 参照ソース (代表的なもの)

- Pragmatic Engineer Newsletter, "AI Tooling for Software Engineers in 2026": https://newsletter.pragmaticengineer.com/p/ai-tooling-2026
- "The Best AI Coding Tools of May 2026: A Scorecard" — Medium / Rafael Pires: https://medium.com/@chaos.architect25/the-best-ai-coding-tools-of-may-2026-cf2db2804a0f
- "GitHub Trending May 2026: Agent Skills, antirez's C Comeback & Dirty Frag" — ShareUHack: https://www.shareuhack.com/en/posts/github-trending-weekly-2026-05-13
- "GitHub Trending Top 10: Agents, Memory and On-Device Dominate the Week" — pasqualepillitteri.it: https://pasqualepillitteri.it/en/news/3327/github-trending-top-10-may-2026
- "On-Device LLMs: State of the Union, 2026": https://v-chandra.github.io/on-device-llms/
- "The 2026 LLM Landscape: Small, Fast, On-Device and Reasoning-First" — Michael / Medium: https://medium.com/@Michael38/the-2026-llm-landscape-small-fast-on-device-and-reasoning-first-9b87c9436d3e
- "Best Open-Source Small Language Models (SLMs) in 2026" — BentoML: https://www.bentoml.com/blog/the-best-open-source-small-language-models
- "Bun Rewrites from Zig to Rust — Why a Fast Runtime Is Starting Over" — StartupXO: https://startupxo.com/en/news/2026/05/bun-zig-rust-runtime-rewrite/
- "The Great Zig-to-Rust Experiment" — Rust Bytes / Substack: https://weeklyrust.substack.com/p/the-great-zig-to-rust-experiment
- "Zig vs Rust in 2026" (Hacker News / Lobsters 議論): https://lobste.rs/s/fnhsha/zig_vs_rust_2026
- "Trending AI Repositories on GitHub — Real-Time Rankings 2026" — OSSInsight: https://ossinsight.io/trending/ai
- GGUF 仕様 (ggml-org/ggml docs): https://github.com/ggml-org/ggml/blob/master/docs/gguf.md

## 5. 言語選定の検証

| 日付 | 言語 |
| :--- | :--- |
| 20260527 | Python |
| 20260528 | Go |
| **20260601 (本日)** | **Rust** ← Go と Python のいずれとも重複なし |
