# skillforge

**Agent Skills（SKILL.md オープン標準）のための CLI ツールキット** — TypeScript / Node.js 製、ランタイム依存ゼロ。

Claude Code・OpenAI Codex CLI・Gemini CLI・GitHub Copilot などが共通でサポートする
SKILL.md 形式のスキルを、**scaffold（雛形生成）/ validate（スペック準拠検証）/
list（棚卸し）/ inspect（トークン予算の可視化）** できます。

## なぜ作ったか

Agent Skills エコシステムは 2026 年に入って 18.5 倍／20日 のペースで成長し、
マーケットプレイス上のスキルは 49 万件を突破しました。一方で、

- 必須フィールド（`name` / `description`）の欠落や命名規則違反
- 肥大化した description によるコンテキスト汚染（プログレッシブ・ディスクロージャの形骸化）
- 本文からの参照ファイル切れ（broken reference）

といった品質問題が顕在化しています。skillforge はこれらを CI でも手元でも検出できる
リンター兼インベントリツールです。

## ビルドと実行

```bash
npm run build          # tsc で dist/ にコンパイル（依存パッケージ不要）
node dist/index.js help
```

## コマンド

### `init <name> [parent-dir]` — スキルの雛形生成

```bash
node dist/index.js init pdf-processing
```

`SKILL.md` + `references/` + `scripts/` の標準レイアウトを生成します。
名前はスペックどおり「小文字英数字をハイフン区切り・64文字以内」のみ受け付けます。

### `validate <path...>` — スペック準拠の検証（CI 向け、エラー時 exit 1）

```bash
node dist/index.js validate examples/code-reviewer examples/Broken_Skill
```

検証ルール:

| ルール | 重大度 | 内容 |
| :--- | :--- | :--- |
| `frontmatter-required` | error | `---` 区切りの YAML フロントマターが必須 |
| `name-required` / `name-format` / `name-length` | error | 必須・小文字英数字+ハイフン・64文字以内 |
| `name-matches-directory` | warning | `name` とディレクトリ名の不一致 |
| `description-required` / `description-length` | error | 必須・1024文字以内 |
| `description-bloat` | warning | 512文字超の description はコンテキスト汚染の原因 |
| `description-trigger` | info | 発動条件（"Use when ..."）の明示を推奨 |
| `allowed-tools-type` | error | `allowed-tools` はリスト形式 |
| `unknown-field` | warning | スペック外のフィールド |
| `body-required` / `body-size` | error/warning | 本文必須・500行以内を推奨 |
| `broken-reference` | error | 本文中の相対リンク先ファイルが存在しない |

### `list <dir>` — ディレクトリ配下のスキル棚卸し

```bash
node dist/index.js list examples
```

各スキルの検証ステータスと、メタデータ／本文の概算トークン数を一覧表示します。

### `inspect <path>` — プログレッシブ・ディスクロージャの可視化

```bash
node dist/index.js inspect examples/code-reviewer
```

レベル1（常時ロードされるメタデータ）／レベル2（発動時に読む本文）／
レベル3（参照時のみ読む補助ファイル）のトークン予算を表示し、
「セッションごとに事前ロードされるのは全体の何%か」を算出します。

## 構成

```
skillforge/
├── package.json / tsconfig.json
├── src/
│   ├── index.ts            # CLI エントリポイント
│   ├── frontmatter.ts      # 依存ゼロの YAML フロントマター・パーサ
│   ├── spec.ts             # Agent Skills スペックの検証ルール
│   ├── skill.ts            # スキルのロードと再帰探索
│   └── commands/           # init / validate / list / inspect
└── examples/
    ├── code-reviewer/      # スペック準拠のサンプルスキル
    └── Broken_Skill/       # わざと違反させた検証デモ用スキル
```
