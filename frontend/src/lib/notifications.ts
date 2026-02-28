export type NotificationTone = "info" | "warning" | "success";

export type StatusNotificationInput = {
  term: string;
  message: string;
  tone: NotificationTone;
  sectionKey?: string;
};

export type UserNotification = {
  id: string;
  term: string;
  message: string;
  tone: NotificationTone;
  sectionKey?: string;
  sourceKey: string;
  createdAt: string;
  read: boolean;
};

const STORAGE_KEY_PREFIX = "nobonir_notifications_user_";

const getStorageKey = (userId: number) => `${STORAGE_KEY_PREFIX}${userId}`;

const safeParse = (raw: string | null): UserNotification[] => {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is UserNotification => {
      if (!item || typeof item !== "object") {
        return false;
      }

      const candidate = item as Partial<UserNotification>;
      return (
        typeof candidate.id === "string" &&
        typeof candidate.term === "string" &&
        typeof candidate.message === "string" &&
        typeof candidate.tone === "string" &&
        typeof candidate.sourceKey === "string" &&
        typeof candidate.createdAt === "string" &&
        typeof candidate.read === "boolean"
      );
    });
  } catch {
    return [];
  }
};

const sortNotifications = (notifications: UserNotification[]) =>
  [...notifications].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );

export const getUserNotifications = (userId: number): UserNotification[] => {
  if (typeof window === "undefined") {
    return [];
  }

  const notifications = safeParse(localStorage.getItem(getStorageKey(userId)));
  return sortNotifications(notifications);
};

const saveUserNotifications = (
  userId: number,
  notifications: UserNotification[],
): UserNotification[] => {
  if (typeof window === "undefined") {
    return notifications;
  }

  const sorted = sortNotifications(notifications);
  localStorage.setItem(getStorageKey(userId), JSON.stringify(sorted));
  return sorted;
};

const buildSourceKey = (item: StatusNotificationInput) =>
  `${item.sectionKey || "general"}::${item.term}::${item.message}`;

const buildId = () =>
  `notif_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

export const syncStatusNotifications = (
  userId: number,
  incoming: StatusNotificationInput[],
): UserNotification[] => {
  const existing = getUserNotifications(userId);
  const bySourceKey = new Map(existing.map((item) => [item.sourceKey, item]));
  const nowIso = new Date().toISOString();

  const merged = [...existing];
  for (const item of incoming) {
    const sourceKey = buildSourceKey(item);
    const existingItem = bySourceKey.get(sourceKey);

    if (existingItem) {
      existingItem.term = item.term;
      existingItem.message = item.message;
      existingItem.tone = item.tone;
      existingItem.sectionKey = item.sectionKey;
      continue;
    }

    merged.push({
      id: buildId(),
      term: item.term,
      message: item.message,
      tone: item.tone,
      sectionKey: item.sectionKey,
      sourceKey,
      createdAt: nowIso,
      read: false,
    });
  }

  return saveUserNotifications(userId, merged);
};

export const markNotificationAsRead = (
  userId: number,
  notificationId: string,
): UserNotification[] => {
  const current = getUserNotifications(userId);
  const next = current.map((item) =>
    item.id === notificationId ? { ...item, read: true } : item,
  );
  return saveUserNotifications(userId, next);
};

export const markNotificationAsUnread = (
  userId: number,
  notificationId: string,
): UserNotification[] => {
  const current = getUserNotifications(userId);
  const next = current.map((item) =>
    item.id === notificationId ? { ...item, read: false } : item,
  );
  return saveUserNotifications(userId, next);
};

export const markAllNotificationsAsRead = (
  userId: number,
): UserNotification[] => {
  const current = getUserNotifications(userId);
  const next = current.map((item) => ({ ...item, read: true }));
  return saveUserNotifications(userId, next);
};

export const removeNotification = (
  userId: number,
  notificationId: string,
): UserNotification[] => {
  const current = getUserNotifications(userId);
  const next = current.filter((item) => item.id !== notificationId);
  return saveUserNotifications(userId, next);
};

export const clearReadNotifications = (userId: number): UserNotification[] => {
  const current = getUserNotifications(userId);
  const next = current.filter((item) => !item.read);
  return saveUserNotifications(userId, next);
};
