import { test, expect } from '@playwright/test';
import { uniqueEmail, loginViaUI } from './helpers';

test.describe('Auth — Registration', () => {
  test('should show validation errors on empty submit', async ({ page }) => {
    await page.goto('/register');

    await page.getByRole('button', { name: 'Create an account' }).click();

    await expect(page.getByText('Full name is required')).toBeVisible();
    await expect(page.getByText('Email is required')).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
  });

  test('should show password validation errors', async ({ page }) => {
    await page.goto('/register');

    await page.getByLabel('Full name').fill('Test User');
    await page.locator('#email').fill('test@example.com');
    await page.locator('#password').fill('short');
    await page.locator('#confirmPassword').fill('short');
    await page.getByRole('button', { name: 'Create an account' }).click();

    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();
  });

  test('should show mismatch error for different passwords', async ({ page }) => {
    await page.goto('/register');

    await page.getByLabel('Full name').fill('Test User');
    await page.locator('#email').fill('test@example.com');
    await page.locator('#password').fill('TestPass123');
    await page.locator('#confirmPassword').fill('Different123');
    await page.getByRole('button', { name: 'Create an account' }).click();

    await expect(page.getByText('Passwords do not match')).toBeVisible();
  });

  test('should register successfully and redirect to /user', async ({ page }) => {
    const email = uniqueEmail();

    await page.goto('/register');
    await page.getByLabel('Full name').fill('Playwright User');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill('TestPass123');
    await page.locator('#confirmPassword').fill('TestPass123');
    await page.getByRole('button', { name: 'Create an account' }).click();

    await page.waitForURL('**/user', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/user/);
  });

  test('should show error when registering with existing email', async ({ page }) => {
    const email = uniqueEmail();

    // Register first time
    await page.goto('/register');
    await page.getByLabel('Full name').fill('User 1');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill('TestPass123');
    await page.locator('#confirmPassword').fill('TestPass123');
    await page.getByRole('button', { name: 'Create an account' }).click();
    await page.waitForURL('**/user', { timeout: 10_000 });

    // Clear auth and register again with same email
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('/register');
    await page.getByLabel('Full name').fill('User 2');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill('TestPass123');
    await page.locator('#confirmPassword').fill('TestPass123');
    await page.getByRole('button', { name: 'Create an account' }).click();

    // Should show error
    await expect(page.getByText(/already exists|Registration failed/i)).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe('Auth — Login', () => {
  let testEmail: string;
  const testPassword = 'TestPass123';

  test.beforeAll(async ({ browser }) => {
    // Create a test user via API
    const page = await browser.newPage();
    testEmail = uniqueEmail();

    await page.request.post('http://localhost:4000/api/auth/register', {
      data: {
        email: testEmail,
        password: testPassword,
        fullName: 'Login Test User',
      },
    });
    await page.close();
  });

  test('should show validation errors on empty submit', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page.getByText('Email is required')).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
  });

  test('should show invalid email error', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('invalid-email');
    await page.getByLabel('Password').fill('anypass');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page.getByText('Please enter a valid email')).toBeVisible();
  });

  test('should show error on wrong credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill('WrongPassword123');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page.getByText(/Invalid|Unauthorized|email or password/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test('should login successfully and redirect to /user', async ({ page }) => {
    await loginViaUI(page, testEmail, testPassword);

    await page.waitForURL('**/user', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/user/);
  });

  test('should toggle password visibility', async ({ page }) => {
    await page.goto('/login');

    const passwordInput = page.locator('#password');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    await page.getByLabel('Show password').click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    await page.getByLabel('Hide password').click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('should navigate between login and register', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Create an account' }).click();
    await expect(page).toHaveURL(/\/register/);

    await page.getByRole('link', { name: 'Login' }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
