import { test, expect } from '@playwright/test';

test.describe('Landing Page & Navigation', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL('/');
    // Should have some content (title or hero)
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('should have correct page title', async ({ page }) => {
    await page.goto('/');

    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('should navigate to login page', async ({ page }) => {
    await page.goto('/');

    const loginLink = page.getByRole('link', { name: /login|sign in/i });
    if (await loginLink.isVisible()) {
      await loginLink.click();
      await expect(page).toHaveURL(/\/login/);
    } else {
      // Direct navigation
      await page.goto('/login');
      await expect(page).toHaveURL(/\/login/);
    }

    await expect(page.getByText('Login')).toBeVisible();
  });

  test('should navigate to register page', async ({ page }) => {
    await page.goto('/');

    const registerLink = page.getByRole('link', { name: /register|sign up|create/i });
    if (await registerLink.isVisible()) {
      await registerLink.click();
      await expect(page).toHaveURL(/\/register/);
    } else {
      await page.goto('/register');
      await expect(page).toHaveURL(/\/register/);
    }

    await expect(page.getByText('Sign Up')).toBeVisible();
  });

  test('should show 404 for unknown routes', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz');

    // Should show "not found" or similar
    await expect(
      page.getByText(/not found|404|page doesn't exist/i)
    ).toBeVisible({ timeout: 10_000 });
  });

  test('should have security headers', async ({ page }) => {
    const response = await page.goto('/');

    if (response) {
      const headers = response.headers();
      // Check security headers (set in next.config.ts)
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['x-frame-options']).toBe('DENY');
      expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    }
  });

  test('should be responsive (mobile viewport)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/login');

    // Login form should still be usable
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
  });
});
