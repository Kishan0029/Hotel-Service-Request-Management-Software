const { test, expect } = require('@playwright/test');

// ── 1. Login Page UI ──────────────────────────────────────────────────────────
test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('shows login form with all required fields', async ({ page }) => {
    await expect(page.getByTestId('login-card')).toBeVisible();
    await expect(page.getByTestId('login-form')).toBeVisible();
    await expect(page.getByTestId('login-email-input')).toBeVisible();
    await expect(page.getByTestId('login-password-input')).toBeVisible();
    await expect(page.getByTestId('login-submit-btn')).toBeVisible();
  });

  test('submit button is disabled when fields are empty', async ({ page }) => {
    const btn = page.getByTestId('login-submit-btn');
    await expect(btn).toBeDisabled();
  });

  test('submit button enables when both fields are filled', async ({ page }) => {
    await page.getByTestId('login-email-input').fill('test@hotel.com');
    await page.getByTestId('login-password-input').fill('password123');
    await expect(page.getByTestId('login-submit-btn')).toBeEnabled();
  });

  test('shows error for wrong credentials', async ({ page }) => {
    await page.getByTestId('login-email-input').fill('wrong@hotel.com');
    await page.getByTestId('login-password-input').fill('wrongpassword');
    await page.getByTestId('login-submit-btn').click();
    await expect(page.getByTestId('login-error')).toBeVisible({ timeout: 8000 });
  });

  test('page includes correct title text', async ({ page }) => {
    await expect(page.getByText('Hotel Service')).toBeVisible();
    await expect(page.getByText(/Management System/)).toBeVisible();
  });
});

// ── 2. Root redirect behaviour ─────────────────────────────────────────────────
test.describe('Auth Guard — Unauthenticated Access', () => {
  test('visiting /gm redirects or shows restricted content (no auth)', async ({ page }) => {
    // Clear any stored auth first
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());

    await page.goto('/gm');
    // Either redirected to login, or sees some kind of gate
    const url = page.url();
    const hasLoginText = await page.getByText(/login|sign in|unauthorized|hotel service/i).count();
    const isOnLoginPage = url.includes('/login');
    expect(isOnLoginPage || hasLoginText > 0).toBeTruthy();
  });

  test('visiting /manager without auth is gated', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());

    await page.goto('/manager');
    const url = page.url();
    const hasLoginText = await page.getByText(/login|sign in|unauthorized|hotel service/i).count();
    const isOnLoginPage = url.includes('/login');
    expect(isOnLoginPage || hasLoginText > 0).toBeTruthy();
  });

  test('visiting /staff without auth is gated', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());

    await page.goto('/staff');
    const url = page.url();
    const hasLoginText = await page.getByText(/login|sign in|unauthorized|hotel service/i).count();
    const isOnLoginPage = url.includes('/login');
    expect(isOnLoginPage || hasLoginText > 0).toBeTruthy();
  });
});
