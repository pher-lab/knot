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
- **検索**: サイドバーの検索バー、または \`Ctrl+F\`
- **ロック**: サイドバーの鍵アイコン、または \`Ctrl+L\`

## Markdown 対応

ノートは Markdown 記法で書くことができます。

- **太字**: \`**テキスト**\`
- *斜体*: \`*テキスト*\`
- 見出し: \`# 見出し\` \`## 見出し\` \`### 見出し\`
- リスト: \`- 項目\` または \`1. 項目\`
- コード: \`\` \`コード\` \`\`

ツールバーからも書式を適用できます。

## ノートリンク

\`[[ノート名]]\` と書くと、他のノートへのリンクを作成できます。クリックするとそのノートに移動します。存在しないノート名の場合は自動的に新規作成されます。

## 設定

サイドバーの歯車アイコンから設定を変更できます:

- **テーマ**: ライト / ダーク / システム
- **自動ロック**: 一定時間操作がないと自動でロック
- **言語**: 日本語 / English

## セキュリティ

- すべてのノートは XChaCha20-Poly1305 で暗号化
- パスワードは Argon2id で安全に導出
- データベース全体も SQLCipher で暗号化
- 平文データがディスクに残ることはありません

---

このノートは自由に編集・削除できます。`,
};

const en: WelcomeNote = {
  title: "Welcome to Knot",
  content: `Knot is a privacy-first encrypted note-taking app. All your notes are encrypted with your password — only you can read them.

## Getting Started

- **New note**: Click "New Note" in the sidebar, or press \`Ctrl+N\`
- **Search**: Use the search bar in the sidebar, or press \`Ctrl+F\`
- **Lock**: Click the lock icon in the sidebar, or press \`Ctrl+L\`

## Markdown Support

You can write notes using Markdown syntax.

- **Bold**: \`**text**\`
- *Italic*: \`*text*\`
- Headings: \`# Heading\` \`## Heading\` \`### Heading\`
- Lists: \`- item\` or \`1. item\`
- Code: \`\` \`code\` \`\`

You can also apply formatting using the toolbar.

## Note Links

Type \`[[note name]]\` to create a link to another note. Click the link to navigate to that note. If the note doesn't exist, it will be created automatically.

## Settings

Click the gear icon in the sidebar to change:

- **Theme**: Light / Dark / System
- **Auto-lock**: Automatically lock after inactivity
- **Language**: 日本語 / English

## Security

- All notes are encrypted with XChaCha20-Poly1305
- Passwords are derived securely with Argon2id
- The entire database is also encrypted with SQLCipher
- No plaintext data ever touches disk

---

Feel free to edit or delete this note.`,
};

const welcomeNotes: Record<ResolvedLanguage, WelcomeNote> = { ja, en };

export function getWelcomeNote(language: ResolvedLanguage): WelcomeNote {
  return welcomeNotes[language];
}
