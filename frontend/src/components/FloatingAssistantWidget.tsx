import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, RotateCcw, Send, X } from "lucide-react";
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

export function FloatingAssistantWidget() {
  const { isAuthenticated, user } = useAuthStore();
  const { formatPrice } = useCurrency();

  const sessionScope = useMemo(
    () => (isAuthenticated && user?.id ? `user_${user.id}` : "guest"),
    [isAuthenticated, user?.id],
  );

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [nextBeforeId, setNextBeforeId] = useState<number | null>(null);
  const [sessionKey, setSessionKey] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
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
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

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
          <Card className="flex h-[32rem] max-h-[80vh] flex-col border border-border/80 shadow-2xl rounded-2xl bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 overflow-hidden">
            <CardHeader className="flex-none pb-3 border-b bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Bot className="h-5 w-5 text-teal-600 drop-shadow" />
                  <span className="tracking-wide">AI Assistant</span>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 rounded-full hover:bg-teal-50 dark:hover:bg-teal-900/30 transition"
                    onClick={clearConversation}
                    aria-label="Clear conversation"
                  >
                    <RotateCcw className="h-4 w-4 text-teal-600" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 rounded-full hover:bg-rose-50 dark:hover:bg-rose-900/30 transition"
                    onClick={() => setOpen(false)}
                    aria-label="Close assistant"
                  >
                    <X className="h-4 w-4 text-rose-600" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0 p-0 overflow-hidden">
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-4 py-4 space-y-6 scroll-smooth"
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
                {!isAuthenticated ? (
                  <p className="text-[10px] text-center text-muted-foreground bg-slate-100 dark:bg-slate-800/50 py-1 rounded-md mb-2">
                    Guest mode: Sign in for personalized help.
                  </p>
                ) : null}
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex flex-col gap-1.5 ${
                      message.role === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        message.role === "user"
                          ? "text-teal-600 mr-1"
                          : "text-slate-500 ml-1"
                      }`}
                    >
                      {message.role === "user" ? "You" : "Assistant"}
                    </span>
                    <div
                      className={`relative max-w-[85%] rounded-2xl px-3 py-2.5 shadow-sm text-[14px] leading-relaxed ${
                        message.role === "user"
                          ? "bg-teal-600 text-white rounded-tr-none border border-teal-500"
                          : "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-none border border-border/60"
                      }`}
                    >
                      <span className="whitespace-pre-line">{message.text}</span>
                    </div>
                    {message.products && message.products.length > 0 ? (
                      <div className="mt-2 w-full max-w-[85%] space-y-1.5">
                        {message.products.slice(0, 3).map((product) => (
                          <Link
                            key={`${message.id}_${product.id}`}
                            to={`/product/${product.id}`}
                            className="flex flex-col rounded-xl border border-teal-200/50 px-3 py-2 text-xs bg-teal-50/50 hover:bg-teal-100 dark:bg-teal-900/10 dark:hover:bg-teal-900/20 transition-colors shadow-sm"
                          >
                            <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                              {product.name}
                            </span>
                            <div className="mt-0.5 flex items-center justify-between text-teal-700 dark:text-teal-400 font-medium">
                              <span>{formatPrice(product.price || 0)}</span>
                              <span className="text-[10px] opacity-70">
                                Stock: {product.available_stock}
                              </span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex flex-col items-start gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-1">
                      Assistant
                    </span>
                    <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-none px-4 py-3 flex gap-1">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                )}
              </div>
              <form
                onSubmit={submit}
                className="flex-none p-4 border-t bg-white dark:bg-slate-900 space-y-3"
              >
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
                  className="min-h-[60px] max-h-[120px] rounded-xl border-2 border-teal-100 focus:border-teal-500 focus-visible:ring-0 focus-visible:ring-offset-0 bg-slate-50 dark:bg-slate-950 text-[14px] px-3 py-2 transition-all duration-200 resize-none"
                  placeholder="Type your message..."
                />
                <Button
                  type="submit"
                  size="sm"
                  className="w-full h-10 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold shadow-md transition-all active:scale-[0.98] disabled:bg-teal-300 disabled:shadow-none"
                  disabled={isLoading || !query.trim()}
                >
                  <Send className="mr-2 h-4 w-4" />
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
