import { test, expect } from '@playwright/test';

// هذا الاختبار يدخل الكود 916080 تلقائياً بعد الوصول لشاشة الكود
test('real login flow - auto enter code 916080', async ({ page }) => {
  test.setTimeout(120000);

  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // تجاهل أخطاء 404 المتوقعة للصور
      if (!text.includes('404') && !text.includes('favicon')) {
        errors.push(text);
      }
    }
  });
  page.on('pageerror', err => {
    errors.push(err.message);
  });

  console.log('\n=== بدء اختبار تسجيل الدخول الحقيقي مع كود 916080 ===\n');

  // 1. الذهاب لصفحة الاستوديو
  console.log('1. الانتقال إلى /studio...');
  await page.goto('http://localhost:3000/studio', { waitUntil: 'domcontentloaded' });

  // 2. انتظار شاشة تسجيل الدخول
  console.log('2. انتظار شاشة "Sign in to continue"...');
  await expect(page.locator('text=Sign in to continue')).toBeVisible({ timeout: 30000 });
  console.log('   ✓ ظهرت شاشة تسجيل الدخول');

  // 3. ملء بيانات الاعتماد
  console.log('3. إدخال اسم المستخدم وكلمة المرور...');
  await page.fill('input[placeholder="Username"]', 'project');
  await page.fill('input[placeholder="Password"]', 'SPECTRE');

  // 4. النقر على تسجيل الدخول
  console.log('4. النقر على "Sign in"...');
  await page.click('button:has-text("Sign in")');

  // 5. انتظار شاشة الكود (جهاز جديد)
  console.log('5. انتظار شاشة "New device — activation code"...');
  await expect(page.locator('text=New device — activation code')).toBeVisible({ timeout: 30000 });
  console.log('   ✓ ظهرت شاشة الكود');

  // 6. إدخال الكود 916080 مباشرة
  console.log('6. إدخال الكود 916080...');
  await page.fill('input[placeholder="000000"]', '916080');
  await page.click('button:has-text("Activate device")');

  // 7. انتظار نتيجة التحقق - إما نجاح (تظهر واجهة الاستوديو) أو خطأ
  console.log('7. انتظار نتيجة التحقق...');
  await page.waitForTimeout(3000);

  // التحقق من النجاح
  const studioUI = await page.locator('text=استوديو صفحات الهبوط').isVisible().catch(() => false);
  const productForm = await page.locator('input[placeholder*="منتج"]').isVisible().catch(() => false);
  const errorMsg = await page.locator('text=Incorrect code').isVisible().catch(() => false);
  const stillCodeScreen = await page.locator('text=New device — activation code').isVisible().catch(() => false);

  if (studioUI || productForm) {
    console.log('✅ نجح تسجيل الدخول بالكامل! واجهة الاستوديو ظهرت');
    await page.screenshot({ path: 'test-results/real-login-success.png', fullPage: true });
  } else if (errorMsg) {
    console.log('❌ كود خاطئ - ظهرت رسالة "Incorrect code"');
    await page.screenshot({ path: 'test-results/real-login-wrong-code.png', fullPage: true });
  } else if (stillCodeScreen) {
    console.log('⚠️ لا تزال على شاشة الكود - ربما التحقق قيد المعالجة');
    await page.screenshot({ path: 'test-results/real-login-still-code.png', fullPage: true });
  } else {
    console.log('❓ حالة غير متوقعة');
    await page.screenshot({ path: 'test-results/real-login-unknown.png', fullPage: true });
  }

  console.log('\n=== انتهى الاختبار ===\n');
  console.log('أخطاء الكونسول:', errors.length > 0 ? errors : 'لا يوجد');
});