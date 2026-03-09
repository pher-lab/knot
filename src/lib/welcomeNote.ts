import type { ResolvedLanguage } from "../stores/languageStore";

interface WelcomeNote {
  title: string;
  content: string;
}

const ja: WelcomeNote = {
  title: "Knot へようこそ",
  content: `Knot はプライバシーファーストの暗号化ノートアプリです。すべてのノートはあなたのパスワードで暗号化され、あなただけが読むことができます。

## 基本操作

- **新規ノート**: サイドバーの「新規ノート」ボタン、または \`Ctrl+N\`
- **検索**: サイドバーの検索バー、または \`Ctrl+F\`（スペース区切りでAND検索）
- **ロック**: サイドバーの鍵アイコン、または \`Ctrl+L\`
- **ピン留め**: エディタのピンアイコン、または右クリックメニューから

## Markdown 対応

ノートは Markdown 記法で書くことができます。ツールバーの目アイコンでプレビュー表示に切り替えられます。

- **太字**: \`**テキスト**\`
- *斜体*: \`*テキスト*\`
- 見出し: \`# 見出し\` \`## 見出し\` \`### 見出し\`
- リスト: \`- 項目\` または \`1. 項目\`
- コード: \`\` \`コード\` \`\`
- コードブロック: シンタックスハイライト対応

ツールバーからも書式を適用できます。

## ノートリンク

\`[[ノート名]]\` と書くと、他のノートへのリンクを作成できます。クリックするとそのノートに移動します。存在しないノート名の場合は自動的に新規作成されます。

## タグ

エディタのタイトル下にあるタグエリアでタグを追加・削除できます。サイドバーのタグフィルターでノートを絞り込むこともできます。タグ名で検索もできます。

## ゴミ箱

削除したノートはゴミ箱に移動します。サイドバーのゴミ箱アイコンで確認・復元・完全削除ができます。ゴミ箱内のノートは30日後に自動削除されます。

## インポート / エクスポート

- **インポート**: 「…」メニューからMarkdownファイル（.md）を取り込み
- **エクスポート**: 個別ノートはエディタのエクスポートボタン、全ノートは「…」メニューから
- **PDF出力**: エクスポート時にPDF形式も選択可能

## 設定

サイドバーの歯車アイコンから設定を変更できます:

- **テーマ**: ライト / ダーク / システム
- **自動ロック**: 一定時間操作がないと自動でロック
- **言語**: 日本語 / English
- **フォントサイズ**: 小 / 中 / 大
- **並び替え**: 更新日 / 作成日 / タイトル
- **パスワード変更**: 現在のパスワードを確認して変更

## セキュリティ

- すべてのノートは XChaCha20-Poly1305 で暗号化
- パスワードは Argon2id で安全に導出
- データベース全体も SQLCipher で暗号化
- 平文データがディスクに残ることはありません

---

このノートは自由に編集・削除できます。「…」メニューの「Welcomeノートを復元」でいつでも初期状態に戻せます。`,
};

const en: WelcomeNote = {
  title: "Welcome to Knot",
  content: `Knot is a privacy-first encrypted note-taking app. All your notes are encrypted with your password — only you can read them.

## Getting Started

- **New note**: Click "New Note" in the sidebar, or press \`Ctrl+N\`
- **Search**: Use the search bar in the sidebar, or press \`Ctrl+F\` (space-separated AND search)
- **Lock**: Click the lock icon in the sidebar, or press \`Ctrl+L\`
- **Pin**: Click the pin icon in the editor, or right-click a note

## Markdown Support

You can write notes using Markdown syntax. Toggle the eye icon in the toolbar to switch to preview mode.

- **Bold**: \`**text**\`
- *Italic*: \`*text*\`
- Headings: \`# Heading\` \`## Heading\` \`### Heading\`
- Lists: \`- item\` or \`1. item\`
- Code: \`\` \`code\` \`\`
- Code blocks: Syntax highlighting supported

You can also apply formatting using the toolbar.

## Note Links

Type \`[[note name]]\` to create a link to another note. Click the link to navigate to that note. If the note doesn't exist, it will be created automatically.

## Tags

Add or remove tags in the tag area below the title. Use the tag filter in the sidebar to narrow down notes. You can also search by tag name.

## Trash

Deleted notes are moved to the trash. Click the trash icon in the sidebar to view, restore, or permanently delete them. Notes in the trash are automatically purged after 30 days.

## Import / Export

- **Import**: Import Markdown files (.md) from the "..." menu
- **Export**: Export individual notes via the editor export button, or all notes from the "..." menu
- **PDF export**: PDF format is also available when exporting

## Settings

Click the gear icon in the sidebar to change:

- **Theme**: Light / Dark / System
- **Auto-lock**: Automatically lock after inactivity
- **Language**: 日本語 / English
- **Font size**: Small / Medium / Large
- **Sort**: Updated / Created / Title
- **Change password**: Verify current password and set a new one

## Security

- All notes are encrypted with XChaCha20-Poly1305
- Passwords are derived securely with Argon2id
- The entire database is also encrypted with SQLCipher
- No plaintext data ever touches disk

---

Feel free to edit or delete this note. You can always restore it from the "..." menu via "Restore welcome note".`,
};

const welcomeNotes: Record<ResolvedLanguage, WelcomeNote> = { ja, en };

export function getWelcomeNote(language: ResolvedLanguage): WelcomeNote {
  return welcomeNotes[language];
}
