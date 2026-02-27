import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  const product = {
    id: 1,
    name: "Keyboard QA Headphones",
    description: "Accessibility and keyboard smoke test product.",
    price: "1299.00",
    image_url:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&h=700&fit=crop,https://images.unsplash.com/photo-1518444065439-e933c06ce9cd?w=900&h=700&fit=crop",
    stock: 10,
    category: {
      id: 5,
      name: "Audio",
    },
  };

  await page.route(/\/products(?:\/products)?\/1\/$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(product),
    });
  });

  await page.addInitScript(() => {
    const authStore = {
      state: {
        accessToken: "test-access-token",
        refreshToken: "test-refresh-token",
        user: {
          id: 7,
          email: "qa@example.com",
          first_name: "QA",
          last_name: "User",
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
        id: 7,
        email: "qa@example.com",
        first_name: "QA",
        last_name: "User",
        role: "CUSTOMER",
      }),
    });
  });

  await page.route("**/reviews/my/", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  await page.route("**/reviews/can-review/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ can_review: true }),
    });
  });

  await page.route(/\/reviews\/(\?.*)?$/, async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: 10,
          user_name: "Demo User",
          product: 1,
          rating: 4,
          comment: "Good keyboard support.",
          created_at: "2026-02-01T08:00:00Z",
        },
      ]),
    });
  });

  await page.route("**/cart/", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  await page.route("**/cart/items/", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
});

test("keyboard navigation works for gallery, quantity and rating controls", async ({
  page,
}) => {
  await page.goto("/product/1");

  await expect(
    page.getByRole("heading", { name: "Keyboard QA Headphones" }),
  ).toBeVisible();

  const galleryRadios = page
    .getByRole("radiogroup", { name: "Product image gallery" })
    .getByRole("radio");

  await expect(galleryRadios).toHaveCount(2);

  await galleryRadios.first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(galleryRadios.nth(1)).toHaveAttribute("aria-checked", "true");

  const increaseQuantity = page.getByRole("button", {
    name: "Increase quantity",
  });
  await increaseQuantity.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("2", { exact: true })).toBeVisible();

  const ratingRadios = page
    .getByRole("radiogroup", { name: "Choose rating from 1 to 5 stars" })
    .getByRole("radio");

  await ratingRadios.first().focus();
  await page.keyboard.press("Home");
  await expect(ratingRadios.first()).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("⭐ Terrible")).toBeVisible();

  await page.keyboard.press("End");
  await expect(ratingRadios.nth(4)).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("⭐ Excellent")).toBeVisible();
});

test("mobile sticky add-to-cart CTA is keyboard reachable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/product/1");

  const mobileStickyAddToCart = page
    .locator("div.fixed.inset-x-0.bottom-0")
    .getByRole("button", { name: "Add to Cart" });

  await expect(mobileStickyAddToCart).toBeVisible();
  await mobileStickyAddToCart.focus();
  await expect(mobileStickyAddToCart).toBeFocused();
  await page.keyboard.press("Enter");
});
