import { expect, test } from "@playwright/test";


test.describe("dashboard exclusive suggestions", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const authStore = {
        state: {
          accessToken: "test-access-token",
          refreshToken: "test-refresh-token",
          user: {
            id: 21,
            email: "dashqa@example.com",
            first_name: "Dash",
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
          id: 21,
          email: "dashqa@example.com",
          first_name: "Dash",
          last_name: "QA",
          role: "CUSTOMER",
        }),
      });
    });

    await page.route("**/products/?**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: 101,
              name: "Exclusive Shirt",
              slug: "exclusive-shirt",
              description: "Premium fabric",
              price: "1200.00",
              stock: 8,
              available_stock: 8,
              image_url: "https://example.com/a.jpg",
              category: { id: 1, name: "Fashion" },
            },
          ],
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
          preferred_categories: [1],
        }),
      });
    });

    await page.route("**/ai/recommendations/personalized/", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: 101,
            name: "Exclusive Shirt",
            slug: "exclusive-shirt",
            description: "Premium fabric",
            price: "1200.00",
            stock: 8,
            available_stock: 8,
            image_url: "https://example.com/a.jpg",
            category: { id: 1, name: "Fashion" },
          },
        ]),
      });
    });

    await page.route("**/products/101/", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 101,
          name: "Exclusive Shirt",
          slug: "exclusive-shirt",
          description: "Premium fabric",
          price: "1200.00",
          stock: 8,
          available_stock: 8,
          image_url: "https://example.com/a.jpg",
          media: [],
          variants: [],
          category: { id: 1, name: "Fashion" },
        }),
      });
    });

    await page.route("**/reviews/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ results: [] }),
      });
    });

    await page.route("**/cart/", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
        return;
      }
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ detail: "ok" }),
      });
    });

    await page.route("**/cart/items/", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ detail: "added" }),
      });
    });
  });

  test("view product button opens product page", async ({ page }) => {
    await page.goto("/");

    const suggestionSection = page.locator("section", {
      hasText: "Exclusive Suggestions for You",
    });
    await expect(suggestionSection).toBeVisible();

    await suggestionSection
      .getByRole("button", { name: "View Product" })
      .first()
      .click();
    await expect(page).toHaveURL(/\/product\/101$/);
    await expect(
      page.getByRole("heading", { name: "Exclusive Shirt", level: 1 }),
    ).toBeVisible();
  });

  test("clicking the suggestion card opens product page", async ({ page }) => {
    await page.goto("/");

    await page
      .getByRole("button", { name: "View product Exclusive Shirt" })
      .click();

    await expect(page).toHaveURL(/\/product\/101$/);
  });

  test("add to cart action does not navigate away", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Add to Cart" }).first().click();
    await expect(page).toHaveURL(/\/$/);
  });
});