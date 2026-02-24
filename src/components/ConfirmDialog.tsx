interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {title}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          {message}
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              variant === "danger"
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
