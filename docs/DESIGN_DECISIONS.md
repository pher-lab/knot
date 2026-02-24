# Knot - 設計判断と変更点

## 仕様からの変更点

### SQLCipher統合 ✓

**状態**: 統合完了

**要件**:
- Strawberry Perl（Windows）- OpenSSLソースビルドに必要
- `bundled-sqlcipher-vendored-openssl` フィーチャー使用

**実装**:
- DEK（Data Encryption Key）をSQLCipherの暗号化キーとして使用
- データベースファイル全体が暗号化される
- メタデータ（タイムスタンプ等）も保護される

**二重暗号化**:
- SQLCipher: データベースファイル全体を暗号化
- XChaCha20-Poly1305: ノート内容を個別に暗号化（アプリレベル）
- 多層防御によりセキュリティを強化

### リカバリーキー導出: HKDF-SHA256

**変更**: SHA256単純ハッシュ → HKDF-SHA256

**理由**:
- HKDFはKDF（鍵導出関数）として設計された専用アルゴリズム
- Extract-then-Expandパラダイムで暗号学的に堅牢
- ドメイン分離（info パラメータ）を適切にサポート

**実装**:
- `hkdf` crateを使用
- info: `knot-recovery-kek-v1`

### OsRng明示使用

**変更**: `rand::thread_rng()` → `rand::rngs::OsRng`

**理由**:
- `thread_rng()`も内部でOSエントロピーを使用するが、明示的に`OsRng`を使う方が意図が明確
- セキュリティ監査時に「暗号学的に安全なRNGを使用している」と説明しやすい
- コードレビュー時に乱数生成の安全性が一目で確認できる

**使用箇所**:
- `crypto/keys.rs`: salt生成、DEK生成
- `crypto/recovery.rs`: リカバリーキーエントロピー生成
- `crypto/cipher.rs`: nonce生成

### sodiumoxide → chacha20poly1305 crate

**理由**:
- sodiumoxideは更新が滞っている
- chacha20poly1305はRustCryptoプロジェクトの一部で、純粋なRust実装
- libsodiumのネイティブ依存を回避

**実装**:
- `chacha20poly1305` crateでXChaCha20-Poly1305を実装
- 同等のセキュリティレベルを維持

## 鍵管理アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│                    ユーザー入力                          │
│  ┌─────────────┐              ┌─────────────────────┐   │
│  │ パスワード   │              │ リカバリーフレーズ    │   │
│  └──────┬──────┘              └──────────┬──────────┘   │
│         │                                │              │
│         ▼                                ▼              │
│  ┌─────────────┐              ┌─────────────────────┐   │
│  │ Argon2id    │              │ HKDF-SHA256         │   │
│  │ (64MB/3/4)  │              │ (ドメイン分離)       │   │
│  └──────┬──────┘              └──────────┬──────────┘   │
│         │                                │              │
│         ▼                                ▼              │
│  ┌─────────────┐              ┌─────────────────────┐   │
│  │ Master Key  │              │ Recovery KEK        │   │
│  └──────┬──────┘              └──────────┬──────────┘   │
│         │                                │              │
│         └────────────┬───────────────────┘              │
│                      ▼                                  │
│              ┌─────────────┐                            │
│              │     DEK     │ ← ランダム生成             │
│              │ (データ暗号化)│                           │
│              └──────┬──────┘                            │
│                     │                                   │
│                     ▼                                   │
│              ┌─────────────┐                            │
│              │   ノート     │                            │
│              │ 暗号化/復号  │                            │
│              └─────────────┘                            │
└─────────────────────────────────────────────────────────┘
```

## ファイル構成

```
%LOCALAPPDATA%/knot/
├── salt.bin           # Argon2id用ソルト (32 bytes)
├── dek.enc            # Master Keyで暗号化されたDEK
├── recovery_dek.enc   # Recovery KEKで暗号化されたDEK (オプション)
├── knot.db            # SQLiteデータベース
├── settings.json      # アプリ設定（テーマ、言語、自動ロック、フォントサイズ）
└── lockout.json       # ロックアウト状態（失敗回数、最終失敗時刻）— 成功時に削除
```

## 暗号化フォーマット

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

## ゼロ化（Zeroize）の限界

### 対応済み
- `recovery.rs`: entropy生成・取得時に`Zeroizing`でラップ
- `database.rs`: SQLCipher hex_keyを中間String無しで直接構築
- `keys.rs`: DEKバイトを`Zeroizing<Vec<u8>>`でラップ
- `cipher.rs`: テスト用キーの参照を正しく取得

### 完全対応が困難なもの

| 箇所 | 理由 |
|-----|------|
| `generate_recovery_key()` 戻り値 | フロントエンドにmnemonic文字列を渡す必要があり、Tauri IPCを経由するため`Zeroizing`の効果が及ばない |
| `keys.rs` の `PasswordHash` | argon2クレートの設計上、内部バッファのゼロ化を制御できない |
| 復号後のノート内容 | フロントエンドで表示するため、JavaScriptのメモリ管理に依存 |
| ユーザー入力パスワード | ブラウザ/WebViewのinput要素に依存 |

**判断**: これらはRust側で完全に対策することが困難であり、攻撃にはメモリダンプ等の高度なアクセスが必要。現実的なリスクは低いと判断し、対応しない。

## 設定の永続化: localStorage → Rust ファイルバックエンド

**変更**: `localStorage` → `%LOCALAPPDATA%\knot\settings.json`

**理由**:
- TauriのWebView2 (Windows) では`localStorage`がアプリ終了時にディスクへ確実にフラッシュされない
- テーマ・言語・自動ロック設定が再起動のたびにリセットされる問題が発生していた
- Rustファイル I/O は確実にディスクに書き込まれる

**設計**:
- `Settings`構造体は全フィールド`Option`で、未設定時はデフォルト値を使用
- `AppState`（ロック状態）に依存しないため、ロック画面でも設定の読み書きが可能
- 設定変更時は全設定をまとめて保存（部分更新ではなく全体上書き）
- 各ストアに`setXxx()`（UI更新+保存）と`applyXxx()`（起動時ロード用、保存なし）を分離
- `App.tsx`で`initialize()`と`loadSettings()`を`Promise.all`で並行実行し、ローディング画面中に完了

## カスタムMarkdownキーマップ

### 背景

`@codemirror/lang-markdown`の`insertNewlineContinueMarkup`には、空行で区切られた複数のリストの番号を誤って変更するバグがある。

**問題の例**:
```markdown
1. a

1. a
```
この状態で最初の項目でEnterを押すと、2番目のリストの番号が誤って`2.`に変更される。

### 解決策

ライブラリの`insertNewlineContinueMarkup`を使用せず、カスタムEnterハンドラを実装（`src/components/Editor/Editor.tsx`）。

**実装詳細**:
- `markdown({ addKeymap: false })`でデフォルトkeymapを無効化
- カスタム`customListEnter`関数で以下を処理:
  - 順序付きリスト（`1.` `2)`）: 次の番号で継続
  - 順序なしリスト（`-` `*` `+`）: 同じマーカーで継続
  - タスクリスト（`- [ ]`）: 未チェックで継続
  - ブロッククォート（`>`）: 同じプレフィックスで継続
  - 空の項目でEnter: マーカーを削除
- IME composition中（`view.composing`）はリスト継続をスキップ
- 他のリストの番号は一切変更しない

**利点**:
- ライブラリの`renumberList`バグを回避
- IME入力との干渉を防止
- 各リストが独立して番号付けされる

## i18n（国際化）

### カスタム実装を選択した理由

**判断**: `react-i18next`等の外部ライブラリを使用せず、Zustand store + カスタムhookで実装。

**理由**:
- 約85個の翻訳キー、2言語（ja/en）のみ → 外部ライブラリは過剰
- 既存の`themeStore`パターンに統一
- TypeScriptの型安全性を活かし、翻訳キーの欠落をコンパイルエラーで検出

**型安全性の仕組み**:
```typescript
const ja = { "setup.title": "ボールトを作成", ... } as const;
type TranslationKey = keyof typeof ja;
const en: Record<TranslationKey, string> = { ... }; // 全キー網羅が強制される
```

**スケーラビリティ**:
- 3〜4言語、200キー程度までは快適に運用可能
- それ以上の規模では`react-i18next`への移行を検討（キー命名規則はそのまま流用可能）

### バックエンドエラーの翻訳戦略

Rustバックエンドのエラーメッセージは英語で統一し、フロントエンドの`backendErrors.ts`でパターンマッチして現在の言語に翻訳する。未知のエラーはフォールバックとしてそのまま表示。

### CodeMirror placeholderの動的切替

`themeCompartment`/`highlightCompartment`と同じパターンで`placeholderCompartment`を追加。言語変更時に`reconfigure()`で更新。

### passwordStrength.tsの反応性

`getTranslation()`（非hook版）を使用。呼び出し元コンポーネントが`useTranslation()`経由で言語変更を検知して再レンダリングされるため、`useMemo`の依存配列に`language`を含めることで反応性を維持。

## システムテーマ検出: CSS matchMedia → Tauri ネイティブ API

**変更**: `window.matchMedia("(prefers-color-scheme: dark)")` → `appWindow.theme()` + `appWindow.onThemeChanged()`

**理由**:
- Tauri の WebView2 環境（Windows）で `prefers-color-scheme` がOSのテーマ設定を正しく反映しない
- 常にダークモードと判定されてしまう問題が発生
- Tauri ネイティブ API はOSの設定を直接取得するため確実

**実装**:
- `appWindow.theme()` で初期値を非同期取得（`initSystemTheme()`）
- `appWindow.onThemeChanged()` でOSテーマ変更をリアルタイム検出
- `App.tsx` の初期化で `loadSettings` / `initialize` と並行して実行
- フォールバック: API失敗時は `"light"` をデフォルトに（旧実装は `"dark"` だった）

## Welcomeノート

**設計**: フロントエンド側で作成（バックエンド変更なし）

**理由**:
- i18nシステムと連携して言語に応じたコンテンツを生成できる
- `useLanguageStore.getState().resolvedLanguage` で現在の言語を取得
- バックエンドのコマンド仕様変更が不要
- 作成失敗時もセットアップをブロックしない

**実装**:
- `src/lib/welcomeNote.ts` に日英のタイトル・Markdownコンテンツを定義
- `authStore.setup()` 成功後、画面遷移前に `api.createNote()` で作成
- 内容: 基本操作、Markdown記法、ノートリンク、設定、セキュリティの紹介

## タグの暗号化レベル

**判断**: タグはSQLCipher（DB暗号化）のみで保護。ノート本文のようなXChaCha20-Poly1305による二重暗号化は適用しない。

**理由**:
- タグは`note_tags`テーブルに平文で格納し、`SELECT DISTINCT`やJOINで効率的にクエリ可能にする
- 二重暗号化すると全ノート復号なしにタグフィルタリングができなくなる（パフォーマンス問題）
- SQLCipherによりDBファイル自体は暗号化されるため、ディスク上では保護されている
- タグは`pinned`や`created_at`と同じメタデータ層の扱い

**トレードオフ**:
- SQLCipherキーが漏洩した場合、タグ名は露出するがノート本文は依然としてXChaCha20で保護される
- 「どのノートにどのタグがついているか」はメタデータとして扱う設計判断

**タグの正規化**:
- 小文字化 + 前後空白トリム
- 空文字は無視、重複は`INSERT OR IGNORE`で吸収
- `set_note_tags`はトランザクションで原子的に全置換（DELETE→INSERT）

## ロックアウト状態の永続化

**変更**: インメモリのみ → `lockout.json`ファイルベース

**理由**:
- アプリ再起動でロックアウトがリセットされ、ブルートフォース攻撃者が5回試行→再起動→5回試行を繰り返せる問題
- `Instant`はシリアライズ不可のため、ファイルには`SystemTime`のUNIXエポック秒を使用

**実装**:
- `record_failed_attempt()` で `%LOCALAPPDATA%/knot/lockout.json` に書き込み
- `reset_failed_attempts()` でファイルを削除
- `ensure_lockout_loaded()` で起動時にlazy読み込み（エポック差分から`Instant`を復元）
- `check_lockout_status` Tauriコマンドで、`UnlockScreen`マウント時にロックアウト状態を即座に表示

**ファイルフォーマット**:
```json
{ "failed_attempts": 5, "last_failed_at_epoch": 1740412800 }
```

## クリップボードクリアタイマー

**設計**: コピー後30秒でクリップボードを自動クリア

**理由**:
- リカバリーキーは極めて機密性が高く、クリップボードに無期限で残るのはリスク
- 30秒はKeePass等のパスワードマネージャーで一般的なタイムアウト値

**実装**:
- `navigator.clipboard.writeText("")` で空文字に上書き（ブラウザ互換性が高い）
- カウントダウン表示でユーザーに残り時間を通知
- コンポーネントunmount時にタイマーをクリーンアップ（メモリリーク防止）

## エディタフォントサイズ設定

**設計**: CodeMirror `Compartment` による動的切り替え

**理由**:
- エディタを再生成せずにフォントサイズを変更したい（入力中の状態を保持）
- 既存の `themeCompartment` / `highlightCompartment` と同じパターンで統一的に管理

**実装**:
- `fontSizeCompartment.reconfigure()` でライブ切り替え
- `fontSizeStore.ts`（Zustand）で状態管理、`settingsHelper.ts` 経由で `settings.json` に永続化
- 他のストア（theme, language, autoLock）と同じ `setXxx()` / `applyXxx()` パターン

## 実装済み機能

1. ~~**自動ロック機能**~~: 実装完了
2. ~~**Wikiリンク機能**~~: 実装完了（`src/components/Editor/wikilink.ts`）
   - `[[ノート名]]` をパースしてハイライト表示
   - クリックでリンク先ノートに遷移（`.cm-wikilink`要素上のみ反応）
   - 存在しないノートは自動で新規作成
3. ~~**i18n（日本語/英語切り替え）**~~: 実装完了（`src/i18n/`, `src/stores/languageStore.ts`）
   - カスタム実装（外部ライブラリ不使用）
   - 型安全な翻訳キー（欠落はコンパイルエラー）
   - SetupScreen/UnlockScreen/Settingsから言語切替可能
   - Rustファイルバックエンドで永続化
4. ~~**設定の永続化**~~: 実装完了（`src-tauri/src/commands/settings.rs`, `src/stores/settingsHelper.ts`）
   - localStorage → Rust ファイルバックエンド（`settings.json`）に移行
   - AppState不要（ロック前でも読み書き可能）
