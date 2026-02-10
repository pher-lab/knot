# Knot - セッション引き継ぎ

## 現在の状態

**プロジェクト初期化**: 完了
**Rustバックエンド**: 基本実装完了（コンパイル成功）
**フロントエンド**: 基本UI完成
**テスト**: 94テスト全てパス（Rust 63 + Frontend 31）
**セキュリティレビュー対応**: 推奨10項目+付随修正 完了
**Welcomeノート**: 実装完了
**公開準備**: 完了
**README**: 作成完了（クローズドアルファ向け英語版）

## セッション履歴

### 2026-02-10: クローズドアルファ公開
- [x] LICENSEファイル追加（AGPL-3.0全文）
- [x] `.gitignore` 作成（node_modules, dist, .claude等）
- [x] ゴミファイル削除（NUL, projectsknot-projectLICENSE）
- [x] Git初期化・初コミット（90ファイル, 16,404行）
- [x] GitHub CLI (`gh`) インストール・認証
- [x] GitHubリポジトリ作成: https://github.com/pher-lab/knot (private)
- [x] GitHub Release `v0.1.0-alpha` 作成（MSI + NSISインストーラー添付）

**環境メモ:**
- Git user: `pher-lab` / `onion.paradise@proton.me`（リポジトリローカル設定）
- ビルドは管理者PowerShellが必要（SQLCipher関連）
- `gh.exe` パス: `C:\Program Files\GitHub CLI\gh.exe`

## 完了したタスク

- [x] プロジェクト構造の作成（Tauri + React + TypeScript）
- [x] 依存関係のインストール
- [x] 暗号化モジュール実装
  - Argon2id鍵導出
  - XChaCha20-Poly1305暗号化/復号
  - BIP39リカバリーキー生成（12単語）
- [x] ストレージモジュール実装
  - SQLCipher初期化
  - ノートCRUD操作
- [x] Tauriコマンド実装
  - 認証: check_vault_exists, setup_vault, unlock_vault, lock_vault, recover_vault
  - ノート: create_note, get_note, update_note, delete_note, list_notes, search_notes
  - 設定: load_settings, save_settings
- [x] フロントエンドUI実装
  - `src/components/Auth/` - SetupScreen, UnlockScreen, RecoveryScreen, RecoveryKeyModal
  - `src/components/Editor/` - CodeMirrorエディタ（自動保存、削除機能付き）
  - `src/components/Sidebar/` - ノート一覧、検索、設定
- [x] 状態管理
  - `src/stores/authStore.ts` - ロック状態管理
  - `src/stores/notesStore.ts` - ノート一覧・選択状態
  - `src/stores/themeStore.ts` - テーマ状態管理
  - `src/stores/languageStore.ts` - 言語状態管理
  - `src/stores/settingsHelper.ts` - 設定永続化ヘルパー
- [x] Tauri APIバインディング
  - `src/lib/api.ts` - Rustコマンドのラッパー
- [x] 自動ロック機能
- [x] Wikiリンク機能（`[[ノート名]]`）
- [x] キーボードショートカット（Ctrl+N, Ctrl+F, Ctrl+L）
- [x] エディタツールバー（太字、斜体、見出し、箇条書き、番号リスト、リンク）
- [x] テーマ切り替え（ダーク/ライト/システム）
- [x] リカバリーキーPDF出力（jsPDF）
- [x] i18n（日本語/英語切り替え）
- [x] 設定の永続化（localStorage → Rust ファイルバックエンド `settings.json`）
- [x] テストスイート（Rust 63 + Frontend 31）
- [x] セキュリティレビュー対応（推奨10項目完了）
- [x] Welcomeノート（初回セットアップ時に自動作成、日英対応）
- [x] システムテーマ検出バグ修正（Tauri ネイティブ API に移行）
- [x] README.md作成（クローズドアルファ向け英語版）
  - セキュリティ警告（監査未実施の明示）
  - セキュリティレビュー募集（responsible disclosure先を記載）
  - ロードマップ（Phase 1-4）
  - AI支援開発の透明性記載
  - フィードバック先・連絡先（GitHub Issues + メール）
  - スクリーンショット3枚（`docs/screenshots/`）

## 総合セキュリティレビュー結果（2026-02-09実施）

全ファイルを対象にセキュリティ・操作性・コード品質の3方面から徹底レビューを実施。
暗号化の基本設計（XChaCha20-Poly1305 + Argon2id + SQLCipher）は堅実。OsRng使用、パラメータ化クエリ、XSSリスクなし等、良好な実装も多い。
以下は発見された問題の一覧と対応状況。

### CRITICAL（重大）— 2件 → 対応不要（受容）

| ID | 問題 | 対応 |
|----|------|------|
| C-1 | パスワード・ニーモニック未ゼロ化 | **受容** — Tauri IPC制約・JSメモリモデルの限界。DESIGN_DECISIONSに記載 |
| C-2 | リカバリーキーが平文Stringで返却 | **受容** — 同上 |

### HIGH（高）— 7件 → 2件修正、5件受容/保留

| ID | 問題 | 対応 |
|----|------|------|
| H-1 | リカバリーフローにレート制限なし | **✅ 修正済み** — `recover_vault`にロックアウトチェック・失敗記録・成功時リセットを追加 |
| H-2 | `setup_vault`が既存ボールト上書き防止なし | **✅ 修正済み** — `salt.bin`/`dek.enc`/`knot.db`の存在チェックをバックエンドに追加 |
| H-3 | ロックアウト状態がインメモリのみ | **保留** — ファイルベース永続化は将来課題。攻撃には物理アクセス+再起動が必要 |
| H-4 | HKDFにソルトなし | **保留** — BIP39エントロピーは128bit、ソルト追加は互換性破壊を伴うため慎重に |
| H-5 | クリップボードに無期限コピー | **保留** — クリアタイマー追加は将来課題 |
| H-6 | リカバリーキーPDFが暗号化なし | **受容** — ユーザー責任範囲。ファイル名変更等は将来検討 |
| H-7 | パスワードがReact stateに残留 | **受容** — JSメモリモデルの限界。DESIGN_DECISIONSに記載 |

### MEDIUM（中）— 15件 → 8件修正、7件保留

| ID | 問題 | 対応 |
|----|------|------|
| M-1 | 復号ノート内容が`Zeroizing`未使用 | **受容** — JSメモリモデルの限界。DESIGN_DECISIONSに記載 |
| M-2 | `Note`構造体のZeroize未実装 | **受容** — 同上 |
| M-3 | ロックアウト期限切れ後にfailed_attempts未リセット | **✅ 修正済み** — `check_lockout`を`&mut self`に変更、期限切れ時に自動リセット |
| M-4 | `search_notes`が全ノートメモリ展開 | **保留** — パフォーマンス最適化は将来課題 |
| M-5 | `list_notes`が全ノート復号 | **保留** — 同上 |
| M-6 | Mutex保持期間が長い | **保留** — 将来課題 |
| M-7 | パスワード強度に辞書チェックなし | **保留** — 将来課題 |
| M-8 | 未知エラーがそのまま表示 | **保留** — 低リスク |
| M-9 | コピー後のフィードバックなし | **保留** — UX改善として将来対応 |
| M-10 | ノート操作エラーが未表示 | **✅ 修正済み** — MainScreenにエラーバナー追加（×ボタンで閉じる） |
| M-11 | saveTimeoutRefがノート切替時未クリア | **✅ 修正済み** — エディタクリーンアップでclearTimeout追加 |
| M-12 | Ctrl+N/Ctrl+Fがエディタ中に動作しない | **✅ 修正済み** — isContentEditableチェックを除外、INPUT/TEXTAREAのみブロック |
| M-13 | 新規ノートタイトルが"Untitled"ハードコード | **✅ 修正済み** — 空文字に変更（NoteListで既にi18nフォールバック済み） |
| M-14 | リカバリーPDFのi18n未対応 | **✅ 修正済み** — タイトル・日付ラベル・警告文全てを翻訳キー化 |
| M-15 | SetupScreenのエラー翻訳漏れ | **✅ 修正済み** — `translateBackendError()`を適用 |

### LOW（低）— 11件 → 2件修正、9件保留

| ID | 問題 | 対応 |
|----|------|------|
| L-1 | パスワード長がバイト長チェック | **保留** — ASCII圏ではほぼ同等。マルチバイト対応は将来 |
| L-2 | タイトル・本文にサイズ制限なし | **保留** |
| L-3 | Settingsのバリデーションなし | **保留** |
| L-4 | Settingsがロック中でも実行可能 | **仕様** — テーマ・言語はロック画面でも変更可能にする設計 |
| L-5 | `Vault`モデルが未使用 | **保留** — 将来の同期機能で使用予定 |
| L-6 | `NoteMetadata`が未使用 | **保留** — 同上 |
| L-7 | CSPにbase-uri/form-action未指定 | **✅ 修正済み** — `base-uri 'self'; form-action 'none'`追加 |
| L-8 | profile.release未設定 | **✅ 修正済み** — `overflow-checks = true`追加 |
| L-9 | chronoのデフォルトフィーチャー | **保留** — 影響軽微 |
| L-10 | window.confirm()でノート削除 | **保留** — カスタムダイアログは将来 |
| L-11 | エラー翻訳が文字列完全一致依存 | **保留** — 現状で十分機能 |

### 良好な実装（ポジティブ所見）

- 暗号化: XChaCha20-Poly1305 + Argon2id + HKDF-SHA256の選択は堅実。ノンス192bit
- OsRng: 全乱数生成が暗号学的に安全な`OsRng`を明示使用
- SQLインジェクション: 全クエリがパラメータ化。注入不可能
- SQLCipher鍵処理: hex_keyが`Zeroizing`でラップ、中間Stringなしで構築
- XSSリスクなし: `dangerouslySetInnerHTML`不使用
- 機密データのログ出力なし: `console.log`等が一切なし
- Tauri API最小権限: `"all": false`で`shell.open`のみ許可
- TypeScript strict mode: `any`型や安全でないキャストなし
- 依存関係: 全暗号ライブラリがRustCryptoプロジェクト。バージョンも最新
- `expect()`は全て証明可能に安全な操作のみ（HKDF 32byteは常に有効、Stringへのwrite等）

## 次にやるべきこと

### Phase 1 MVP — 公開準備完了

基本機能・セキュリティ対応・Welcomeノート・バグ修正すべて完了。
残りの保留項目はリスク受容済み or 将来課題として整理済み。

**リリース手順:**
- [x] README.md作成
- [x] GitHubリポジトリ作成（private）・プッシュ
- [x] 実機での統合テスト（ドッグフーディング + 94テスト全パス）
- [x] ビルド確認（`npm run tauri:build` — MSI + NSIS生成確認）
- [x] GitHub Releaseでインストーラー配布（クローズドアルファ）

**Phase 1 MVP — クローズドアルファ公開完了 (2026-02-10)**

### 将来の拡張オプション

1. **リアルタイムプレビュー**（オプション）- Markdown→HTMLのライブプレビュー

### 将来課題

- ノートリスト復号のパフォーマンス最適化（M-4/M-5関連: タイトル別暗号化等）
- エディタフォントサイズ設定
- スペルチェック設定
- Markdownリンク`[]()`のシンタックスハイライト調整（`[]`が灰色になる問題）
- パスワード強度メーターの改善（M-7: 辞書チェック等）
- ロックアウト状態の永続化（H-3: ファイルベース保存）
- クリップボードクリアタイマー（H-5）
- リカバリーキーコピー後の視覚フィードバック（M-9）
- カスタム削除確認ダイアログ（L-10）

## 重要なファイル

| ファイル | 説明 |
|---------|------|
| `docs/SPECIFICATION.md` | 仕様書（初期設計時点） |
| `docs/DESIGN_DECISIONS.md` | 設計判断と変更点 |
| `src-tauri/src/crypto/` | 暗号化モジュール |
| `src-tauri/src/commands/` | Tauriコマンド |
| `src/App.tsx` | フロントエンドエントリーポイント |
| `src/stores/` | Zustand状態管理 |
| `src/stores/settingsHelper.ts` | 設定永続化ヘルパー（全ストアからRustへ保存） |
| `src/stores/languageStore.ts` | 言語状態管理（ja/en） |
| `src-tauri/src/commands/settings.rs` | 設定ファイル読み書きコマンド |
| `src/i18n/` | 翻訳システム（translations, hook, backendErrors） |
| `src/lib/welcomeNote.ts` | Welcomeノートコンテンツ（日英） |
| `src/components/` | UIコンポーネント |
| `README.md` | クローズドアルファ向けREADME（英語） |
| `docs/screenshots/` | スクリーンショット（setup, main_editor, sidebar_search） |

## 開発コマンド

```bash
# 開発サーバー起動
npm run tauri:dev

# ビルド
npm run tauri:build

# Rustのみチェック
cargo check --manifest-path src-tauri/Cargo.toml

# Rustテスト（63テスト）
cargo test --manifest-path src-tauri/Cargo.toml

# フロントエンドテスト（31テスト）
npm run test:run

# TypeScript型チェック
npx tsc --noEmit
```

## 注意点

- Windows環境で開発中
- **Tailwind CSS v4**: `@tailwindcss/vite`プラグインが必須（vite.config.tsに設定済み）
- **SQLCipher統合済み**: `bundled-sqlcipher-vendored-openssl` 使用
  - ビルドにはStrawberry Perlが必要（MSYS2のPerlでは不可）
  - データベースファイル全体が暗号化される
- ノートデータはアプリレベルでも暗号化（二重暗号化）

## 技術スタック

- **Frontend**: React 19 + TypeScript + Vite 7 + Tailwind CSS 4 + Zustand + CodeMirror 6 + jsPDF + カスタムi18n
- **Backend**: Rust + Tauri 1.8 + SQLCipher + chacha20poly1305 + argon2 + bip39

## テストカバレッジ

| カテゴリ | テスト数 | 内容 |
|---------|---------|------|
| cipher.rs | 10 | 暗号化/復号、大きなデータ、改ざん検出 |
| keys.rs | 7 | 鍵導出、パスワードバリエーション |
| recovery.rs | 3 | リカバリーキー生成・復元 |
| database.rs | 6 | SQLCipher暗号化、CRUD |
| settings.rs | 4 | 設定のシリアライズ・保存・読み込み |
| 統合テスト | 7 | フルフロー（パスワード→暗号化→復号）|
| authStore | 18 | 認証フロー、画面遷移 |
| notesStore | 13 | ノートCRUD、Wikiリンクナビ |

## 過去のセッションで解決した問題

1. **list_notes/search_notesの復号エラーハンドリング**: 破損ノートをスキップして正常なノートのみ返すように修正
2. **テーマ切り替え（ダーク/ライト/システム）**: `themeStore.ts`でテーマ状態管理、全コンポーネントに`dark:`バリアント追加、CodeMirrorテーマ動的切り替え対応
3. **リカバリーキーPDF出力**: jsPDFでRecoveryKeyModalに「PDF保存」ボタン追加、12単語を見やすくフォーマットしたPDFをダウンロード
4. **リカバリーキー単語数の不整合修正**: RecoveryScreenのバリデーションを24単語→12単語に修正
5. **ロック時の未保存データ消失問題**: notesStoreに`pendingSave`/`flushPendingSave`を追加、lock前に保留中の保存を完了
6. **パスワード試行制限**: 5回失敗で30秒ロックアウト（`AppState`に状態追加、`unlock_vault`で制限）
   - `AuthResult`に`lockout_seconds`フィールド追加
   - フロントエンドでカウントダウン自動更新（`UnlockScreen.tsx`）
   - ロックアウト中はボタン無効化、0になると自動で有効化
7. **バックエンドでのパスワード長検証**: `setup_vault`と`recover_vault`で8文字未満を拒否
8. **delete_noteの戻り値確認**: 存在しないノートの削除時にエラーを返すように修正
9. **Tailwind v4が効かない問題**: `@tailwindcss/vite`プラグインが必要だった
10. **タイトルがUntitledに戻る問題**: titleRefを使ってupdateListener内で最新値を参照
11. **SQLCipher統合**: Strawberry Perlをインストールして`bundled-sqlcipher-vendored-openssl`でビルド成功
12. **セキュリティレビュー修正**: SQLCipherキー検証、DEKゼロクリア、HKDF導入等
13. **自動ロック機能**: アイドル検出、設定UI、localStorage永続化
14. **ゼロ化対応**: entropy、hex_key等の機密データをZeroizingでラップ
15. **Wikiリンク機能**: CodeMirror拡張でパース・ハイライト・ナビゲーション
16. **ノート切り替えバグ修正**: 保存中に別ノートに移動すると戻される問題を修正
17. **Wikiリンククリック範囲修正**: wikiリンクのみのノートで空白エリアをクリックしても遷移しないように修正（`.cm-wikilink`要素チェック追加）
18. **Markdownリスト継続バグ修正**: `@codemirror/lang-markdown`の`insertNewlineContinueMarkup`が別々のリストの番号を誤って変更する問題を、カスタムEnterハンドラで解決
    - ライブラリの`renumberList`機能をバイパス
    - 順序付き/順序なし/タスクリスト/ブロッククォートに対応
    - IME composition中はリスト継続をスキップ
19. **キーボードショートカット**: `useKeyboardShortcuts`フックを追加
    - `Ctrl+N`: 新規ノート作成
    - `Ctrl+F`: 検索にフォーカス
    - `Ctrl+L`: ロック（入力中でも動作）
20. **ノートリストのスクロール位置リセット修正**: ノート選択時に`isLoading`が変更されNoteListがアンマウントされていた問題を修正
    - `notesStore`に`isLoadingNote`状態を追加
    - `selectNote`で`isLoading`の代わりに`isLoadingNote`を使用
21. **Markdownシンタックスハイライト**: CodeMirrorに`syntaxHighlighting`と`HighlightStyle`を追加
    - 見出し、太字、斜体、コード、リンク、引用などがリアルタイムでスタイル変化
    - ライト/ダークテーマ両対応
22. **パスワード強度メーター**: SetupScreen・RecoveryScreenにパスワード強度表示を追加
    - 4段階プログレスバー（弱い/普通/強い/とても強い）
    - 長さ＋文字種（小文字/大文字/数字/特殊文字）で評価
    - 共通ロジックを`src/lib/passwordStrength.ts`に切り出し
23. **エディタツールバー**: タイトルとエディタの間にツールバーを追加
    - `src/components/Editor/Toolbar.tsx` を新規作成
    - 太字(`**`)、斜体(`*`)、見出し(H1→H2→H3サイクル)、箇条書き(`-`)、番号リスト(`1.`)
    - ノートリンク(`[[]]`)、外部リンク(`[]()`)の両方に対応
    - 選択範囲にMarkdown記法を適用、または空の場合はプレースホルダーを挿入
    - リストマーカーのトグル機能（既存のマーカーがあれば削除/置換）
24. **OsRng明示使用**: `rand::thread_rng()`を`rand::rngs::OsRng`に置換
    - `crypto/keys.rs`: salt生成、DEK生成
    - `crypto/recovery.rs`: リカバリーキーエントロピー生成
    - `crypto/cipher.rs`: nonce生成
    - 暗号学的に安全なRNGを明示的に使用していることが明確に
25. **i18n（日本語/英語切り替え）**: 外部ライブラリ不使用のカスタム実装
    - `src/stores/languageStore.ts`: Zustand store（Rustファイルバックエンドで永続化）
    - `src/i18n/translations.ts`: `ja`を`as const`で型の源、`en`を`Record<TranslationKey, string>`で全キー網羅強制
    - `src/i18n/useTranslation.ts`: `useTranslation()` hook + `getTranslation()` 非hook版
    - `src/i18n/backendErrors.ts`: Rustバックエンドの英語エラーをパターンマッチで翻訳
    - CodeMirror placeholder は `placeholderCompartment` で動的切替
    - 言語セレクタ: SetupScreen/UnlockScreen（右上）、Settings（サイドバー）
    - 全12ファイル変更、約85翻訳キー
26. **設定の永続化（localStorage → Rust ファイルバックエンド）**: TauriのWebView2でlocalStorageが再起動時にリセットされる問題を解決
    - `src-tauri/src/commands/settings.rs`: `Settings`構造体 + `load_settings`/`save_settings`コマンド
    - `src/stores/settingsHelper.ts`: 全ストアの設定を集めて`api.saveSettings()`を呼ぶヘルパー
    - テーマ・言語・自動ロック設定を`%LOCALAPPDATA%\knot\settings.json`に保存
    - 各ストアに`applyXxx()`アクション追加（起動時ロード用、保存なし）
    - `App.tsx`で`initialize()`と並行して`loadSettings()`を呼び、ローディング画面中に完了
27. **セキュリティレビュー対応（2026-02-09）**: 推奨10項目すべて修正
    - **H-2**: `setup_vault`にボールト存在チェック追加（`salt.bin`/`dek.enc`/`knot.db`いずれか存在でエラー）
    - **M-3**: `check_lockout`を`&mut self`に変更、ロックアウト期限切れ時に`failed_attempts`自動リセット
    - **H-1**: `recover_vault`にロックアウトチェック・失敗回数記録・成功時リセットを追加（`unlock_vault`と同等の保護）
    - **L-7**: CSPに`base-uri 'self'; form-action 'none'`追加
    - **L-8**: `[profile.release]`に`overflow-checks = true`追加
    - **M-11**: エディタのuseEffectクリーンアップで`saveTimeoutRef`をクリア（ノート切替時のデータ消失防止）
    - **M-10**: MainScreenにノート操作エラーバナー追加（×ボタンで閉じる）
    - **M-13**: 新規ノートのタイトルを空文字に変更（NoteListで翻訳キー`noteList.untitled`によるフォールバック済み）
    - **M-14**: リカバリーPDFのタイトル・日付ラベル・警告文を翻訳キー化（`pdfTitle`, `pdfGenerated`追加）
    - **M-15**: SetupScreenのバックエンドエラー表示に`translateBackendError()`を適用
    - **M-12**: エディタ（ContentEditable）内でもCtrl+N/Ctrl+Fが動作するよう修正（INPUT/TEXTAREAのみブロック）
    - **付随**: 新エラーメッセージ翻訳追加（`vaultAlreadyExists`, `invalidRecoveryKeyWithAttempts`）
28. **Welcomeノート**: 初回ボールト作成時に自動でウェルカムノートを作成
    - `src/lib/welcomeNote.ts`: 日英のMarkdownコンテンツを定義
    - `src/stores/authStore.ts`: `setup()`成功後、`useLanguageStore`から現在の言語を取得してWelcomeノートを作成
    - 基本操作、Markdown記法、ノートリンク、設定、セキュリティについて紹介
    - 作成失敗はtry-catchで吸収（セットアップ自体はブロックしない）
29. **システムテーマ検出バグ修正**: 「システム」テーマが常にダークモードになる問題を修正
    - **原因**: WebView2環境で`window.matchMedia("prefers-color-scheme")`がOSのテーマ設定を正しく反映しない
    - **修正**: CSS media query → Tauri ネイティブ API (`appWindow.theme()`) に移行
    - `appWindow.onThemeChanged()`でOSテーマ変更にもリアルタイム追従
    - `App.tsx`の初期化フローに`initSystemTheme()`を追加（ローディング中に完了）
