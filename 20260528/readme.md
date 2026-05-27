# 20260528 日次トレンド調査 — ポスト量子暗号 (PQC) / ML-KEM-768 ハイブリッド鍵交換

**調査日 (JST): 2026年5月28日**

## 1. 本日のトレンド技術

**ML-KEM (FIPS 203, 旧称 CRYSTALS-Kyber) を用いたハイブリッド・ポスト量子暗号 (PQC)。**

ML-KEM は NIST が標準化した格子ベースの鍵カプセル化メカニズム (KEM) で、量子コンピュータに耐性を持つ。
2026年は「仕様から実運用へ」移行が本格化する節目の年とされ、ここ数日のテック系・セキュリティ系メディアで
「移行期限」「ハイブリッド方式」「ハーベスト・ナウ／デクリプト・レイター攻撃」が大きな話題になっている。

### 要点

- **ハイブリッド方式が主流**: 古典暗号 (X25519 等の楕円曲線 DH) と PQC (ML-KEM) を**併用**し、
  共有鍵を両方の出力から導出する。攻撃者は古典・量子の**両方**を破らないと鍵を復元できないため、
  PQC アルゴリズムが将来破られた場合のリスクヘッジになる。
- **Google Chrome** は既に TLS で `X25519 + ML-KEM-768` のハイブリッド鍵交換を本番投入済み。
- **NIST / NSA (CNSA 2.0)** は 2027年以降の新規調達で耐量子暗号を必須化する方針。
- **「Harvest Now, Decrypt Later」**: いま暗号化通信を傍受・保存しておき、将来量子計算機で復号する攻撃。
  これに備えるため、機密データほど**今すぐ**PQC へ移行する必要があるという論調が強まっている。

## 2. バズっている背景・理由

- **日本の動き (CRYPTREC)**: 2026年4月に ML-KEM の外部評価が完了し、CRYPTREC 暗号リスト
  (日本政府推奨暗号) への収載が前進。政府調達における障壁が下がり、国内でも PQC 採用が加速する見込み
  (国家ロードマップは2027年5月頃を予定)。これが直近の日本のテック界隈での話題性を押し上げている。
- **移行期限の現実味**: 各国が2026年末までに国家 PQC 戦略・暗号インベントリ・パイロット導入を求められており、
  「期限が来た／次に何が起きるか」という記事が直近1週間で多数公開された。
- **RSA / ECC の終わりの始まり**: 「なぜ現代の暗号は RSA / ECC を超えて移行するのか」という解説記事が拡散。
- **バックアップ KEM (HQC)** の標準化 (2026–2027 完了予定) も話題で、ML-KEM 一強リスクの議論が活発。
- **開発者視点での実装容易性**: Go 1.24 が標準ライブラリに `crypto/mlkem` と `crypto/hkdf` を追加したことで、
  外部依存なしで ML-KEM ハイブリッド暗号を実装できるようになり、実装ハードルが大幅に低下した点も注目されている。

## 3. 本日の成果物 (アプリ)

`X25519 + ML-KEM-768` ハイブリッド暗号を**Go 標準ライブラリのみ**で実装した CLI ツール
**`mlkem-hybrid-vault`** を開発した。詳細は `mlkem-hybrid-vault/README.md` を参照。

- ハイブリッド KEM による鍵導出 (HKDF-SHA256)
- AES-256-GCM による認証付き暗号化 (改ざん検知付き)
- `keygen` / `encrypt` / `decrypt` / `demo` サブコマンド
- 単体テスト (ラウンドトリップ・改ざん検知・誤鍵拒否) 付き

### 使用言語の選定について

直近 (20260527) の使用言語は **Python**。重複禁止ルールに従い、本日は **Go** を採用した。
Go 1.24 が `crypto/mlkem` を標準ライブラリ化したことで、本トレンド技術を外部依存ゼロで
忠実に実装できるため、技術的にも最適な選択となった。

## 4. 参照したソース (各種記事・SNS・ニュース)

- [Quantum Security Deadlines are Here - What Happens Next? (The Quantum Insider, 2026-05-08)](https://thequantuminsider.com/2026/05/08/post-quantum-migration-timelines-government-industry-impact/)
- [Why Modern Encryption is Moving Beyond RSA and ECC (The Quantum Insider, 2026-05-05)](https://thequantuminsider.com/2026/05/05/why-rsa-and-ecc-are-being-replaced/)
- [Post-Quantum Cryptography Migration at Meta: Framework, Lessons, and Takeaways (Engineering at Meta, 2026-04-16)](https://engineering.fb.com/2026/04/16/security/post-quantum-cryptography-migration-at-meta-framework-lessons-and-takeaways/)
- [Post-Quantum Cryptography for Authentication: The Enterprise Migration Guide 2026 (Security Boulevard)](https://securityboulevard.com/2026/03/post-quantum-cryptography-for-authentication-the-enterprise-migration-guide-2026/)
- [Post-Quantum Cryptography: Global Government Transitions & The 2026 Outlook (QuantumGate)](https://quantumgate.ae/post-quantum-cryptography-how-governments-worldwide-are-shaping-the-transition-ahead)
- [NIST's post-quantum cryptography standards: Our plans (HashiCorp)](https://www.hashicorp.com/en/blog/nist-s-post-quantum-cryptography-standards-our-plans)
- [2026年ITトレンド5選！ エージェンティックAI、量子コンピューターなど (三菱電機デジタルイノベーション)](https://www.mind.co.jp/column/064.html)
- [2026年に注目されそうな10のITトレンドとは (SHIFT ASIA)](https://shiftasia.com/ja/column/2026%E5%B9%B4%E3%81%AB%E6%B3%A8%E7%9B%AE%E3%81%95%E3%82%8C%E3%81%9D%E3%81%86%E3%81%AA10%E3%81%AEit%E3%83%88%E3%83%AC%E3%83%B3%E3%83%89/)

> 注: 上記 URL は調査時点 (2026-05-28 JST) の Web 検索結果に基づく。
