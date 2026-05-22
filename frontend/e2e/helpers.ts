import { Page, expect } from '@playwright/test';

/** Backend API base URL */
export const API_BASE = process.env.API_BASE_URL || 'http://localhost:4000/api';

/** Generate a unique email for test isolation */
export function uniqueEmail(): string {
  return `pw-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.com`;
}

/** Register a new user via API and return credentials */
export async function registerUser(page: Page, opts?: { role?: string }) {
  const email = uniqueEmail();
  const password = 'TestPass123';
  const fullName = 'PW Test User';

  const res = await page.request.post(`${API_BASE}/auth/register`, {
    data: { email, password, fullName },
  });

  const body = await res.json();
  return {
    email,
    password,
    fullName,
    accessToken: body.accessToken as string,
    user: body.user as { id: string; email: string; role: string; fullName: string },
  };
}

/** Login via the UI form */
export async function loginViaUI(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
}

/** Login via API and inject token into localStorage */
export async function loginViaAPI(page: Page, email: string, password: string) {
  const res = await page.request.post(`${API_BASE}/auth/login`, {
    data: { email, password },
  });
  const body = await res.json();

  await page.goto('/');
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem('accessToken', token);
      localStorage.setItem('user', JSON.stringify(user));
    },
    { token: body.accessToken, user: body.user },
  );

  return body;
}

/** Create a concert via API (admin only) */
export async function createConcertViaAPI(
  page: Page,
  token: string,
  data: { name: string; description: string; totalSeats: number },
) {
  const res = await page.request.post(`${API_BASE}/concerts`, {
    data,
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

/** Wait for toast notification */
export async function expectToast(page: Page, text: string) {
  await expect(page.locator('[data-sonner-toast]').filter({ hasText: text })).toBeVisible({
    timeout: 10_000,
  });
}
