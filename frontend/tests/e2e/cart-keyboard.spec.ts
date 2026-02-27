import { expect, test } from "@playwright/test";

const LOCAL_CART_KEY = "nobonir_demo_cart";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const item = {
      id: 501,
      quantity: 2,
      isLocal: true,
      product: {
        id: 91,
        name: "Keyboard Cart Item",
        price: "499.00",
        image:
          "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&h=200&fit=crop",
        stock: 8,
      },
    };

    window.localStorage.setItem("nobonir_demo_cart", JSON.stringify([item]));
  });

  await page.route("**/cart/", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Unauthorized" }),
    });
  });
});

test("cart item controls are keyboard reachable and operable", async ({
  page,
}) => {
  await page.goto("/cart");

  await expect(
    page.getByRole("heading", { name: "Shopping Cart" }),
  ).toBeVisible();

  const decreaseButton = page.getByRole("button", {
    name: "Decrease quantity for Keyboard Cart Item",
  });
  await decreaseButton.focus();
  await expect(decreaseButton).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByText("Your cart is empty")).toBeHidden();

  const removeButton = page.getByRole("button", {
    name: "Remove Keyboard Cart Item from cart",
  });
  await removeButton.focus();
  await page.keyboard.press("Enter");

  await expect
    .poll(async () => {
      const raw = await page.evaluate(
        (key) => window.localStorage.getItem(key),
        LOCAL_CART_KEY,
      );
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.length : -1;
    })
    .toBe(0);
});

test("clear-all dialog and payment method semantics are keyboard accessible", async ({
  page,
}) => {
  await page.goto("/cart");

  await expect(
    page.getByRole("radiogroup", { name: "Payment method" }),
  ).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(2);

  const clearAll = page.getByRole("button", { name: "Clear All" });
  await clearAll.focus();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog", { name: "Clear all cart items?" });
  await expect(dialog).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await expect(
    page.getByRole("button", { name: "Login to Checkout" }),
  ).toBeDisabled();
});

test("guest coupon controls are disabled and skipped in keyboard flow", async ({
  page,
}) => {
  await page.goto("/cart");

  const couponInput = page.locator("#coupon-code");
  const couponApplyButton = page.getByRole("button", { name: "Apply" });

  await expect(couponInput).toBeDisabled();
  await expect(couponApplyButton).toBeDisabled();
});
