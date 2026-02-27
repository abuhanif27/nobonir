import { expect, test } from "@playwright/test";

test("skip link jumps to main content", async ({ page }) => {
  await page.goto("/");

  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await skipLink.focus();
  await expect(skipLink).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main-content$/);
  await expect(page.locator("#main-content")).toBeVisible();
});

test("mobile navigation menu supports aria state and Escape close", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const menuToggle = page.getByRole("button", {
    name: "Toggle navigation menu",
  });

  await expect(menuToggle).toHaveAttribute("aria-expanded", "false");
  await menuToggle.focus();
  await page.keyboard.press("Enter");

  await expect(menuToggle).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("navigation", { name: "Mobile primary" }),
  ).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(menuToggle).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.getByRole("navigation", { name: "Mobile primary" }),
  ).toBeHidden();
});

test("authenticated user menu opens with keyboard and closes with Escape", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const authStore = {
      state: {
        accessToken: "test-access-token",
        refreshToken: "test-refresh-token",
        user: {
          id: 11,
          email: "navqa@example.com",
          first_name: "Nav",
          last_name: "QA",
          role: "CUSTOMER",
        },
      },
      version: 0,
    };

    window.localStorage.setItem("auth-storage", JSON.stringify(authStore));
  });

  await page.route("**/accounts/me/", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: 11,
        email: "navqa@example.com",
        first_name: "Nav",
        last_name: "QA",
        role: "CUSTOMER",
      }),
    });
  });

  await page.route("**/cart/", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  await page.goto("/");

  const userMenuButton = page.locator('[data-user-menu-trigger="true"]');
  await userMenuButton.focus();
  await page.keyboard.press("Enter");

  const userMenu = page.getByRole("menu", { name: "User menu" });
  await expect(userMenu).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(userMenu).toBeHidden();
});
