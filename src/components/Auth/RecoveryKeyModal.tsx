import { useState, useEffect, useRef, useCallback } from "react";
import { jsPDF } from "jspdf";
import { useAuthStore } from "../../stores/authStore";
import { useTranslation } from "../../i18n";

export function RecoveryKeyModal() {
  const { recoveryKey, clearRecoveryKey } = useAuthStore();
  const { t, language } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [clipboardCountdown, setClipboardCountdown] = useState<number | null>(null);
  const clipboardTimerRef = useRef<number | null>(null);
  const copiedTimerRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      if (clipboardTimerRef.current) clearTimeout(clipboardTimerRef.current);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const startCountdown = useCallback(() => {
    // Clear any existing countdown
    if (countdownRef.current) clearInterval(countdownRef.current);

    setClipboardCountdown(30);
    countdownRef.current = window.setInterval(() => {
      setClipboardCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  if (!recoveryKey) return null;

  const words = recoveryKey.split(" ");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(recoveryKey);
      setCopied(true);

      // Reset "Copied!" text after 2 seconds
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = window.setTimeout(() => {
        setCopied(false);
      }, 2000);

      // Clear clipboard after 30 seconds
      if (clipboardTimerRef.current) clearTimeout(clipboardTimerRef.current);
      clipboardTimerRef.current = window.setTimeout(() => {
        navigator.clipboard.writeText("").catch(() => {});
      }, 30000);

      // Start visible countdown
      startCountdown();
    } catch {
      // Clipboard API not available
    }
  };

  const handleSavePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Title
    doc.setFontSize(24);
    doc.text(t("recoveryModal.pdfTitle"), pageWidth / 2, 30, { align: "center" });

    // Warning
    doc.setFontSize(10);
    doc.setTextColor(150, 100, 0);
    doc.text(
      t("recoveryModal.pdfWarning"),
      pageWidth / 2,
      45,
      { align: "center" }
    );

    // Recovery words grid (6 columns x 4 rows)
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);

    const startX = 25;
    const startY = 65;
    const colWidth = 27;
    const rowHeight = 12;
    const cols = 6;

    words.forEach((word, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * colWidth;
      const y = startY + row * rowHeight;

      doc.setTextColor(128, 128, 128);
      doc.text(`${i + 1}.`, x, y);
      doc.setTextColor(0, 0, 0);
      doc.setFont("courier", "normal");
      doc.text(word, x + 8, y);
      doc.setFont("helvetica", "normal");
    });

    // Footer
    doc.setFontSize(9);
    doc.setTextColor(128, 128, 128);
    const dateLocale = language === "ja" ? "ja-JP" : "en-US";
    const date = new Date().toLocaleDateString(dateLocale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    doc.text(t("recoveryModal.pdfGenerated", { date }), pageWidth / 2, 125, { align: "center" });

    // Security notice
    doc.setFontSize(8);
    doc.text(
      t("recoveryModal.pdfSecurityNotice1"),
      pageWidth / 2,
      140,
      { align: "center" }
    );
    doc.text(
      t("recoveryModal.pdfSecurityNotice2"),
      pageWidth / 2,
      147,
      { align: "center" }
    );

    doc.save("knot-recovery-key.pdf");
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t("recoveryModal.title")}</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {t("recoveryModal.description")}
          </p>
        </div>

        <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4">
          <div className="grid grid-cols-4 gap-2 text-sm">
            {words.map((word, i) => (
              <div key={i} className="flex gap-1">
                <span className="text-gray-500 w-5 text-right">{i + 1}.</span>
                <span className="text-gray-900 dark:text-white font-mono">{word}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700/50 rounded-lg p-3">
          <p className="text-yellow-800 dark:text-yellow-200 text-sm">
            {t("recoveryModal.warning")}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleCopy}
            className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
              copied
                ? "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300"
                : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white"
            }`}
          >
            {copied ? (
              <span className="inline-flex items-center justify-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {t("recoveryModal.copied")}
              </span>
            ) : clipboardCountdown !== null ? (
              <span className="text-gray-500 dark:text-gray-400">
                {t("recoveryModal.clipboardClear", { seconds: clipboardCountdown })}
              </span>
            ) : (
              t("recoveryModal.copy")
            )}
          </button>
          <button
            onClick={handleSavePDF}
            className="flex-1 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg text-sm transition-colors"
          >
            {t("recoveryModal.savePDF")}
          </button>
          <button
            onClick={clearRecoveryKey}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
          >
            {t("recoveryModal.done")}
          </button>
        </div>
      </div>
    </div>
  );
}
