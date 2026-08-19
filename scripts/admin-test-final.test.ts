// اختبار نهائي لصفحة الأدمن - يتحقق من وجود أخطاء في الكونسول
import { test, expect } from '@playwright/test';

test.describe('Admin Page - Client Side Test', () => {
  test.setTimeout(60000); // 60s for first-load compilation
  test('admin page loads without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    page.on('pageerror', err => {
      errors.push(err.message);
    });

    // Login first via API
    await page.request.post('http://localhost:3000/api/admin/login', {
      data: { email: 'menez223@gmail.com', password: 'Aline' },
      headers: { 'Content-Type': 'application/json' }
    });

    // Navigate to admin page
    await page.goto('http://localhost:3000/admin', { waitUntil: 'domcontentloaded' });

    // Wait for page to be interactive
    await expect(page.locator('text=إدارة الاشتراكات')).toBeVisible({ timeout: 30000 });

    // Check if admin panel is visible
    const adminPanel = page.locator('text=ملخص الاشتراكات');
    await expect(adminPanel).toBeVisible();

    // Check for any console errors
    console.log('Console errors found:', errors);
    expect(errors).toHaveLength(0);
  });

  test('admin page elements are interactive', async ({ page }) => {
    const errors: string[] = [];
    await page.request.post('http://localhost:3000/api/admin/login', {
      data: { email: 'menez223@gmail.com', password: 'Aline' },
      headers: { 'Content-Type': 'application/json' }
    });

    await page.goto('http://localhost:3000/admin', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=إدارة الاشتراكات')).toBeVisible({ timeout: 30000 });

    // Verify key UI elements exist
    await expect(page.locator('text=ملخص الاشتراكات')).toBeVisible();
    await expect(page.locator('text=المستخدمون')).toBeVisible();
    await expect(page.locator('text=قائمة المحظورين')).toBeVisible();
    await expect(page.locator('text=رصد صحة الروابط')).toBeVisible();
    await expect(page.locator('text=الاحتياط وإنذار السعة')).toBeVisible();

    // Check tabs
    await expect(page.getByRole('tab', { name: 'الكل' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'أساسي' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'متقدم' })).toBeVisible();

    // Check logout button
    await expect(page.locator('button:has-text("تسجيل الخروج")')).toBeVisible();
  });
});