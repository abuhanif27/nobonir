import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const authStore = {
      state: {
        accessToken: "checkout-test-access",
        refreshToken: "checkout-test-refresh",
        user: {
          id: 77,
          email: "checkoutqa@example.com",
          first_name: "Checkout",
          last_name: "QA",
          role: "CUSTOMER",
        },
      },
      version: 0,
    };

    const localCartItems = [
      {
        id: 7001,
        quantity: 2,
        isLocal: true,
        product: {
          id: 501,
          name: "Checkout Keyboard Item",
          price: "749.00",
          image:
            "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&h=200&fit=crop",
          stock: 10,
        },
      },
    ];

    window.localStorage.setItem("auth-storage", JSON.stringify(authStore));
    window.localStorage.setItem(
      "nobonir_demo_cart",
      JSON.stringify(localCartItems),
    );
  });

  await page.route("**/accounts/me/", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: 77,
        email: "checkoutqa@example.com",
        first_name: "Checkout",
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

  await page.route("**/cart/items/", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route("**/orders/checkout/", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ id: 909 }),
    });
  });

  await page.route("**/payments/cod/confirm/", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "confirmed" }),
    });
  });
});

test("checkout form is keyboard operable and COD submit flow works", async ({
  page,
}) => {
  await page.goto("/cart");

  const shippingAddress = page.locator("#shipping-address");
  await shippingAddress.focus();
  await expect(shippingAddress).toBeFocused();
  await page.keyboard.type("221B Baker Street, Dhaka");

  const sameAsShipping = page.locator("#same-as-shipping");
  await sameAsShipping.focus();
  await expect(sameAsShipping).toBeChecked();
  await page.keyboard.press("Space");
  await expect(sameAsShipping).not.toBeChecked();

  const billingAddress = page.locator("#billing-address");
  await expect(billingAddress).toBeEnabled();
  await billingAddress.focus();
  await page.keyboard.type("10 Downing Street, Dhaka");

  const codRadio = page.getByRole("radio", { name: /Cash on Delivery/i });
  await codRadio.focus();
  await page.keyboard.press("Enter");
  await expect(codRadio).toHaveAttribute("aria-checked", "true");

  const submitButton = page.getByRole("button", { name: "Place COD Order" });
  await submitButton.focus();
  await expect(submitButton).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/orders(?:\?.*)?$/);
  await expect
    .poll(async () =>
      page.evaluate(() => sessionStorage.getItem("nobonir_flash_notice")),
    )
    .toContain("Cash on Delivery");
});

test("checkout keyboard submit shows validation error when shipping is empty", async ({
  page,
}) => {
  let checkoutCalls = 0;

  await page.unroute("**/orders/checkout/");
  await page.route("**/orders/checkout/", async (route) => {
    checkoutCalls += 1;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ id: 910 }),
    });
  });

  await page.goto("/cart");

  const submitButton = page.getByRole("button", { name: "Pay Securely" });
  await submitButton.focus();
  await expect(submitButton).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(
    page.getByText("Please enter your shipping address.", { exact: true }),
  ).toBeVisible();
  await expect.poll(() => checkoutCalls).toBe(0);
});

test("checkout keyboard submit shows validation error when billing is empty", async ({
  page,
}) => {
  let checkoutCalls = 0;

  await page.unroute("**/orders/checkout/");
  await page.route("**/orders/checkout/", async (route) => {
    checkoutCalls += 1;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ id: 911 }),
    });
  });

  await page.goto("/cart");

  const shippingAddress = page.locator("#shipping-address");
  await shippingAddress.focus();
  await page.keyboard.type("221B Baker Street, Dhaka");

  const sameAsShipping = page.locator("#same-as-shipping");
  await sameAsShipping.focus();
  await expect(sameAsShipping).toBeChecked();
  await page.keyboard.press("Space");
  await expect(sameAsShipping).not.toBeChecked();

  const billingAddress = page.locator("#billing-address");
  await expect(billingAddress).toBeEnabled();
  await billingAddress.focus();
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await expect(billingAddress).toHaveValue("");

  const submitButton = page.getByRole("button", { name: "Pay Securely" });
  await submitButton.focus();
  await page.keyboard.press("Enter");

  await expect(
    page.getByText("Please enter your billing address.", { exact: true }),
  ).toBeVisible();
  await expect.poll(() => checkoutCalls).toBe(0);
});

test("authenticated coupon apply flow is keyboard reachable and shows validation feedback", async ({
  page,
}) => {
  let couponValidateCalls = 0;

  await page.route("**/orders/coupon/validate/", async (route) => {
    couponValidateCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        code: "NOBONIR",
        discount_percent: 10,
        subtotal: "1498.00",
        discount: "149.80",
        total: "1348.20",
        expires_at: "2026-12-31T23:59:59Z",
      }),
    });
  });

  await page.goto("/cart");

  const couponInput = page.locator("#coupon-code");
  await couponInput.focus();
  await expect(couponInput).toBeFocused();
  await page.keyboard.type(" ");

  await page.keyboard.press("Tab");
  const couponApplyButton = page.getByRole("button", { name: "Apply" });
  await expect(couponApplyButton).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(
    page.getByText("Please enter a coupon code.", { exact: true }),
  ).toBeVisible();
  await expect.poll(() => couponValidateCalls).toBe(0);
});

test("authenticated coupon apply success updates order summary via keyboard", async ({
  page,
}) => {
  let couponValidateCalls = 0;

  await page.unroute("**/cart/");
  await page.route("**/cart/", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: 7001,
          quantity: 2,
          product: {
            id: 501,
            name: "Checkout Keyboard Item",
            price: "749.00",
            image:
              "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&h=200&fit=crop",
            stock: 10,
          },
        },
      ]),
    });
  });

  await page.route("**/orders/coupon/validate/", async (route) => {
    couponValidateCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        code: "NOBONIR",
        discount_percent: 10,
        subtotal: "1498.00",
        discount: "149.80",
        total: "1348.20",
        expires_at: "2026-12-31T23:59:59Z",
      }),
    });
  });

  await page.goto("/cart");

  const couponInput = page.locator("#coupon-code");
  await couponInput.focus();
  await page.keyboard.type("nobonir");

  await page.keyboard.press("Tab");
  const couponApplyButton = page.getByRole("button", { name: "Apply" });
  await expect(couponApplyButton).toBeFocused();
  await page.keyboard.press("Enter");

  await expect.poll(() => couponValidateCalls).toBe(1);
  await expect(page.getByText(/Coupon\s*\(NOBONIR\)/i)).toBeVisible();
  await expect(
    page.getByText("Coupon NOBONIR applied successfully.", { exact: true }),
  ).toBeVisible();
});
