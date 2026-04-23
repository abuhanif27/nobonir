import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, RotateCcw, Send, X } from "lucide-react";
import { Virtuoso } from "react-virtuoso";
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
  const { formatPrice, currencyCode, currencyRate } = useCurrency();

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
      const body = await askAssistant(trimmed, sessionKey, {
        currencyCode,
        currencyRate,
      });
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
        <div className="fixed bottom-18 left-2 right-2 z-50 mx-auto w-[calc(100vw-1rem)] max-w-md sm:bottom-20 sm:left-auto sm:right-6 sm:w-[22rem]">
          <Card className="flex h-[34rem] max-h-[82vh] flex-col overflow-hidden rounded-[1.75rem] border border-border/70 bg-card/95 shadow-2xl shadow-slate-950/12 backdrop-blur-xl dark:bg-slate-900/95">
            <CardHeader className="flex-none border-b border-border/70 bg-white/60 px-4 pb-3 pt-3 backdrop-blur-md dark:bg-slate-950/60 sm:px-4 sm:pb-3 sm:pt-4">
              <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                <CardTitle className="flex items-center gap-2 text-[14px] font-semibold tracking-tight sm:text-base sm:font-bold sm:tracking-wide">
                  <Bot className="h-4.5 w-4.5 text-teal-600 drop-shadow sm:h-5 sm:w-5" />
                  <span className="tracking-wide">AI Assistant</span>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7 rounded-full border-border/70 bg-background/70 transition hover:bg-teal-50 dark:hover:bg-teal-900/30 sm:h-8 sm:w-8"
                    onClick={clearConversation}
                    aria-label="Clear conversation"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-teal-600 sm:h-4 sm:w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7 rounded-full border-border/70 bg-background/70 transition hover:bg-rose-50 dark:hover:bg-rose-900/30 sm:h-8 sm:w-8"
                    onClick={() => setOpen(false)}
                    aria-label="Close assistant"
                  >
                    <X className="h-3.5 w-3.5 text-rose-600 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex min-h-0 flex-col overflow-hidden p-0">
              <Virtuoso
                className="flex-1 px-4 py-4 scrollbar-hide [scrollbar-width:none] [&::-webkit-scrollbar]:hidden scroll-smooth overscroll-contain sm:px-4 sm:py-4"
                data={messages}
                atTopThreshold={48}
                startReached={() => {
                  void loadOlderHistory();
                }}
                followOutput={(isAtBottom) => (isAtBottom ? "smooth" : false)}
                components={{
                  Header: () => (
                    <>
                      {hasMoreHistory ? (
                        <div className="flex justify-center pb-3">
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
                        <p className="text-[10px] text-center text-muted-foreground bg-slate-100 dark:bg-slate-800/50 py-1 rounded-md mb-4">
                          Guest mode: Sign in for personalized help.
                        </p>
                      ) : null}
                    </>
                  ),
                  Footer: () =>
                    isLoading ? (
                      <div className="flex flex-col items-start gap-1.5 pt-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-1">
                          Assistant
                        </span>
                        <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-none px-4 py-3 flex gap-1">
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                        </div>
                      </div>
                    ) : null,
                }}
                itemContent={(_, message) => (
                  <div
                    key={message.id}
                    className={`animate-in fade-in-0 slide-in-from-bottom-2 duration-300 w-full pb-5 flex flex-col gap-1.5 motion-reduce:animate-none ${
                      message.role === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        message.role === "user"
                          ? "self-end text-teal-600"
                          : "self-start text-slate-500"
                      }`}
                    >
                      {message.role === "user" ? "You" : "Assistant"}
                    </span>
                    <div
                      className={`relative w-fit max-w-[82%] rounded-[1.25rem] px-3 py-2.5 shadow-sm text-[14px] leading-relaxed sm:max-w-[78%] ${
                        message.role === "user"
                          ? "self-end mr-2 bg-teal-600/90 text-white rounded-tr-none border border-teal-500/60 shadow-teal-950/10 sm:mr-3"
                          : "self-start bg-white/95 dark:bg-slate-800/95 text-slate-900 dark:text-slate-100 rounded-tl-none border border-border/60"
                      }`}
                    >
                      <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.text}</span>
                    </div>
                    {message.products && message.products.length > 0 ? (
                      <div
                        className={`mt-2 w-full max-w-[82%] space-y-1.5 sm:max-w-[78%] ${
                          message.role === "user" ? "self-end mr-2 sm:mr-3" : "self-start"
                        }`}
                      >
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
                )}
              />
              <form
                onSubmit={submit}
                className="flex-none space-y-3 border-t border-border/70 bg-white/95 p-3 backdrop-blur-md dark:bg-slate-900/95 sm:p-4"
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
                  className="min-h-[72px] max-h-[160px] rounded-xl border-2 border-border/60 bg-slate-50 px-3 py-2 text-[14px] leading-6 transition-all duration-200 resize-none focus:border-teal-500 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-slate-950"
                  placeholder="Type your message..."
                />
                <Button
                  type="submit"
                  size="sm"
                  className="h-10 w-full rounded-xl bg-teal-600/95 font-semibold tracking-tight text-white shadow-sm transition-all duration-200 active:scale-[0.98] hover:bg-teal-700 disabled:bg-teal-300 disabled:shadow-none"
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
        className="fixed bottom-4 right-4 z-50 h-16 w-16 rounded-full border border-border/70 bg-card/95 shadow-xl shadow-slate-950/15 transition hover:scale-105 hover:border-teal-300 hover:bg-card sm:bottom-6 sm:right-6"
        onClick={() => setOpen(true)}
        aria-label="Open AI assistant"
      >
        <Bot className="h-7 w-7 text-teal-600 drop-shadow-sm" />
      </Button>
    </>
  );
}
