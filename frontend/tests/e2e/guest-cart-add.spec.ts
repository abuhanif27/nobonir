import { test, expect } from '@playwright/test';

test.describe('Guest Cart Add to Cart', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem('nobonir_demo_cart');
    });
  });

  test('guest can add multiple products to cart without login', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173/');
    
    // Wait for products to load (API can take a few seconds in CI/dev)
    await expect
      .poll(async () => page.getByRole('button', { name: 'Add to Cart' }).count(), {
        timeout: 30000,
      })
      .toBeGreaterThan(0);
    
    // Add first product
    const firstAddBtn = page.locator('button:has-text("Add to Cart")').first();
    await firstAddBtn.click();
    
    // Cart nav button should show count 1
    const cartNav = page.getByRole('button', { name: /^Cart\s+\d+/ });
    await expect(cartNav).toContainText('1');
    
    // Navigate to cart
    await cartNav.click();
    await page.waitForURL('http://127.0.0.1:5173/cart', { timeout: 10000 });
    
    // Verify cart items section is visible
    await expect(page.getByRole('heading', { name: 'Shopping Cart' })).toBeVisible();
    await expect(page.getByText(/Cart Items \(\d+\)/)).toBeVisible();

    // Increase quantity from cart controls and verify guest cart updates to 2
    await page
      .getByRole('button', { name: /Increase quantity for/i })
      .first()
      .click();

    const firstCartItem = page.locator('div.rounded-lg.border.p-4').first();
    await expect(firstCartItem.locator('span.w-10').first()).toHaveText('2');
    
    // Verify cart has at least one item card rendered
    const cartItemCards = page.locator('div[class*="rounded-lg border p-4"]');
    const itemCount = await cartItemCards.count();
    expect(itemCount).toBeGreaterThanOrEqual(1);
  });

  test('guest can continue shopping without login', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173/');
    
    // Add one item
    await expect
      .poll(async () => page.getByRole('button', { name: 'Add to Cart' }).count(), {
        timeout: 30000,
      })
      .toBeGreaterThan(0);
    const addBtn = page.locator('button:has-text("Add to Cart")').first();
    await addBtn.click();

    const cartNav = page.getByRole('button', { name: /^Cart\s+\d+/ });
    await expect(cartNav).toContainText('1');
    
    // Go to cart
    await cartNav.click();
    await page.waitForURL('http://127.0.0.1:5173/cart', { timeout: 10000 });
    
    // Click Continue Shopping
    await page.getByRole('button', { name: 'Continue Shopping' }).click();
    
    // Should navigate back to home
    await page.waitForURL('http://127.0.0.1:5173/', { timeout: 10000 });
    
    // Verify cart still has the item
    await expect(cartNav).toContainText('1');
  });

  test('guest cannot checkout without login', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173/');
    
    // Add item
    await expect
      .poll(async () => page.getByRole('button', { name: 'Add to Cart' }).count(), {
        timeout: 30000,
      })
      .toBeGreaterThan(0);
    const addBtn = page.locator('button:has-text("Add to Cart")').first();
    await addBtn.click();

    const cartNav = page.getByRole('button', { name: /^Cart\s+\d+/ });
    await expect(cartNav).toContainText('1');
    
    // Go to cart
    await cartNav.click();
    await page.waitForURL('http://127.0.0.1:5173/cart', { timeout: 10000 });
    
    // Try to enter shipping address
    const shippingInput = page.locator('#shipping-address');
    await expect(shippingInput).toBeDisabled();
    
    // Verify checkout button requires login
    const checkoutBtn = page.getByRole('button', { name: 'Login to Checkout' });
    await expect(checkoutBtn).toBeDisabled();
    
    // Should show login message
    await expect(page.getByText(/browsing as a guest/i)).toBeVisible();
    await expect(page.getByRole('link', { name: 'login', exact: true })).toBeVisible();
  });
});
