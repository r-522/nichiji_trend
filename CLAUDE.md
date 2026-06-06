# 日次トレンドアプリ開発 — 履歴管理 (CLAUDE.md)

このファイルは、日本時間（JST）の日付を基準に「過去24時間のIT/AI/テック系トレンド技術」を調査し、
その技術を用いたアプリを毎日自動開発するタスクの履歴を管理する。

## 運用ルール

1. **タイムゾーン**: 日付は必ず日本時間（JST, UTC+9）基準で取得・算出する。
2. **コンテキスト参照**: タスク開始前に必ず本ファイル（`/root/CLAUDE.md`）を読み込むこと。
3. **使用言語の重複禁止**: 当日のアプリ開発で使う主要プログラミング言語は、下記履歴の
   **直近（前日）の過去エントリで使用した言語と絶対に被らないように**選定する。
4. **成果物の配置**: `/root/[yyyymmdd]/readme.md`（調査ドキュメント）と
   `/root/[yyyymmdd]/[アプリ名]/`（アプリ一式）を作成する。
5. 既存のルール文・履歴は消さず、履歴セクションに追記していく。

## 開発履歴

| 日付 (JST) | 作成アプリ名 | 使用プログラミング言語 | 採用したトレンド技術要素 |
| :--- | :--- | :--- | :--- |
| 20260527 | mcp-toolbox-server | Python | Model Context Protocol (MCP) / JSON-RPC 2.0 over stdio |
| 20260528 | mlkem-hybrid-vault | Go | ポスト量子暗号 (PQC) / ML-KEM-768 (FIPS 203) + X25519 ハイブリッド鍵交換 |
| 20260530 | rust-subagent-swarm | Rust | パラレル・サブエージェント・オーケストレーション / Rust-native AI agent runtime (Antigravity / Rig / AutoAgents 系) |
| 20260607 | skill-forge | TypeScript | 自己進化型エージェントスキル / 永続エージェントメモリ (SkillOpt / Hermes skill-compilation / Cloudflare Agent Memory 系) — 実行履歴を信頼度スコア付きスキルパッケージへコンパイル・再利用 |

> **次回の言語選定メモ**: 直近（20260607）の使用言語は **TypeScript**。翌日は TypeScript 以外の言語を選定すること。
