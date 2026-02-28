import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bot, RotateCcw, Send } from "lucide-react";
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

export function AIAssistantPage() {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();
  const focusContext = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("focus") || "";
  }, [location.search]);

  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionKey, setSessionKey] = useState("");
  const [runtimeProviderLabel, setRuntimeProviderLabel] = useState("");
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

  const submit = async (event: FormEvent) => {
    event.preventDefault();
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
            {runtimeProviderLabel ? (
              <p className="text-xs text-muted-foreground">
                {runtimeProviderLabel}
              </p>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
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
                  {message.role === "assistant" && message.llmProvider ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Provider: {message.llmProvider}
                      {message.llmEnhanced
                        ? " (enhanced)"
                        : " (local fallback)"}
                      {message.llmAttempts && message.llmAttempts.length > 0
                        ? ` · tried: ${message.llmAttempts.join(" → ")}`
                        : ""}
                    </p>
                  ) : null}
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
                            {product.category} · ৳
                            {Number(product.price || 0).toFixed(2)}
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
