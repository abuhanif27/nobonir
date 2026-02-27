import api from "./api";

export type AnalyticsEventName =
  | "view_product"
  | "add_to_cart"
  | "begin_checkout";

export async function trackEvent(
  eventName: AnalyticsEventName,
  metadata: Record<string, unknown> = {},
) {
  try {
    await api.post("/analytics/events/", {
      event_name: eventName,
      source: "frontend",
      path: window.location.pathname,
      metadata,
    });
  } catch {
    // Intentionally swallow telemetry failures
  }
}
