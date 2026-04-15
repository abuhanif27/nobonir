import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bot, RotateCcw, Send } from "lucide-react";
import { useAuthStore } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import {
  askAssistant,
  AssistantMessage,
  clearAssistantHistory,
  clearAssistantSessionKey,
  getAssistantHistory,
  getAssistantSessionKey,
  setAssistantSessionKey,
} from "@/lib/assistant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export function AIAssistantPage() {
  const { isAuthenticated, user } = useAuthStore();
  const { formatPrice } = useCurrency();
  const location = useLocation();
  const focusContext = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("focus") || "";
  }, [location.search]);

  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [nextBeforeId, setNextBeforeId] = useState<number | null>(null);
  const [sessionKey, setSessionKey] = useState("");
  const historyScrollRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: "assistant_welcome",
      role: "assistant",
      text: "I can help with product recommendations, order support, and fit guidance. Ask me anything about your shopping.",
    },
  ]);

  const defaultWelcomeMessages = useMemo<AssistantMessage[]>(
    () => [
      {
        id: "assistant_welcome",
        role: "assistant",
        text: "I can help with product recommendations, order support, and fit guidance. Ask me anything about your shopping.",
      },
    ],
    [],
  );

  const sessionScope = useMemo(
    () => (isAuthenticated && user?.id ? `user_${user.id}` : "guest"),
    [isAuthenticated, user?.id],
  );

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      const stored = getAssistantSessionKey(sessionScope);
      try {
        const history = await getAssistantHistory(stored || undefined, { limit: 30 });
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
          setHasMoreHistory(Boolean(history.has_more));
          setNextBeforeId(history.next_before_id);
          return;
        }

        setMessages(defaultWelcomeMessages);
        setHasMoreHistory(false);
        setNextBeforeId(null);
      } catch {
        if (cancelled) {
          return;
        }
        setSessionKey(stored);
      }
    };

    void loadHistory();

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
      setHasMoreHistory(false);
      setNextBeforeId(null);
      setQuery("");
    }
  };

  const loadOlderHistory = async () => {
    if (!sessionKey || !hasMoreHistory || !nextBeforeId || isHistoryLoading) {
      return;
    }

    setIsHistoryLoading(true);
    try {
      const history = await getAssistantHistory(sessionKey, {
        beforeId: nextBeforeId,
        limit: 30,
      });

      setMessages((prev) => {
        const existing = new Set(prev.map((item) => item.id));
        const older = history.messages.filter((item) => !existing.has(item.id));
        return [...older, ...prev];
      });
      setHasMoreHistory(Boolean(history.has_more));
      setNextBeforeId(history.next_before_id);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const sendMessage = async () => {
    const trimmed = query.trim();
    if (!trimmed || isLoading) {
      return;
    }

    const userMessage: AssistantMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      text: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setQuery("");
    setIsLoading(true);

    try {
      const body = await askAssistant(trimmed, sessionKey);
      if (body.session_key) {
        setSessionKey(body.session_key);
        setAssistantSessionKey(sessionScope, body.session_key);
      }
      const assistantMessage: AssistantMessage = {
        id: `assistant_${Date.now()}`,
        role: "assistant",
        text: body.reply,
        intent: body.intent,
        llmProvider: body.llm_provider,
        llmEnhanced: body.llm_enhanced,
        llmAttempts: body.llm_attempts,
        products: body.suggested_products,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant_error_${Date.now()}`,
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 pt-20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 sm:pt-24">
      <main
        id="main-content"
        className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 lg:px-8"
      >
        <Card className="border border-border/70">
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl">
                <Bot className="h-5 w-5 text-teal-600" />
                AI Shopping Assistant
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={clearConversation}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Clear conversation
                </Button>
                <Link to="/">
                  <Button variant="outline" size="sm">
                    Back to Home
                  </Button>
                </Link>
              </div>
            </div>
            {focusContext ? (
              <p className="text-sm text-muted-foreground">
                Focus context: {focusContext}
              </p>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              ref={historyScrollRef}
              className="max-h-[65vh] overflow-y-auto space-y-3 pr-1"
              onScroll={(event) => {
                const element = event.currentTarget;
                if (element.scrollTop <= 24) {
                  void loadOlderHistory();
                }
              }}
            >
              {hasMoreHistory ? (
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={loadOlderHistory}
                    disabled={isHistoryLoading}
                  >
                    {isHistoryLoading ? "Loading..." : "Load older messages"}
                  </Button>
                </div>
              ) : null}
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-lg border p-3 ${
                    message.role === "user"
                      ? "border-teal-400/50 bg-teal-50/40 dark:bg-teal-900/10"
                      : "border-border/70 bg-card"
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {message.role === "user" ? "You" : "Assistant"}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm text-foreground">
                    {message.text}
                  </p>
                  {message.products && message.products.length > 0 ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {message.products.map((product) => (
                        <Link
                          key={`${message.id}_${product.id}`}
                          to={`/product/${product.id}`}
                          className="rounded-md border border-border/70 p-2 transition hover:bg-muted/40"
                        >
                          <p className="text-sm font-semibold text-foreground">
                            {product.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {product.category} · {formatPrice(product.price || 0)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {product.availability_status}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Stock: {product.available_stock}
                          </p>
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
                placeholder="Example: suggest breathable shirts under 2000"
                rows={3}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={isLoading || !query.trim()}>
                  <Send className="mr-1.5 h-4 w-4" />
                  {isLoading ? "Thinking..." : "Send"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
