import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, RotateCcw, Send, X } from "lucide-react";
import { useAuthStore } from "@/lib/auth";
import {
  askAssistant,
  AssistantMessage,
  clearAssistantHistory,
  clearAssistantSessionKey,
  getAssistantHistory,
  getAssistantRuntimeStatus,
  getAssistantSessionKey,
  setAssistantSessionKey,
} from "@/lib/assistant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export function FloatingAssistantWidget() {
  const { isAuthenticated, user } = useAuthStore();

  const sessionScope = useMemo(
    () => (isAuthenticated && user?.id ? `user_${user.id}` : "guest"),
    [isAuthenticated, user?.id],
  );

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionKey, setSessionKey] = useState("");
  const [runtimeProviderLabel, setRuntimeProviderLabel] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: "assistant_welcome_widget",
      role: "assistant",
      text: "Hi! I can answer product price, stock, and recommendation questions.",
    },
  ]);

  const defaultWelcomeMessages = useMemo<AssistantMessage[]>(
    () => [
      {
        id: "assistant_welcome_widget",
        role: "assistant",
        text: "Hi! I can answer product price, stock, and recommendation questions.",
      },
    ],
    [],
  );

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      const stored = getAssistantSessionKey(sessionScope);
      try {
        const history = await getAssistantHistory(stored || undefined);
        if (cancelled) {
          return;
        }

        const nextSessionKey = history.session_key || stored;
        if (nextSessionKey) {
          setSessionKey(nextSessionKey);
          setAssistantSessionKey(sessionScope, nextSessionKey);
        }

        if (history.messages.length > 0) {
          setMessages(history.messages);
          return;
        }

        setMessages(defaultWelcomeMessages);
      } catch {
        if (cancelled) {
          return;
        }
        setSessionKey(stored);
      }
    };

    void loadHistory();

    void getAssistantRuntimeStatus()
      .then((status) => {
        setRuntimeProviderLabel(
          status.enabled
            ? `Live LLM chain: ${status.providers.join(" → ")} → local`
            : "Live LLM disabled, using local assistant",
        );
      })
      .catch(() => {
        setRuntimeProviderLabel("Runtime status unavailable");
      });

    return () => {
      cancelled = true;
    };
  }, [defaultWelcomeMessages, sessionScope]);

  const clearConversation = async () => {
    try {
      const response = await clearAssistantHistory(sessionKey);
      setSessionKey(response.session_key);
      setAssistantSessionKey(sessionScope, response.session_key);
    } catch {
      clearAssistantSessionKey(sessionScope);
      setSessionKey("");
    } finally {
      setMessages(defaultWelcomeMessages);
      setQuery("");
    }
  };

  const sendMessage = async () => {
    const trimmed = query.trim();
    if (!trimmed || isLoading) {
      return;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: `user_widget_${Date.now()}`,
        role: "user",
        text: trimmed,
      },
    ]);
    setQuery("");
    setIsLoading(true);

    try {
      const body = await askAssistant(trimmed, sessionKey);
      if (body.session_key) {
        setSessionKey(body.session_key);
        setAssistantSessionKey(sessionScope, body.session_key);
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant_widget_${Date.now()}`,
          role: "assistant",
          text: body.reply,
          intent: body.intent,
          llmProvider: body.llm_provider,
          llmEnhanced: body.llm_enhanced,
          llmAttempts: body.llm_attempts,
          products: body.suggested_products,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant_widget_error_${Date.now()}`,
          role: "assistant",
          text: "Assistant is temporarily unavailable. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await sendMessage();
  };

  return (
    <>
      {open ? (
        <div className="fixed bottom-20 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm sm:right-6 sm:w-[22rem]">
          <Card className="border border-border/80 shadow-2xl rounded-2xl bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Bot className="h-5 w-5 text-teal-600 drop-shadow" />
                  <span className="tracking-wide">AI Assistant</span>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-9 w-9 rounded-full hover:bg-teal-50 dark:hover:bg-teal-900/30 transition"
                    onClick={clearConversation}
                    aria-label="Clear conversation"
                  >
                    <RotateCcw className="h-5 w-5 text-teal-600" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-9 w-9 rounded-full hover:bg-rose-50 dark:hover:bg-rose-900/30 transition"
                    onClick={() => setOpen(false)}
                    aria-label="Close assistant"
                  >
                    <X className="h-5 w-5 text-rose-600" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {!isAuthenticated ? (
                <p className="text-xs text-muted-foreground">
                  Guest mode is active. Sign in for personalized recommendations
                  and order tracking.
                </p>
              ) : null}
              {runtimeProviderLabel ? (
                <p className="text-xs text-muted-foreground">
                  {runtimeProviderLabel}
                </p>
              ) : null}
              <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`relative flex flex-col gap-1 rounded-xl px-3 py-2 shadow-sm ${
                      message.role === "user"
                        ? "self-end bg-teal-100/80 dark:bg-teal-900/40 border border-teal-300/60"
                        : "self-start bg-white dark:bg-slate-950 border border-border/60"
                    }`}
                  >
                    <span className={`absolute -top-2 left-2 text-[10px] font-semibold uppercase ${message.role === "user" ? "text-teal-700" : "text-slate-500"}`}>{message.role === "user" ? "You" : "Assistant"}</span>
                    <span className="whitespace-pre-line text-[15px] text-slate-900 dark:text-slate-100">
                      {message.text}
                    </span>
                    {message.role === "assistant" && message.llmProvider ? (
                      <span className="mt-1 text-[11px] text-muted-foreground">
                        Provider: {message.llmProvider}
                        {message.llmEnhanced
                          ? " (enhanced)"
                          : " (local fallback)"}
                        {message.llmAttempts && message.llmAttempts.length > 0
                          ? ` · tried: ${message.llmAttempts.join(" → ")}`
                          : ""}
                      </span>
                    ) : null}
                    {message.products && message.products.length > 0 ? (
                      <div className="mt-2 space-y-1">
                        {message.products.slice(0, 3).map((product) => (
                          <Link
                            key={`${message.id}_${product.id}`}
                            to={`/product/${product.id}`}
                            className="block rounded-lg border border-teal-200 px-2 py-1 text-xs text-teal-700 bg-teal-50 hover:bg-teal-100 dark:text-teal-100 dark:bg-teal-900/30 dark:hover:bg-teal-900/60 transition"
                          >
                            <span className="font-medium text-foreground">
                              {product.name}
                            </span>
                            {` · ৳${Number(product.price || 0).toFixed(2)} · Stock ${product.available_stock}`}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              <form onSubmit={submit} className="space-y-2">
                <Textarea
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void sendMessage();
                    }
                  }}
                  rows={2}
                  className="rounded-xl border-2 border-teal-200 focus:border-teal-400 bg-white dark:bg-slate-950 text-[15px] px-3 py-2"
                  placeholder="Ask about product price, stock, or best options"
                />
                <Button
                  type="submit"
                  size="lg"
                  className="w-full rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-base font-semibold py-2 shadow-md transition disabled:bg-teal-300"
                  disabled={isLoading || !query.trim()}
                >
                  <Send className="mr-2 h-5 w-5" />
                  {isLoading ? "Thinking..." : "Send"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Button
        type="button"
        size="icon"
        className="fixed bottom-4 right-4 z-50 h-16 w-16 rounded-full shadow-2xl bg-gradient-to-br from-teal-500 via-teal-600 to-teal-700 hover:scale-105 transition sm:bottom-6 sm:right-6"
        onClick={() => setOpen(true)}
        aria-label="Open AI assistant"
      >
        <Bot className="h-7 w-7 text-white drop-shadow" />
      </Button>
    </>
  );
}
