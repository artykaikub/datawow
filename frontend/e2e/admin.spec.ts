import { test, expect } from '@playwright/test';
import { loginViaAPI, API_BASE } from './helpers';

test.describe('Admin — Concert Management', () => {
  const adminEmail = 'admin@datawow.com';
  const adminPassword = 'Admin123!';
  let adminToken: string;
  let hasAdmin = false;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();

    // Try to login as admin
    const res = await page.request.post(`${API_BASE}/auth/login`, {
      data: { email: adminEmail, password: adminPassword },
      failOnStatusCode: false,
    });

    if (res.ok()) {
      adminToken = (await res.json()).accessToken;
      hasAdmin = true;
    }

    await page.close();
  });

  test('should redirect non-admin users away from /admin', async ({ page }) => {
    // Register a normal user
    const email = `pw-nonadmin-${Date.now()}@test.com`;
    await page.request.post(`${API_BASE}/auth/register`, {
      data: { email, password: 'TestPass123', fullName: 'Normal User' },
    });

    await loginViaAPI(page, email, 'TestPass123');
    await page.goto('/admin');

    // Should redirect to /user (role guard)
    await page.waitForURL('**/user', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/user/);
  });

  test('should display admin dashboard with stats', async ({ page }) => {
    test.skip(!hasAdmin, 'Requires admin account');

    await loginViaAPI(page, adminEmail, adminPassword);
    await page.goto('/admin');

    // Stats overview should be visible
    await expect(page.getByText(/Total Seats|Concerts/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('should create a new concert', async ({ page }) => {
    test.skip(!hasAdmin, 'Requires admin account');

    await loginViaAPI(page, adminEmail, adminPassword);
    await page.goto('/admin');

    // Wait for page to load
    await expect(page.getByText(/Concerts/i).first()).toBeVisible({ timeout: 15_000 });

    // Click create tab or find the form
    const createTab = page.getByRole('tab', { name: /Create/i });
    if (await createTab.isVisible()) {
      await createTab.click();
    }

    const newConcertName = `PW Admin Concert ${Date.now()}`;

    // Fill form
    await page.getByLabel(/Concert name/i).fill(newConcertName);
    await page.getByLabel(/Description/i).fill('Created by Playwright E2E admin test');
    await page.getByLabel(/Total seats/i).fill('250');
    await page.getByRole('button', { name: /Create|Add/i }).click();

    // Concert should appear in list
    await expect(page.getByText(newConcertName)).toBeVisible({ timeout: 15_000 });
  });

  test('should enforce max 100000 seats in create form', async ({ page }) => {
    test.skip(!hasAdmin, 'Requires admin account');

    await loginViaAPI(page, adminEmail, adminPassword);
    await page.goto('/admin');

    await expect(page.getByText(/Concerts/i).first()).toBeVisible({ timeout: 15_000 });

    const createTab = page.getByRole('tab', { name: /Create/i });
    if (await createTab.isVisible()) {
      await createTab.click();
    }

    // Check that the totalSeats input has max attribute
    const seatsInput = page.getByLabel(/Total seats/i);
    await expect(seatsInput).toHaveAttribute('max', '100000');
  });

  test('should delete a concert with confirmation dialog', async ({ page }) => {
    test.skip(!hasAdmin, 'Requires admin account');

    // First create a concert to delete
    const concertName = `PW Delete Test ${Date.now()}`;
    await page.request.post(`${API_BASE}/concerts`, {
      data: {
        name: concertName,
        description: 'Will be deleted',
        totalSeats: 50,
      },
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    await loginViaAPI(page, adminEmail, adminPassword);
    await page.goto('/admin');

    // Wait for the concert to appear
    await expect(page.getByText(concertName)).toBeVisible({ timeout: 15_000 });

    // Click delete button on the concert card
    const concertCard = page.locator('[class*="rounded"]').filter({ hasText: concertName });
    const deleteBtn = concertCard.getByRole('button', { name: /delete/i });
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();

      // Confirmation dialog should appear
      await expect(page.getByText('Delete Concert?')).toBeVisible();
      await expect(page.getByText(concertName)).toBeVisible();

      // Click confirm delete
      await page.getByRole('button', { name: /Yes, Delete/i }).click();

      // Concert should be removed from list
      await expect(page.getByText(concertName)).not.toBeVisible({ timeout: 10_000 });
    }
  });

  test('should navigate to history page', async ({ page }) => {
    test.skip(!hasAdmin, 'Requires admin account');

    await loginViaAPI(page, adminEmail, adminPassword);
    await page.goto('/admin/history');

    // Should show history heading or table
    await expect(page.getByText(/History|Reservation/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('should display reservation history table', async ({ page }) => {
    test.skip(!hasAdmin, 'Requires admin account');

    await loginViaAPI(page, adminEmail, adminPassword);
    await page.goto('/admin/history');

    // Wait for the table or data to load
    const table = page.locator('table');
    const noData = page.getByText(/No reservations|No data/i);

    await expect(table.or(noData)).toBeVisible({ timeout: 15_000 });
  });
});
