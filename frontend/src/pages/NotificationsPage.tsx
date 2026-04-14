import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BellRing,
  Bot,
  CheckCheck,
  Clock3,
  Filter,
  Trash2,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth";
import api from "@/lib/api";
import {
  clearReadNotifications,
  getUserNotifications,
  onNotificationsChanged,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  markNotificationAsUnread,
  StatusNotificationInput,
  removeNotification,
  syncStatusNotifications,
  UserNotification,
} from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const NOTIFICATION_SECTION_SESSION_KEY = "nobonir_notification_section";

type NotificationFilter = "ALL" | "UNREAD" | "READ";

const formatRelativeTime = (isoDate: string) => {
  const timestamp = new Date(isoDate).getTime();
  if (Number.isNaN(timestamp)) {
    return "just now";
  }

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  const weeks = Math.floor(days / 7);
  if (weeks < 5) {
    return `${weeks}w ago`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${months}mo ago`;
  }

  const years = Math.floor(days / 365);
  return `${years}y ago`;
};

export function NotificationsPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [items, setItems] = useState<UserNotification[]>([]);
  const [filter, setFilter] = useState<NotificationFilter>("ALL");

  const syncOrderStatusNotifications = useCallback(async () => {
    if (!user?.id) {
      setItems([]);
      return;
    }

    try {
      const response = await api.get("/orders/my/");
      const rows = Array.isArray(response.data) ? response.data : [];
      const statusLabelMap: Record<string, string> = {
        PENDING: "Order received",
        PAID: "Payment confirmed",
        PROCESSING: "Preparing items",
        SHIPPED: "Shipped",
        DELIVERED: "Delivered",
        CANCELLED: "Cancelled",
      };

      const orderStatusNotifications = rows.reduce<StatusNotificationInput[]>(
        (acc, row) => {
          const orderId = Number(row?.id || 0);
          const status = String(row?.status || "").toUpperCase();
          if (!orderId || !status) {
            return acc;
          }

          const tone: StatusNotificationInput["tone"] =
            status === "CANCELLED"
              ? "warning"
              : status === "DELIVERED"
                ? "success"
                : "info";

          acc.push({
            term: "Order Update",
            message: `Order #${orderId} is now ${statusLabelMap[status] || status}.`,
            tone,
            sectionKey: `order_status:${status}`,
          });

          return acc;
        },
        [],
      );

      let combinedNotifications = [...orderStatusNotifications];

      try {
        const assistantInsightResponse = await api.get(
          "/ai/assistant/notification-insights/",
        );
        const assistantInsights = Array.isArray(assistantInsightResponse.data)
          ? assistantInsightResponse.data
          : [];

        const normalizedAssistantInsights = assistantInsights
          .map((item) => ({
            term: String(item?.term || "AI Assistant"),
            message: String(item?.message || ""),
            tone:
              item?.tone === "warning" || item?.tone === "success"
                ? item.tone
                : ("info" as const),
            sectionKey: String(item?.sectionKey || "ai_assistant:general"),
          }))
          .filter((item) => item.message);

        combinedNotifications = [
          ...combinedNotifications,
          ...normalizedAssistantInsights,
        ];
      } catch {
        // Optional assistant insights should not block notifications.
        void 0;
      }

      const updated = syncStatusNotifications(user.id, combinedNotifications);
      setItems(updated);
    } catch {
      setItems(getUserNotifications(user.id));
    }
  }, [user?.id]);

  useEffect(() => {
    void syncOrderStatusNotifications();
  }, [syncOrderStatusNotifications]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    return onNotificationsChanged((changedUserId) => {
      if (changedUserId !== user.id) {
        return;
      }

      setItems(getUserNotifications(user.id));
    });
  }, [user?.id]);

  const filteredItems = useMemo(() => {
    if (filter === "UNREAD") {
      return items.filter((item) => !item.read);
    }

    if (filter === "READ") {
      return items.filter((item) => item.read);
    }

    return items;
  }, [filter, items]);

  const unreadCount = useMemo(
    () => items.filter((item) => !item.read).length,
    [items],
  );

  const openNotification = (item: UserNotification) => {
    if (!user?.id) {
      return;
    }

    const updated = markNotificationAsRead(user.id, item.id);
    setItems(updated);

    if (!item.sectionKey) {
      return;
    }

    if (item.sectionKey.startsWith("order_status:")) {
      const statusValue = item.sectionKey.replace("order_status:", "");
      navigate(`/orders?status=${encodeURIComponent(statusValue)}`);
      return;
    }

    if (item.sectionKey.startsWith("ai_assistant:")) {
      const focus = item.sectionKey.replace("ai_assistant:", "");
      navigate(`/assistant?focus=${encodeURIComponent(focus)}`);
      return;
    }

    sessionStorage.setItem(NOTIFICATION_SECTION_SESSION_KEY, item.sectionKey);
    navigate("/");
  };

  const toggleReadState = (item: UserNotification) => {
    if (!user?.id) {
      return;
    }

    if (!item.read) {
      setItems(markNotificationAsRead(user.id, item.id));
      return;
    }

    setItems(markNotificationAsUnread(user.id, item.id));
  };

  const markAllRead = () => {
    if (!user?.id) {
      return;
    }

    setItems(markAllNotificationsAsRead(user.id));
  };

  const clearRead = () => {
    if (!user?.id) {
      return;
    }

    setItems(clearReadNotifications(user.id));
  };

  const deleteOne = (id: string) => {
    if (!user?.id) {
      return;
    }

    setItems(removeNotification(user.id, id));
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
                <BellRing className="h-5 w-5 text-teal-600" />
                Notifications
              </CardTitle>
              <Link to="/">
                <Button variant="outline" size="sm">
                  Back to Home
                </Button>
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              Unread: {unreadCount} · Total: {items.length}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link to="/assistant">
                <Button size="sm" variant="outline">
                  <Bot className="mr-1.5 h-3.5 w-3.5" />
                  Open AI Assistant
                </Button>
              </Link>
              {(["ALL", "UNREAD", "READ"] as NotificationFilter[]).map(
                (key) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={filter === key ? "default" : "outline"}
                    onClick={() => setFilter(key)}
                  >
                    <Filter className="mr-1.5 h-3.5 w-3.5" />
                    {key === "ALL"
                      ? "All"
                      : key === "UNREAD"
                        ? "Unread"
                        : "Read"}
                  </Button>
                ),
              )}
              <Button size="sm" variant="outline" onClick={markAllRead}>
                <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
                Mark all read
              </Button>
              <Button size="sm" variant="outline" onClick={clearRead}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Clear read
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {filteredItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                No notifications in this view.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredItems.map((item) => {
                  const toneClass =
                    item.tone === "warning"
                      ? "text-amber-700 dark:text-amber-300"
                      : item.tone === "success"
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-cyan-700 dark:text-cyan-300";

                  return (
                    <div
                      key={item.id}
                      className={`rounded-lg border p-3 ${
                        item.read
                          ? "border-border/70 bg-card"
                          : "border-teal-300/60 bg-teal-50/40 dark:bg-teal-900/10"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => openNotification(item)}
                        >
                          <p className={`text-sm font-semibold ${toneClass}`}>
                            {item.term}
                          </p>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {item.message}
                          </p>
                          <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock3 className="h-3 w-3" />
                            <span
                              title={new Date(item.createdAt).toLocaleString()}
                            >
                              {formatRelativeTime(item.createdAt)}
                            </span>
                          </p>
                        </button>
                        <div className="flex shrink-0 gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2.5 text-xs"
                            onClick={() => toggleReadState(item)}
                          >
                            {item.read ? "Mark unread" : "Mark read"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2.5 text-xs"
                            onClick={() => deleteOne(item.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
