# fable-effort-lab

Claude Fable 5（`claude-fable-5`、2026-06-09リリース）の新しいAPI挙動を実際に計測・体験するための
TypeScript製CLIツール。

Fable 5 はAnthropic初の「Mythosクラス」一般提供モデルで、Opus系とはAPI仕様が複数の点で異なる。
このツールはその差分を1コマンドで確認できるようにする:

- **effortパラメータ** (`output_config.effort`: `low`/`medium`/`high`/`xhigh`/`max`) —
  同一プロンプトを複数レベルで実行し、レイテンシ・TTFT・トークン・コストを比較
- **常時ONのadaptive thinking** — `thinking` パラメータは省略（`disabled` は400）。
  `--show-thinking` で要約済み思考（`display: "summarized"`）を表示
- **refusal stop reason** — 安全分類器による拒否（HTTP 200 + `stop_reason: "refusal"`）を
  正しくハンドリングし、`stop_details.category` を表示
- **新トークナイザ** — `count_tokens` が返す新旧両トークナイザのカウント差（約+30%）を計測

## セットアップ

```bash
npm install
npm run build
export ANTHROPIC_API_KEY=sk-ant-...
```

> Fable 5 は30日データ保持が必須。ZDR設定の組織では全リクエストが400になる点に注意。

## 使い方

### 単発実行（ストリーミング）

```bash
node dist/cli.js ask "Explain the CAP theorem in 3 sentences" --effort low
node dist/cli.js ask "Design a rate limiter" --effort xhigh --show-thinking
```

### effortスイープ（比較表）

```bash
node dist/cli.js sweep "Write a haiku about tokenizers"
node dist/cli.js sweep "Prove sqrt(2) is irrational" --efforts low,high,max --answers
```

出力例:

```
| effort | status   | latency | TTFT  | in tok | out tok | cost    |
|--------|----------|---------|-------|--------|---------|---------|
| low    | end_turn | 2.1s    | 410ms | 18     | 64      | $0.0034 |
| medium | end_turn | 4.8s    | 620ms | 18     | 142     | $0.0073 |
| high   | end_turn | 11.3s   | 980ms | 18     | 388     | $0.0196 |
```

### トークナイザ比較

```bash
node dist/cli.js tokens "$(cat somefile.md)"
```

## 構成

```
src/
  cli.ts     — 引数パースとコマンドディスパッチ
  runner.ts  — Fable 5呼び出し（streaming / refusal / count_tokens）
  report.ts  — 比較テーブルと回答レンダリング
  types.ts   — effort定義・価格定数・結果型
```

## 料金メモ

Claude Fable 5: 入力 $10 / 出力 $50（per 1M tokens）。スイープは同一プロンプトをN回実行するため、
`--max-tokens` を絞るかプロンプトを短くしてコストを管理すること。
