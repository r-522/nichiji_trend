# トレンド調査レポート — 2026/06/04 (JST)

## 本日のテーマ
**WebAssembly によるポータブル AI 推論（WASI-NN / “Wasm AI inference at the edge”）**

採用言語: **TypeScript**（Node.js 22 のネイティブ TypeScript 実行）+ 推論カーネルは
**C → wasm32**。前日（20260530）の使用言語 **Rust** とは重複しない。

---

## 1. 調査したトレンド技術の概要と要点

過去24時間のテック系 SNS／記事フィードで継続的に伸びていたのが、
**「ブラウザの外に出た WebAssembly（Wasm）」**、とりわけ **AI 推論をエッジで動かす Wasm**
という話題群。要点は次の通り。

- **Wasm × AI 推論の融合が 2026 の定番インフラトレンドに**。量子化済み LLM を Wasm
  サンドボックス内で実行し、WebGPU + Wasm によるブラウザ内推論や **WASI-NN** による
  エッジ推論が、もはや実験段階ではなく実運用フェーズへ。
  - Cloudflare Workers が 2026/2 に Llama-3-8B を世界 330 拠点へ展開し、コールドスタート
    5ms 未満・推論 2〜4 倍高速化を達成、という事例が象徴的。
- **WASI 0.3 / Component Model の進展**。WASI 0.3 の目玉は **ネイティブ非同期 I/O**
  （Canonical ABI レベルでの async、`stream<T>` / `future<T>` 型）。プレビューは
  Wasmtime 37+ に入り、完成は 2026 年内、production-stable な **WASI 1.0 は 2026 年後半**
  目標。Wasmtime が Bytecode Alliance 初の “Core Project” 認定を獲得。
- **コンテナを置き換える実行単位としての Wasm**。15MB 級フットプリント・数 ms の
  コールドスタートで「untrusted code を安全にエッジで動かす」用途が主戦場に。
  新規エンタープライズ案件の 67% が最低 1 つの Wasm モジュールを含む、という調査も。
- **ランタイムの成熟**: Wasmtime（業界標準・~15MB・~3ms コールドスタート）、
  **WasmEdge**（エッジ AI 特化・~8MB・~1.5ms・TensorFlow Lite で on-device 推論）。

### なぜこの構成（Wasm カーネル + ホスト言語）なのか
WASI-NN が標準化しているのは、**「ポータブルな計算バックエンド」と「ホスト側が定義する
推論グラフ」の分離**である。本日のアプリはこの分離を最小構成で再現する:
1. 数学だけを行う **freestanding な wasm32 モジュール**（libc も WASI import も無し）。
2. モデルを保持し層を順序実行する **TypeScript ホスト**。
3. 同じ `.wasm` がブラウザ／Node／Raspberry Pi／エッジで**無改変で動く**ポータビリティ。

---

## 2. バズっている背景・理由

- **生成 AI が「実装・運用の年」へ**。推論需要が爆発し、2026 年の AI コンピュートの
  約 2/3 が推論用途と予測。**オンプレ／エッジで動く軽量モデル**の重要性が一気に上昇。
- **コスト・レイテンシ・データ主権**。中央集約クラウド推論ではなく、ユーザー近傍／
  端末側で動かしたいニーズが強まり、「どこでも同じバイナリが走る」Wasm の移植性が刺さる。
- **セキュリティ（capability ベース隔離）**。untrusted なモデル／プラグインを安全な
  サンドボックスで動かせる点が、マルチテナント・プラグインエコシステムで評価。
- **標準化の節目**。WASI 0.3 の native async と WASI 1.0 ロードマップが具体化し、
  「いつの間にか WebAssembly がそこら中にある」という The New Stack の論調が拡散。

---

## 3. 参照した情報ソース（SNS・記事アプリ等）

- WebAssembly Beyond the Browser: WASM in Cloud, Edge, and AI Inference — https://devstarsj.github.io/2026/03/09/webassembly-beyond-browser-cloud-edge-ai-2026/
- WebAssembly at Edge: How Wasm Replaced Containers (byteiota) — https://byteiota.com/webassembly-at-edge-how-wasm-replaced-containers/
- WASI 0.3 Native Async: WebAssembly Gets Concurrent I/O (byteiota) — https://byteiota.com/wasi-0-3-native-async-webassembly-gets-concurrent-i-o/
- State of WebAssembly 2026 — https://devnewsletter.com/p/state-of-webassembly-2026/
- Roadmap · WASI.dev — https://wasi.dev/roadmap
- WASI 1.0: You Won't Know When WebAssembly Is Everywhere in 2026 (The New Stack) — https://thenewstack.io/wasi-1-0-you-wont-know-when-webassembly-is-everywhere-in-2026/
- The WebAssembly Component Model (Bytecode Alliance) — https://component-model.bytecodealliance.org/
- The State of WebAssembly – 2025 and 2026 (Uno Platform) — https://platform.uno/blog/the-state-of-webassembly-2025-2026/
- What's Next in AI: Five Trends to Watch in 2026 (ByteByteGo) — https://blog.bytebytego.com/p/whats-next-in-ai-five-trends-to-watch
- 2026年ITトレンド5選（三菱電機デジタルイノベーション） — https://www.mind.co.jp/column/064.html

---

## 4. 本日の成果物

- 調査ドキュメント: `20260604/readme.md`（本ファイル）
- アプリ: `20260604/wasm-edge-infer/` —
  C 製のポータブル Wasm 推論カーネル（dense / ReLU / softmax / argmax）を
  TypeScript ホストが駆動する 5×7 ビットマップ数字（0–9）認識器。
  WASI-NN 流の「ポータブルバックエンド + ホスト定義グラフ」分離を最小構成で実装。
