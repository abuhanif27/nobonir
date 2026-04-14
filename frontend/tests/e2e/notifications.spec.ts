import { expect, test } from "@playwright/test";

test.describe("notification persistence", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const authStore = {
        state: {
          accessToken: "test-access-token",
          refreshToken: "test-refresh-token",
          user: {
            id: 21,
            email: "notifqa@example.com",
            first_name: "Notif",
            last_name: "QA",
            role: "CUSTOMER",
          },
        },
        version: 0,
      };

      window.localStorage.setItem("auth-storage", JSON.stringify(authStore));
      window.localStorage.setItem(
        "nobonir_notifications_user_21",
        JSON.stringify([
          {
            id: "notif-shipped",
            term: "Order Update",
            message: "Order #20 is now Shipped.",
            tone: "info",
            sectionKey: "order_status:SHIPPED",
            sourceKey: "order_status:SHIPPED::Order Update::Order #20 is now Shipped.",
            createdAt: "2026-04-14T10:00:00.000Z",
            read: true,
          },
          {
            id: "notif-pending",
            term: "Order Update",
            message: "Order #21 is now Order received.",
            tone: "info",
            sectionKey: "order_status:PENDING",
            sourceKey: "order_status:PENDING::Order Update::Order #21 is now Order received.",
            createdAt: "2026-04-14T11:00:00.000Z",
            read: false,
          },
        ]),
      );
    });

    await page.route("**/accounts/me/", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 21,
          email: "notifqa@example.com",
          first_name: "Notif",
          last_name: "QA",
          role: "CUSTOMER",
        }),
      });
    });

    await page.route("**/orders/my/", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: 20,
            status: "SHIPPED",
            updated_at: "2026-04-14T10:00:00.000Z",
          },
          {
            id: 21,
            status: "PENDING",
            updated_at: "2026-04-14T11:00:00.000Z",
          },
        ]),
      });
    });

    await page.route("**/ai/assistant/notification-insights/", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.route("**/products/?**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          count: 0,
          next: null,
          previous: null,
          results: [],
        }),
      });
    });

    await page.route("**/products/merchandising/", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          trending_now: [],
          almost_gone: [],
          just_restocked: [],
          back_in_stock: [],
        }),
      });
    });

    await page.route("**/ai/preferences/", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          age: 25,
          location: "Dhaka",
          continent: "Asia",
          preferred_categories: [],
        }),
      });
    });

    await page.route("**/ai/recommendations/personalized/", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.route("**/cart/", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
  });

  test("deleted and cleared notifications stay gone across pages", async ({
    page,
  }) => {
    await page.goto("/notifications");

    await expect(page.getByText("Order #20 is now Shipped.")).toBeVisible();
    await expect(page.getByText("Order #21 is now Order received.")).toBeVisible();

    await page.getByRole("button", { name: "Delete" }).first().click();
    await page.getByRole("button", { name: "Clear read" }).click();

    await expect(page.getByText("Order #20 is now Shipped.")).toHaveCount(0);
    await expect(page.getByText("Order #21 is now Order received.")).toHaveCount(0);

    await page.goto("/");
    const notificationButton = page.getByRole("button", {
      name: /Notifications/,
    });
    await notificationButton.click();

    const notificationMenu = page.locator(
      "#dashboard-notification-menu",
    );
    await expect(notificationMenu).toBeVisible();
    await expect(page.getByText("Order #20 is now Shipped.")).toHaveCount(0);
    await expect(page.getByText("Order #21 is now Order received.")).toHaveCount(0);
    await expect(page.getByText("No new notifications.")).toBeVisible();
  });
});