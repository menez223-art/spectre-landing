// اختبار تسجيل الدخول لصفحة الاستوديو من جهاز جديد
import { test, expect } from '@playwright/test';

test.describe('Studio Page - Login Flow', () => {
  test.setTimeout(60000); // 60s for first-load compilation
  test('studio page loads and shows login screen for new device', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    page.on('pageerror', err => {
      errors.push(err.message);
    });

    // Navigate to studio page (new device - no session)
    await page.goto('http://localhost:3000/studio', { waitUntil: 'domcontentloaded' });

    // Wait for login screen to appear (English is default locale)
    // Use expect().toBeVisible() which waits for client-side hydration
    await expect(page.locator('text=Sign in to continue')).toBeVisible({ timeout: 30000 });

    // Check login screen elements (English locale)
    await expect(page.locator('text=Sign in to continue')).toBeVisible();
    await expect(page.locator('input[placeholder="Username"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Password"]')).toBeVisible();
    await expect(page.locator('button:has-text("Sign in")')).toBeVisible();

    // Fill credentials
    await page.fill('input[placeholder="Username"]', 'project');
    await page.fill('input[placeholder="Password"]', 'SPECTRE');

    // Click login
    await page.click('button:has-text("Sign in")');

    // Wait for code screen to appear (new device needs code)
    await page.waitForSelector('text=New device', { timeout: 10000 });

    // Check code input - the text "activation code" appears in two places, be specific
    await expect(page.locator('input[placeholder="000000"]')).toBeVisible();
    await expect(page.locator('button:has-text("Activate device")')).toBeVisible();
    await expect(page.locator('text=New device — activation code')).toBeVisible();

    console.log('Console errors found:', errors);
    expect(errors).toHaveLength(0);
  });

  test('studio page login flow - enter wrong code shows error', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore expected 401 for wrong code - this is normal API behavior
        if (!text.includes('401') && !text.includes('Unauthorized')) {
          errors.push(text);
        }
      }
    });
    page.on('pageerror', err => {
      errors.push(err.message);
    });

    // Navigate to studio page (new device - no session)
    await page.goto('http://localhost:3000/studio', { waitUntil: 'domcontentloaded' });

    // Wait for login screen to appear (English is default locale)
    await expect(page.locator('text=Sign in to continue')).toBeVisible({ timeout: 30000 });

    // Fill credentials
    await page.fill('input[placeholder="Username"]', 'project');
    await page.fill('input[placeholder="Password"]', 'SPECTRE');

    // Click login
    await page.click('button:has-text("Sign in")');

    // Wait for code screen to appear (new device needs code)
    await page.waitForSelector('text=New device', { timeout: 10000 });

    // Enter wrong code
    await page.fill('input[placeholder="000000"]', '123456');
    await page.click('button:has-text("Activate device")');

    // Wait for error message
    await page.waitForSelector('text=Incorrect code', { timeout: 5000 });

    // Verify error is shown
    await expect(page.locator('text=Incorrect code')).toBeVisible();

    console.log('Console errors found:', errors);
    expect(errors).toHaveLength(0);
  });

  test('studio page login flow - back to login button works', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    page.on('pageerror', err => {
      errors.push(err.message);
    });

    // Navigate to studio page (new device - no session)
    await page.goto('http://localhost:3000/studio', { waitUntil: 'domcontentloaded' });

    // Wait for login screen to appear (English is default locale)
    await expect(page.locator('text=Sign in to continue')).toBeVisible({ timeout: 30000 });

    // Fill credentials
    await page.fill('input[placeholder="Username"]', 'project');
    await page.fill('input[placeholder="Password"]', 'SPECTRE');

    // Click login
    await page.click('button:has-text("Sign in")');

    // Wait for code screen to appear
    await page.waitForSelector('text=New device', { timeout: 10000 });

    // Click back to login
    await page.click('button:has-text("Back to sign in")');

    // Should be back at credentials screen
    await page.waitForSelector('text=Sign in to continue', { timeout: 5000 });
    await expect(page.locator('text=Sign in to continue')).toBeVisible();
    await expect(page.locator('input[placeholder="Username"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Password"]')).toBeVisible();

    console.log('Console errors found:', errors);
    expect(errors).toHaveLength(0);
  });

  // Note: Full successful login test requires a fresh verification code per device fingerprint.
  // The API flow was verified with curl (login → needs_code → verify with code → approved).
  // Each Playwright test runs in a fresh browser context with a unique fingerprint,
  // so the code from admin email is specific to that fingerprint and expires.
});