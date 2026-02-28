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

  return (
    <>
      {open ? (
        <div className="fixed bottom-20 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm sm:right-6 sm:w-[22rem]">
          <Card className="border border-border/80 shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bot className="h-4 w-4 text-teal-600" />
                  AI Assistant
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={clearConversation}
                    aria-label="Clear conversation"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => setOpen(false)}
                  >
                    <X className="h-4 w-4" />
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
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-md border p-2 ${
                      message.role === "user"
                        ? "border-teal-400/50 bg-teal-50/40 dark:bg-teal-900/10"
                        : "border-border/70 bg-card"
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      {message.role === "user" ? "You" : "Assistant"}
                    </p>
                    <p className="whitespace-pre-line text-sm text-foreground">
                      {message.text}
                    </p>
                    {message.products && message.products.length > 0 ? (
                      <div className="mt-2 space-y-1">
                        {message.products.slice(0, 3).map((product) => (
                          <Link
                            key={`${message.id}_${product.id}`}
                            to={`/product/${product.id}`}
                            className="block rounded-md border border-border/70 px-2 py-1 text-xs text-muted-foreground hover:bg-muted/40"
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
                  rows={2}
                  placeholder="Ask about product price, stock, or best options"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="w-full"
                  disabled={isLoading || !query.trim()}
                >
                  <Send className="mr-1.5 h-4 w-4" />
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
        className="fixed bottom-4 right-4 z-50 h-14 w-14 rounded-full shadow-lg sm:bottom-6 sm:right-6"
        onClick={() => setOpen(true)}
        aria-label="Open AI assistant"
      >
        <Bot className="h-6 w-6" />
      </Button>
    </>
  );
}
