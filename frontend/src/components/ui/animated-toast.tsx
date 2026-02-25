type ToastType = "success" | "error";

interface AnimatedToastProps {
  visible: boolean;
  message: string;
  type?: ToastType;
}

export function AnimatedToast({
  visible,
  message,
  type = "success",
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
        {message}
      </div>
    </div>
  );
}
