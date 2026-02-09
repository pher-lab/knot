# Knot - Claude Code 開発ガイド

## これは何？

「Knot」はプライバシーファーストの暗号化ノートアプリです。詳細な仕様は `SPECIFICATION.md` を参照してください。

## 最初にやること

### 1. プロジェクト初期化

```bash
# Tauriプロジェクト作成
npm create tauri-app@latest knot -- --template react-ts

cd knot

# 追加の依存関係
npm install zustand @codemirror/state @codemirror/view @codemirror/lang-markdown
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### 2. Rust依存関係（src-tauri/Cargo.toml）

```toml
[dependencies]
tauri = { version = "1.5", features = ["shell-open"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
sodiumoxide = "0.2"
argon2 = "0.5"
rand = "0.8"
rusqlite = { version = "0.30", features = ["bundled-sqlcipher"] }
bip39 = "2.0"
thiserror = "1.0"
chrono = { version = "0.4", features = ["serde"] }
uuid = { version = "1.6", features = ["v4", "serde"] }
zeroize = "1.7"
```

## 実装順序

### Step 1: 暗号化モジュール
`src-tauri/src/crypto/` を実装
- `keys.rs` - Argon2id鍵導出
- `cipher.rs` - XChaCha20-Poly1305暗号化
- `recovery.rs` - BIP39リカバリーキー

### Step 2: ストレージ
`src-tauri/src/storage/` を実装
- `database.rs` - SQLCipher初期化
- `notes.rs` - ノートCRUD

### Step 3: Tauriコマンド
`src-tauri/src/commands/` を実装
- `auth.rs` - setup, unlock, lock, recover
- `notes.rs` - create, read, update, delete, search

### Step 4: フロントエンド
- 認証画面（Setup, Unlock, Recovery）
- メイン画面（Sidebar, Editor）
- 状態管理（Zustand）

## 重要な設計判断

1. **すべてのデータは暗号化** - 平文でディスクに書かない
2. **パスワードはメモリ上で最小限の時間だけ保持** - 使用後はzeroize
3. **DEKはロック中は存在しない** - アンロック時のみメモリに
4. **エラーメッセージは情報漏洩しない** - 「パスワードが違います」程度に

## テスト用コマンド

```bash
# 開発サーバー起動
npm run tauri dev

# ビルド
npm run tauri build

# Rustテスト
cd src-tauri && cargo test
```

## 困ったら

- 仕様の詳細: `SPECIFICATION.md`
- 暗号化の具体的な実装: 仕様書の「暗号化フォーマット」セクション
- 鍵管理フロー: 仕様書の「鍵管理フロー」セクション
