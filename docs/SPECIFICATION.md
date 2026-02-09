# Knot - MVP仕様書

> **Note**: この仕様書は初期設計時点のものです。実装上の変更点は `DESIGN_DECISIONS.md` を参照してください。

> **Knot** — 自分だけが解ける結び目
> Know + Not = 他者は知ることができない

## 概要

Knotは、プライバシーファーストの暗号化ノートアプリです。ローカルファーストで設計され、すべてのデータはユーザーの鍵でのみ復号可能です。将来的にはP2P同期、削除証明、完全監査可能性を備えた「Proton Mailの教訓を活かした」アプリを目指します。

---

## 設計思想

### 脅威モデル

| 脅威 | 防御レベル | 対策 |
|------|-----------|------|
| ネットワーク盗聴 | ✅ 完全防御 | E2E暗号化（将来の同期時） |
| サーバー侵害 | ✅ 完全防御 | ゼロ知識設計 |
| 端末紛失・盗難 | ✅ 完全防御 | ローカル暗号化 + 強いパスワード |
| クラウド業者の覗き見 | ✅ 完全防御 | クライアント側暗号化 |
| 物理アクセス（電源ON中） | ⚠️ 軽減 | 自動ロック、メモリ保護 |
| マルウェア・キーロガー | ⚠️ スコープ外 | アプリ外の問題 |
| 国家レベルの攻撃 | ⚠️ 将来対応 | Tor統合、Plausible Deniability |

### 設計原則

1. **「取らない」ではなく「取れない」** — ポリシーではなく技術で保証
2. **ローカルファースト** — オフラインでも完全動作
3. **ゼロ知識** — サーバーがあっても内容を知れない設計
4. **オープンソース** — 信頼のための透明性（AGPL-3.0）

---

## 技術スタック

### フロントエンド
- **言語**: TypeScript
- **フレームワーク**: React 18+
- **ビルド**: Vite
- **状態管理**: Zustand
- **エディタ**: CodeMirror 6
- **スタイル**: Tailwind CSS

### バックエンド
- **言語**: Rust
- **フレームワーク**: Tauri 1.5+
- **暗号化**: 
  - sodiumoxide（libsodiumバインディング）
  - argon2（鍵導出）
- **ストレージ**: rusqlite + SQLCipher
- **リカバリー**: bip39

### 暗号アルゴリズム

| 用途 | アルゴリズム | 備考 |
|------|-------------|------|
| 鍵導出 | Argon2id | メモリ64MB, 反復3, 並列4 |
| 対称暗号 | XChaCha20-Poly1305 | ノート本文の暗号化 |
| DB暗号化 | SQLCipher (AES-256) | メタデータ含むDB全体 |
| リカバリー | BIP39 + HKDF | 12単語ニーモニック |

---

## 機能要件

### Phase 1: MVP

#### 1. 認証システム

**初回セットアップ**
- マスターパスワードの設定（強度メーター付き）
- リカバリーキー生成（オプション、BIP39形式）
- リカバリーキーのPDF出力機能

**ロック/アンロック**
- パスワードによるアンロック
- 自動ロック（デフォルト5分、設定可能）
- パスワード試行制限（5回失敗で30秒待機）
- リカバリーキーによる復元

#### 2. ノート機能

**エディタ**
- Markdown記法（CommonMark準拠）
- `[[ノート名]]` 形式のWikiリンク
- リアルタイムプレビュー（オプション）
- 基本的なツールバー（太字、斜体、見出し、リスト、リンク）

**ノート管理**
- 作成、編集、削除
- ノート一覧表示（更新日時順）
- 全文検索
- 暗号学的削除（将来：削除証明）

#### 3. セキュリティ機能

**暗号化**
- すべてのノートをXChaCha20-Poly1305で暗号化
- DBはSQLCipherで暗号化
- パスワードはArgon2idで導出

**メモリ保護**
- 機密データは使用後にゼロクリア
- パスワードは平文でディスクに書かない

### Phase 2: 同期（将来）

- E2E暗号化同期プロトコル
- P2P直接同期（libp2p）
- オプションのリレーサーバー（ゼロ知識）
- CRDT（Automerge/Yrs）によるコンフリクト解決
- 監査ログ（署名付き操作履歴）

### Phase 3: 匿名性強化（将来）

- Tor統合
- メタデータ暗号化（ファイル名、タイムスタンプ）
- Plausible Deniability（隠しボリューム）
- 削除証明の暗号学的実装

### Phase 4: 拡張（将来）

- モバイル対応（Tauri 2.0 / Android / iOS）
- ハードウェアキー対応（YubiKey）
- 前方秘匿性（PFS）
- ポスト量子暗号

---

## 非機能要件

### セキュリティ
- すべてのデータはローカルで暗号化された状態で保存
- パスワードは絶対に平文保存しない
- 暗号化キーはメモリ上でのみ存在し、ロック時に破棄
- サイドチャネル攻撃を考慮した実装（定数時間比較など）

### パフォーマンス
- 起動時間: 2秒以内
- ノート切り替え: 100ms以内
- 検索応答: 500ms以内（1000ノートまで）

### ユーザビリティ
- オフラインで完全動作
- データのインポート/エクスポート（Phase 2以降）
- キーボードショートカット

### 互換性
- Windows 10+
- macOS 10.15+
- Linux（Ubuntu 20.04+, Fedora 35+）

---

## データモデル

### Note

```rust
pub struct Note {
    pub id: Uuid,
    pub title: String,
    pub content: String,          // Markdown
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

### EncryptedNote（保存形式）

```rust
pub struct EncryptedNote {
    pub id: Uuid,
    pub encrypted_data: Vec<u8>,  // version + nonce + ciphertext + tag
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

### Vault（金庫）

```rust
pub struct Vault {
    pub salt: [u8; 32],                    // パスワード用ソルト
    pub encrypted_dek: Vec<u8>,            // 暗号化されたDEK
    pub recovery_key_encrypted_dek: Option<Vec<u8>>,  // リカバリー用
    pub created_at: DateTime<Utc>,
}
```

---

## 鍵管理フロー

### セットアップ時

```
1. ユーザーがパスワード入力
2. ランダムなソルト生成
3. Argon2id(password, salt) → Master Key
4. ランダムなDEK（Data Encryption Key）生成
5. Master KeyでDEKを暗号化して保存
6. (オプション) リカバリーキー生成
   - 128bitエントロピー → BIP39ニーモニック
   - HKDF(entropy) → Recovery KEK
   - Recovery KEKでDEKを暗号化して保存
```

### アンロック時

```
1. ユーザーがパスワード入力
2. 保存されたソルトを読み込み
3. Argon2id(password, salt) → Master Key
4. Master Keyで暗号化DEKを復号
5. DEKをメモリに保持（ロックまで）
```

### リカバリー時

```
1. ユーザーが12単語入力
2. BIP39 → entropy
3. HKDF(entropy) → Recovery KEK
4. Recovery KEKで暗号化DEKを復号
5. 新しいパスワードを設定
6. 新しいMaster KeyでDEKを再暗号化
```

---

## 暗号化フォーマット

### 暗号化データ構造

```
┌────────────────────────────────────────┐
│  Version (1 byte)     │ 0x01           │
├───────────────────────┼────────────────┤
│  Nonce (24 bytes)     │ ランダム       │
├───────────────────────┼────────────────┤
│  Ciphertext (可変長)  │ 暗号化データ    │
├───────────────────────┼────────────────┤
│  Auth Tag (16 bytes)  │ Poly1305タグ   │
└───────────────────────┴────────────────┘
```

---

## プロジェクト構造

```
knot/
├── src-tauri/                 # Rust バックエンド
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   ├── crypto/
│   │   │   ├── mod.rs
│   │   │   ├── keys.rs       # 鍵導出・管理
│   │   │   ├── cipher.rs     # 暗号化/復号
│   │   │   └── recovery.rs   # リカバリーキー
│   │   ├── storage/
│   │   │   ├── mod.rs
│   │   │   ├── database.rs   # SQLCipher
│   │   │   ├── notes.rs      # ノートCRUD
│   │   │   └── search.rs     # 検索
│   │   ├── commands/
│   │   │   ├── mod.rs
│   │   │   ├── auth.rs       # 認証コマンド
│   │   │   ├── notes.rs      # ノートコマンド
│   │   │   └── settings.rs   # 設定コマンド
│   │   └── models/
│   │       ├── mod.rs
│   │       ├── note.rs
│   │       └── vault.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── src/                       # TypeScript フロントエンド
│   ├── App.tsx
│   ├── main.tsx
│   ├── components/
│   │   ├── Editor/
│   │   ├── Sidebar/
│   │   ├── Auth/
│   │   └── Settings/
│   ├── hooks/
│   ├── stores/
│   ├── lib/
│   └── styles/
│
├── package.json
├── tsconfig.json
├── vite.config.ts
├── LICENSE                    # AGPL-3.0
└── README.md
```

---

## Rust依存関係

```toml
[dependencies]
tauri = { version = "1.5", features = ["shell-open"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

# 暗号化
sodiumoxide = "0.2"
argon2 = "0.5"
rand = "0.8"

# ストレージ
rusqlite = { version = "0.30", features = ["bundled-sqlcipher"] }

# リカバリーキー
bip39 = "2.0"

# ユーティリティ
thiserror = "1.0"
chrono = { version = "0.4", features = ["serde"] }
uuid = { version = "1.6", features = ["v4", "serde"] }
zeroize = "1.7"  # メモリのゼロクリア
```

---

## UI画面一覧

1. **SetupScreen** - 初回パスワード設定
2. **RecoveryKeyScreen** - リカバリーキー表示
3. **UnlockScreen** - パスワード入力
4. **RecoveryScreen** - リカバリーキーで復元
5. **MainScreen** - メインエディタ画面
   - Sidebar（ノート一覧、検索）
   - Editor（Markdownエディタ）
   - Toolbar（書式設定）
6. **SettingsScreen** - 設定画面

---

## 設定項目

| 項目 | デフォルト | 説明 |
|------|-----------|------|
| 自動ロック時間 | 5分 | 0で無効化 |
| エディタフォントサイズ | 14px | 12-24px |
| テーマ | システム | Light / Dark / System |
| スペルチェック | OFF | ON / OFF |

---

## ライセンス

**AGPL-3.0** (GNU Affero General Public License v3.0)

理由：
- オープンソースの透明性を保証
- フォークしてSaaSとして提供する場合もソース公開が必要
- プライバシーツールとしての信頼性を担保

---

## ロードマップ

### Phase 1: MVP（1-2ヶ月）
- [x] 仕様策定
- [ ] プロジェクト初期化（Tauri + React）
- [ ] 暗号化モジュール実装
- [ ] SQLCipherストレージ実装
- [ ] 認証フロー実装
- [ ] Markdownエディタ実装
- [ ] 基本UI実装

### Phase 2: 同期（2-3ヶ月）
- [ ] E2E暗号化同期プロトコル設計
- [ ] CRDTsでコンフリクト解決
- [ ] P2P直接同期
- [ ] リレーサーバー（オプション）
- [ ] 監査ログ
- [ ] エクスポート/インポート機能

### Phase 3: 匿名性強化（3-6ヶ月）
- [ ] Tor統合
- [ ] メタデータ暗号化
- [ ] Plausible Deniability
- [ ] 削除証明

### Phase 4: 拡張（6ヶ月〜）
- [ ] モバイル対応
- [ ] ハードウェアキー対応
- [ ] 前方秘匿性
- [ ] ポスト量子暗号対応

---

## 備考

### Proton Mailの教訓
- 「ログを取らない」はポリシーであり技術的保証ではなかった
- 法的強制によりIPログを取得・提供させられた
- **対策**: サーバーレス or ゼロ知識設計で「取れない」構造にする

### 将来の検討事項
- パニックパスワード（入力で全データ消去）
- ダミートラフィック（アクセスパターン隠蔽）
- ORAM（Oblivious RAM）

---

*Last Updated: 2026-02-01*
