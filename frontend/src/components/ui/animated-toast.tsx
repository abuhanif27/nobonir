import { X } from "lucide-react";

type ToastType = "success" | "error";

interface AnimatedToastProps {
  visible: boolean;
  message: string;
  type?: ToastType;
  onDismiss?: () => void;
}

export function AnimatedToast({
  visible,
  message,
  type = "success",
  onDismiss,
}: AnimatedToastProps) {
  const styles =
    type === "success"
      ? "from-emerald-500 to-teal-600"
      : "from-rose-500 to-red-600";

  return (
    <div
      className={`pointer-events-none fixed right-5 top-5 z-[100] transition-all duration-300 ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"
      }`}
      aria-live="polite"
    >
      <div
        className={`rounded-xl bg-gradient-to-r ${styles} px-4 py-3 text-sm font-semibold text-white shadow-xl backdrop-blur-sm`}
      >
        <div className="flex items-start gap-3">
          <p className="leading-relaxed">{message}</p>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss notification"
              className="pointer-events-auto -mr-1 -mt-1 inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/20 bg-white/10 transition-colors hover:bg-white/20"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
