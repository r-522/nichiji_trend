# 日次トレンド調査ドキュメント — 2026/06/05 (JST)

## 本日採用したトレンド技術: **WebMCP（Web Model Context Protocol / `navigator.modelContext`）**

- **調査基準日時**: 2026-06-05 03:xx (JST, UTC+9)
- **対象期間**: 過去24時間前後でSNS・テック系記事アプリにてバズっている IT/AI トピック
- **使用プログラミング言語**: **JavaScript（ESM, ブラウザネイティブ）**
  - 直近（20260530）の使用言語は **Rust**。本日は重複回避のため **JavaScript** を選定（過去履歴 Python / Go / Rust とも未重複）。

---

## 1. 技術概要

**WebMCP（Web Model Context Protocol）** は、Webページが自身の機能を「構造化されたツール（tool）」として、
ブラウザ上で動作する AI エージェントに直接公開できるようにする、ブラウザネイティブの新しいWeb標準提案である。

従来、ブラウザ上の AI エージェントは「スクリーンショットを撮る → 画像をビジョンモデルに送る → どこをクリックするか推測する」
という不安定な DOM 操作（=画面の見た目への依存）でWebサイトを操作していた。WebMCP はこれを置き換え、
サイト側が **「自分にできること（ツール名・説明・入力スキーマ）」をエージェントに宣言** することで、
エージェントが API を呼ぶように確実・高速にサイト機能を実行できるようにする。

### コアAPI: `navigator.modelContext`

WebMCP はブラウザに `navigator.modelContext` オブジェクトを追加する。主要メソッドは以下:

| メソッド | 役割 |
| :--- | :--- |
| `registerTool(toolDef)` | ツールを1件登録する |
| `unregisterTool(name)` | ツールを登録解除する |
| `provideContext({ tools })` | ページ状態に応じてツール一式をまとめて宣言・置換する |
| `clearContext()` | 宣言済みコンテキスト（ツール群）をクリアする |

ツール定義は MCP（Anthropic の Model Context Protocol）と親和的な形をとる:

```javascript
navigator.modelContext.registerTool({
  name: "addTodo",
  description: "Add a new item to the user's to-do list.",
  inputSchema: {                       // JSON Schema
    type: "object",
    properties: {
      text:     { type: "string", description: "The task description" },
      priority: { type: "string", enum: ["low", "medium", "high"] }
    },
    required: ["text"]
  },
  execute: async ({ text, priority = "medium" }) => {
    // ページ内のアプリ状態を実際に更新する
    return { content: [{ type: "text", text: `Added: "${text}" (${priority})` }] };
  }
});
```

`execute` はエージェントが渡したパラメータ（`inputSchema` に整合）を受け取り、
ページ内アプリのロジックを実行し、MCP 互換の `{ content: [{ type: "text", text }] }` 形式を返す。

### 2つの提供方式

- **Imperative API**: JavaScript で動的なツール（フォーム入力・ナビゲーション・状態管理など）を定義する。
- **Declarative API**: 標準的な HTML フォームに注釈（アノテーション）を付けるだけでツール化する。

---

## 2. バズっている背景・理由

1. **Google I/O 2026 の目玉発表のひとつ**として大きく取り上げられた。Chrome / Gemini チームが「エージェンティック Web」の中核として推進。
2. **2026-05-19、Chrome チームが WebMCP を Chrome 149 の公開 Origin Trial へ移行すると正式表明**（コンパニオン文書は 5/18 公開）。
   「behind-a-flag のプロトタイプ」から、一般開発者が実サイトで試せる段階に到達した、という"解禁"インパクトが直近24h で拡散。
3. **W3C Web Machine Learning Community Group** の Draft Community Group Report（2026-02-10）として標準化が進行。Google と Microsoft のエンジニアが共同で策定しており、ベンダー横断の本気度が話題に。
4. **MCP（サーバ側）の爆発的普及の延長線上**にある「ブラウザ版 MCP」という位置づけがわかりやすく、
   「すべての Web サイトが AI エージェント向けの API になる」という強いナラティブを生んでいる。
5. スクレイピング/自動化・アクセシビリティ・SEO 文脈でも「エージェント対応（agent-ready）サイト」というキーワードで多数のチュートリアル記事が同時多発的に出ている。

---

## 3. 参照したSNS・記事アプリ・情報ソース（複数）

- Google Developers Blog — Google I/O 2026 keynote まとめ: https://developers.googleblog.com/all-the-news-from-the-google-io-2026-developer-keynote/
- Chrome for Developers — Chrome at I/O 2026: https://developer.chrome.com/blog/chrome-at-io26
- Chrome for Developers — WebMCP docs: https://developer.chrome.com/docs/ai/webmcp
- Chrome for Developers — WebMCP early preview: https://developer.chrome.com/blog/webmcp-epp
- WebMCP API Proposal (W3C WebML CG): https://webmachinelearning.github.io/webmcp/docs/proposal.html
- PPC Land — Chrome 149 origin trial puts WebMCP in developers' hands: https://ppc.land/chrome-149-origin-trial-puts-webmcp-in-developers-hands-at-last/
- DEV Community — WebMCP Is the Most Important Thing Google Announced at I/O 2026: https://dev.to/tejas1643/webmcp-is-the-most-important-thing-google-announced-at-io-2026-and-almost-nobody-is-talking-about-1j8m
- DEV Community — Chrome's WebMCP Early Preview: https://dev.to/axrisi/chromes-webmcp-early-preview-the-end-of-ai-agents-clicking-buttons-b6e
- DataCamp — WebMCP Tutorial: https://www.datacamp.com/tutorial/webmcp-tutorial
- Zuplo — What is WebMCP: https://zuplo.com/blog/what-is-webmcp
- Medium (A B Vijay Kumar) — WebMCP: Agents are learning to browse better: https://abvijaykumar.medium.com/webmcp-web-model-context-protocol-agents-are-learning-to-browse-better-22fcefc981d7
- MCP-B / WebMCP-org (関連 OSS 実装): https://github.com/WebMCP-org

> ※ URL は調査時点で参照したソース。WebMCP は提案/Origin Trial 段階の技術であり、API 詳細は今後変動しうる。
