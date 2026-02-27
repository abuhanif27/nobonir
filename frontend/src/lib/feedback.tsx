import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AnimatedToast } from "@/components/ui/animated-toast";

type FeedbackType = "success" | "error";

type FeedbackState = {
  id: number;
  type: FeedbackType;
  message: string;
  durationMs: number;
};

interface FeedbackContextValue {
  showSuccess: (message: string, durationMs?: number) => void;
  showError: (message: string, durationMs?: number) => void;
  dismiss: () => void;
}

const DEFAULT_SUCCESS_MESSAGE = "Action completed successfully.";
const DEFAULT_ERROR_MESSAGE = "Something went wrong. Please try again.";

const normalizeMessage = (message: string, fallback: string) => {
  const trimmed = String(message || "").trim();
  if (!trimmed) {
    return fallback;
  }

  if (/[.!?]$/.test(trimmed)) {
    return trimmed;
  }

  return `${trimmed}.`;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const dismiss = useCallback(() => {
    setFeedback(null);
  }, []);

  const show = useCallback(
    (type: FeedbackType, message: string, durationMs?: number) => {
      setFeedback({
        id: Date.now(),
        type,
        message: normalizeMessage(
          message,
          type === "success" ? DEFAULT_SUCCESS_MESSAGE : DEFAULT_ERROR_MESSAGE,
        ),
        durationMs: durationMs ?? (type === "success" ? 3500 : 5000),
      });
    },
    [],
  );

  const showSuccess = useCallback(
    (message: string, durationMs?: number) => {
      show("success", message, durationMs);
    },
    [show],
  );

  const showError = useCallback(
    (message: string, durationMs?: number) => {
      show("error", message, durationMs);
    },
    [show],
  );

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setFeedback((current) =>
        current && current.id === feedback.id ? null : current,
      );
    }, feedback.durationMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [feedback]);

  const value = useMemo(
    () => ({
      showSuccess,
      showError,
      dismiss,
    }),
    [dismiss, showError, showSuccess],
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {feedback && (
        <AnimatedToast
          visible
          message={feedback.message}
          type={feedback.type}
          onDismiss={dismiss}
        />
      )}
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error("useFeedback must be used within a FeedbackProvider");
  }

  return context;
}
