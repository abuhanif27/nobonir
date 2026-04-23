import api from "@/lib/api";

export type AssistantProduct = {
  id: number;
  name: string;
  slug: string;
  price: string | number;
  image: string;
  category: string;
  availability_status: string;
  available_stock: number;
};

export type AssistantMessage = {
  id: string;
  serverId?: number;
  role: "user" | "assistant";
  text: string;
  intent?: string;
  products?: AssistantProduct[];
  createdAt?: string;
  llmProvider?: string;
  llmEnhanced?: boolean;
  llmAttempts?: string[];
};

const SESSION_STORAGE_PREFIX = "nobonir_assistant_session";

const storageKeyForScope = (scope: string) =>
  `${SESSION_STORAGE_PREFIX}_${scope}`;

export const getAssistantSessionKey = (scope: string) => {
  if (typeof window === "undefined") {
    return "";
  }
  return localStorage.getItem(storageKeyForScope(scope)) || "";
};

export const setAssistantSessionKey = (scope: string, sessionKey: string) => {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(storageKeyForScope(scope), sessionKey);
};

export const clearAssistantSessionKey = (scope: string) => {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem(storageKeyForScope(scope));
};

export const askAssistant = async (
  message: string,
  sessionKey?: string,
  options?: { currencyCode?: string; currencyRate?: number },
) => {
  const response = await api.post("/ai/assistant/chat/", {
    message,
    session_key: sessionKey || undefined,
    currency_code: options?.currencyCode || undefined,
    currency_rate:
      typeof options?.currencyRate === "number" && Number.isFinite(options.currencyRate)
        ? options.currencyRate
        : undefined,
  });
  const body = response.data || {};

  return {
    reply: String(body.reply || "I could not generate a response right now."),
    intent: String(body.intent || "GENERAL"),
    session_key: String(body.session_key || ""),
    llm_provider: String(body.llm_provider || "local"),
    llm_enhanced: Boolean(body.llm_enhanced),
    llm_attempts: Array.isArray(body.llm_attempts)
      ? body.llm_attempts.map((item: unknown) => String(item))
      : [],
    suggested_products: Array.isArray(body.suggested_products)
      ? body.suggested_products
      : [],
  };
};

export const getAssistantHistory = async (
  sessionKey?: string,
  options?: { beforeId?: number; limit?: number },
) => {
  const response = await api.get("/ai/assistant/history/", {
    params: {
      session_key: sessionKey || undefined,
      before_id: options?.beforeId || undefined,
      limit: options?.limit || undefined,
    },
  });
  const body = response.data || {};
  const messages = Array.isArray(body.messages) ? body.messages : [];

  return {
    session_key: String(body.session_key || ""),
    has_more: Boolean(body.has_more),
    next_before_id:
      typeof body.next_before_id === "number" && Number.isFinite(body.next_before_id)
        ? Number(body.next_before_id)
        : null,
    messages: messages.map((item: Record<string, unknown>, index: number) => ({
      id: `history_${String(item.id || index)}_${String(item.created_at || "")}`,
      serverId:
        typeof item.id === "number" && Number.isFinite(item.id)
          ? Number(item.id)
          : undefined,
      role: item.role === "user" ? "user" : "assistant",
      text: String(item.text || ""),
      intent: String(item.intent || ""),
      createdAt: String(item.created_at || ""),
    })) as AssistantMessage[],
  };
};

export const clearAssistantHistory = async (sessionKey?: string) => {
  const response = await api.delete("/ai/assistant/history/", {
    params: {
      session_key: sessionKey || undefined,
    },
  });

  const body = response.data || {};
  return {
    session_key: String(body.session_key || ""),
  };
};

export const getAssistantRuntimeStatus = async () => {
  const response = await api.get("/ai/assistant/status/");
  const body = response.data || {};
  return {
    enabled: Boolean(body.enabled),
    providers: Array.isArray(body.providers)
      ? body.providers.map((item: unknown) => String(item))
      : [],
    timeout_seconds: Number(body.timeout_seconds || 0),
    huggingface_token_configured: Boolean(body.huggingface_token_configured),
    test_mode: Boolean(body.test_mode),
  };
};
