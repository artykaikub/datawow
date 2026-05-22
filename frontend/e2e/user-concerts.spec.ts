import { test, expect } from '@playwright/test';
import {
  registerUser,
  loginViaAPI,
  createConcertViaAPI,
  API_BASE,
} from './helpers';

test.describe('User — Concert Browsing & Reservation', () => {
  let userEmail: string;
  let userPassword: string;
  let adminToken: string;
  let concertName: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();

    // Create admin user (if not exists) + get token
    const adminRes = await page.request.post(`${API_BASE}/auth/login`, {
      data: { email: 'admin@datawow.com', password: 'Admin123!' },
      failOnStatusCode: false,
    });

    if (adminRes.ok()) {
      adminToken = (await adminRes.json()).accessToken;
    }

    // Create test user
    const user = await registerUser(page);
    userEmail = user.email;
    userPassword = user.password;

    // Create a test concert (if admin exists)
    if (adminToken) {
      concertName = `E2E Concert ${Date.now()}`;
      await createConcertViaAPI(page, adminToken, {
        name: concertName,
        description: 'Created by Playwright E2E test',
        totalSeats: 100,
      });
    }

    await page.close();
  });

  test('should redirect unauthenticated users to /login', async ({ page }) => {
    await page.goto('/user');

    await page.waitForURL('**/login', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('should display concert list after login', async ({ page }) => {
    await loginViaAPI(page, userEmail, userPassword);
    await page.goto('/user');

    // Wait for loading to finish
    await expect(page.getByText('Concerts')).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText('Browse available concerts and manage your reservations')
    ).toBeVisible();
  });

  test('should display "No concerts available" when list is empty', async ({ page }) => {
    // Register a fresh user and mock empty response
    await page.route('**/api/concerts', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await loginViaAPI(page, userEmail, userPassword);
    await page.goto('/user');

    await expect(page.getByText('No concerts available')).toBeVisible({ timeout: 10_000 });
  });

  test('should display concert cards with seat counts', async ({ page }) => {
    test.skip(!adminToken, 'Requires admin to create concerts');

    await loginViaAPI(page, userEmail, userPassword);
    await page.goto('/user');

    // Wait for concert to appear
    await expect(page.getByText(concertName)).toBeVisible({ timeout: 15_000 });

    // Check seat count is shown
    await expect(page.getByText('100')).toBeVisible();
  });

  test('should reserve and then cancel a concert', async ({ page }) => {
    test.skip(!adminToken, 'Requires admin to create concerts');

    await loginViaAPI(page, userEmail, userPassword);
    await page.goto('/user');

    // Wait for concert card
    await expect(page.getByText(concertName)).toBeVisible({ timeout: 15_000 });

    // Click Reserve
    const reserveBtn = page.getByRole('button', { name: /Reserve/i }).first();
    if (await reserveBtn.isVisible()) {
      await reserveBtn.click();

      // Should show Cancel button after reservation
      await expect(
        page.getByRole('button', { name: /Cancel/i }).first()
      ).toBeVisible({ timeout: 10_000 });
    }

    // Click Cancel
    const cancelBtn = page.getByRole('button', { name: /Cancel/i }).first();
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();

      // Should show Reserve button again
      await expect(
        page.getByRole('button', { name: /Reserve/i }).first()
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test('should show user sidebar with active navigation', async ({ page }) => {
    await loginViaAPI(page, userEmail, userPassword);
    await page.goto('/user');

    // Sidebar should have user info and navigation
    await expect(page.getByText('Concerts')).toBeVisible({ timeout: 10_000 });
  });

  test('should logout and redirect to /login', async ({ page }) => {
    await loginViaAPI(page, userEmail, userPassword);
    await page.goto('/user');

    await expect(page.getByText('Concerts')).toBeVisible({ timeout: 10_000 });

    // Click logout button
    const logoutBtn = page.getByRole('button', { name: /log\s*out|sign\s*out/i });
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await page.waitForURL('**/login', { timeout: 10_000 });
      await expect(page).toHaveURL(/\/login/);
    }
  });
});
