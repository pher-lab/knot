const ja = {
  // App
  "app.loading": "読み込み中...",

  // Setup Screen
  "setup.subtitle": "自分だけが解ける結び目",
  "setup.title": "ボールトを作成",
  "setup.description": "マスターパスワードを設定してください。このパスワードでノートを暗号化します。",
  "setup.masterPassword": "マスターパスワード",
  "setup.passwordPlaceholder": "8文字以上",
  "setup.confirmPassword": "パスワード確認",
  "setup.confirmPlaceholder": "もう一度入力",
  "setup.generateRecoveryKey": "リカバリーキーを生成する（推奨）",
  "setup.creating": "作成中...",
  "setup.createVault": "ボールトを作成",
  "setup.validationMinLength": "パスワードは8文字以上必要です",
  "setup.validationMismatch": "パスワードが一致しません",

  // Unlock Screen
  "unlock.subtitle": "自分だけが解ける結び目",
  "unlock.title": "ボールトを解錠",
  "unlock.masterPassword": "マスターパスワード",
  "unlock.passwordPlaceholder": "パスワードを入力",
  "unlock.unlocking": "解錠中...",
  "unlock.unlock": "解錠",
  "unlock.forgotPassword": "パスワードを忘れた場合",
  "unlock.retryAfter": "{seconds}秒後に再試行可能",

  // Recovery Screen
  "recovery.subtitle": "自分だけが解ける結び目",
  "recovery.title": "ボールトを復元",
  "recovery.description": "リカバリーキー（12単語）を入力して、新しいパスワードを設定してください。",
  "recovery.recoveryKey": "リカバリーキー",
  "recovery.recoveryKeyPlaceholder": "12単語をスペース区切りで入力",
  "recovery.newPassword": "新しいパスワード",
  "recovery.newPasswordPlaceholder": "8文字以上",
  "recovery.confirmPassword": "パスワード確認",
  "recovery.confirmPlaceholder": "もう一度入力",
  "recovery.recovering": "復元中...",
  "recovery.recover": "ボールトを復元",
  "recovery.back": "戻る",
  "recovery.validationWords": "リカバリーキーは12単語です",
  "recovery.validationMinLength": "パスワードは8文字以上必要です",
  "recovery.validationMismatch": "パスワードが一致しません",

  // Recovery Key Modal
  "recoveryModal.title": "リカバリーキー",
  "recoveryModal.description": "このリカバリーキーを安全な場所に保管してください。パスワードを忘れた場合に必要になります。",
  "recoveryModal.warning": "このキーは一度しか表示されません。紙に書き写すか、パスワードマネージャーに保存してください。",
  "recoveryModal.copy": "コピー",
  "recoveryModal.savePDF": "PDF保存",
  "recoveryModal.done": "保存しました",
  "recoveryModal.pdfTitle": "Knot リカバリーキー",
  "recoveryModal.pdfGenerated": "生成日: {date}",
  "recoveryModal.pdfWarning": "この文書は安全な場所に保管してください。パスワードを忘れた場合に必要になります。",
  "recoveryModal.pdfSecurityNotice1": "このリカバリーキーにより暗号化されたノートへの完全なアクセスが可能になります。",
  "recoveryModal.pdfSecurityNotice2": "この文書を他者と共有しないでください。",

  // Editor
  "editor.selectNote": "ノートを選択してください",
  "editor.titlePlaceholder": "タイトル",
  "editor.deleteTitle": "削除",
  "editor.confirmDelete": "このノートを削除しますか？",
  "editor.saving": "保存中...",
  "editor.saved": "保存済み",
  "editor.contentPlaceholder": "ノートを書き始める...",
  "editor.export": "エクスポート",

  // Toolbar
  "toolbar.bold": "太字 (Ctrl+B)",
  "toolbar.italic": "斜体 (Ctrl+I)",
  "toolbar.heading": "見出し (H1→H2→H3→なし)",
  "toolbar.bulletList": "箇条書き",
  "toolbar.numberedList": "番号リスト",
  "toolbar.wikiLink": "ノートリンク [[ノート名]]",
  "toolbar.externalLink": "外部リンク [text](url)",

  // Sidebar
  "sidebar.settings": "設定",
  "sidebar.lock": "ロック",
  "sidebar.creating": "作成中...",
  "sidebar.newNote": "新規ノート",
  "sidebar.loading": "読み込み中...",
  "sidebar.noNotes": "ノートがありません",
  "sidebar.theme": "テーマ",
  "sidebar.themeLight": "ライト",
  "sidebar.themeDark": "ダーク",
  "sidebar.themeSystem": "システム",
  "sidebar.autoLock": "自動ロック",
  "sidebar.autoLockDisabled": "無効",
  "sidebar.autoLockMinutes": "{n}分",
  "sidebar.language": "言語",
  "sidebar.languageSystem": "システム",
  "sidebar.import": "インポート",
  "sidebar.exportAll": "全ノートをエクスポート",
  "import.success": "{n}件のノートをインポートしました",
  "import.error": "インポートに失敗しました",
  "export.success": "エクスポートが完了しました",
  "export.successCount": "{n}件のノートをエクスポートしました",
  "export.error": "エクスポートに失敗しました",
  "export.noNotes": "エクスポートするノートがありません",

  // Search
  "search.placeholder": "検索...",

  // Note List
  "noteList.untitled": "Untitled",
  "noteList.justNow": "たった今",
  "noteList.minutesAgo": "{n}分前",
  "noteList.hoursAgo": "{n}時間前",
  "noteList.daysAgo": "{n}日前",

  // Password Strength
  "password.weak": "弱い",
  "password.fair": "普通",
  "password.strong": "強い",
  "password.veryStrong": "とても強い",

  // Backend Errors
  "backendError.invalidPassword": "パスワードが正しくありません",
  "backendError.invalidPasswordWithAttempts": "パスワードが正しくありません。残り{n}回",
  "backendError.tooManyAttempts": "試行回数が上限に達しました",
  "backendError.recoveryNotSetUp": "リカバリーキーが設定されていません",
  "backendError.invalidRecoveryKey": "リカバリーキーが正しくありません",
  "backendError.invalidRecoveryData": "リカバリーデータが無効です",
  "backendError.vaultAlreadyExists": "ボールトは既に存在します",
  "backendError.invalidRecoveryKeyWithAttempts": "リカバリーキーが正しくありません。残り{n}回",
  "backendError.setupFailed": "セットアップに失敗しました",
  "backendError.unlockFailed": "解錠に失敗しました",
  "backendError.recoveryFailed": "復元に失敗しました",
} as const;

export type TranslationKey = keyof typeof ja;

const en: Record<TranslationKey, string> = {
  // App
  "app.loading": "Loading...",

  // Setup Screen
  "setup.subtitle": "A knot only you can untie",
  "setup.title": "Create Vault",
  "setup.description": "Set a master password. This password will be used to encrypt your notes.",
  "setup.masterPassword": "Master Password",
  "setup.passwordPlaceholder": "8 characters or more",
  "setup.confirmPassword": "Confirm Password",
  "setup.confirmPlaceholder": "Enter again",
  "setup.generateRecoveryKey": "Generate recovery key (recommended)",
  "setup.creating": "Creating...",
  "setup.createVault": "Create Vault",
  "setup.validationMinLength": "Password must be at least 8 characters",
  "setup.validationMismatch": "Passwords do not match",

  // Unlock Screen
  "unlock.subtitle": "A knot only you can untie",
  "unlock.title": "Unlock Vault",
  "unlock.masterPassword": "Master Password",
  "unlock.passwordPlaceholder": "Enter password",
  "unlock.unlocking": "Unlocking...",
  "unlock.unlock": "Unlock",
  "unlock.forgotPassword": "Forgot password?",
  "unlock.retryAfter": "Retry available in {seconds} seconds",

  // Recovery Screen
  "recovery.subtitle": "A knot only you can untie",
  "recovery.title": "Recover Vault",
  "recovery.description": "Enter your recovery key (12 words) and set a new password.",
  "recovery.recoveryKey": "Recovery Key",
  "recovery.recoveryKeyPlaceholder": "Enter 12 words separated by spaces",
  "recovery.newPassword": "New Password",
  "recovery.newPasswordPlaceholder": "8 characters or more",
  "recovery.confirmPassword": "Confirm Password",
  "recovery.confirmPlaceholder": "Enter again",
  "recovery.recovering": "Recovering...",
  "recovery.recover": "Recover Vault",
  "recovery.back": "Back",
  "recovery.validationWords": "Recovery key must be 12 words",
  "recovery.validationMinLength": "Password must be at least 8 characters",
  "recovery.validationMismatch": "Passwords do not match",

  // Recovery Key Modal
  "recoveryModal.title": "Recovery Key",
  "recoveryModal.description": "Store this recovery key in a safe place. You will need it if you forget your password.",
  "recoveryModal.warning": "This key is shown only once. Write it down on paper or save it in a password manager.",
  "recoveryModal.copy": "Copy",
  "recoveryModal.savePDF": "Save PDF",
  "recoveryModal.done": "I've saved it",
  "recoveryModal.pdfTitle": "Knot Recovery Key",
  "recoveryModal.pdfGenerated": "Generated: {date}",
  "recoveryModal.pdfWarning": "Keep this document in a secure location. You will need it if you forget your password.",
  "recoveryModal.pdfSecurityNotice1": "This recovery key allows full access to your encrypted notes.",
  "recoveryModal.pdfSecurityNotice2": "Do not share this document with anyone.",

  // Editor
  "editor.selectNote": "Select a note",
  "editor.titlePlaceholder": "Title",
  "editor.deleteTitle": "Delete",
  "editor.confirmDelete": "Delete this note?",
  "editor.saving": "Saving...",
  "editor.saved": "Saved",
  "editor.contentPlaceholder": "Start writing...",
  "editor.export": "Export",

  // Toolbar
  "toolbar.bold": "Bold (Ctrl+B)",
  "toolbar.italic": "Italic (Ctrl+I)",
  "toolbar.heading": "Heading (H1→H2→H3→none)",
  "toolbar.bulletList": "Bullet list",
  "toolbar.numberedList": "Numbered list",
  "toolbar.wikiLink": "Note link [[note name]]",
  "toolbar.externalLink": "External link [text](url)",

  // Sidebar
  "sidebar.settings": "Settings",
  "sidebar.lock": "Lock",
  "sidebar.creating": "Creating...",
  "sidebar.newNote": "New Note",
  "sidebar.loading": "Loading...",
  "sidebar.noNotes": "No notes",
  "sidebar.theme": "Theme",
  "sidebar.themeLight": "Light",
  "sidebar.themeDark": "Dark",
  "sidebar.themeSystem": "System",
  "sidebar.autoLock": "Auto-lock",
  "sidebar.autoLockDisabled": "Disabled",
  "sidebar.autoLockMinutes": "{n} min",
  "sidebar.language": "Language",
  "sidebar.languageSystem": "System",
  "sidebar.import": "Import",
  "sidebar.exportAll": "Export all notes",
  "import.success": "Imported {n} notes",
  "import.error": "Import failed",
  "export.success": "Export completed",
  "export.successCount": "Exported {n} notes",
  "export.error": "Export failed",
  "export.noNotes": "No notes to export",

  // Search
  "search.placeholder": "Search...",

  // Note List
  "noteList.untitled": "Untitled",
  "noteList.justNow": "Just now",
  "noteList.minutesAgo": "{n}m ago",
  "noteList.hoursAgo": "{n}h ago",
  "noteList.daysAgo": "{n}d ago",

  // Password Strength
  "password.weak": "Weak",
  "password.fair": "Fair",
  "password.strong": "Strong",
  "password.veryStrong": "Very strong",

  // Backend Errors
  "backendError.invalidPassword": "Invalid password",
  "backendError.invalidPasswordWithAttempts": "Invalid password. {n} attempts remaining.",
  "backendError.tooManyAttempts": "Too many failed attempts",
  "backendError.recoveryNotSetUp": "Recovery key not set up",
  "backendError.invalidRecoveryKey": "Invalid recovery key",
  "backendError.invalidRecoveryData": "Invalid recovery data",
  "backendError.vaultAlreadyExists": "Vault already exists",
  "backendError.invalidRecoveryKeyWithAttempts": "Invalid recovery key. {n} attempts remaining.",
  "backendError.setupFailed": "Setup failed",
  "backendError.unlockFailed": "Unlock failed",
  "backendError.recoveryFailed": "Recovery failed",
};

export const translations = { ja, en } as const;
