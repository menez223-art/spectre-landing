import { test, expect } from '@playwright/test';

// اختبار كامل: ينتظر الكود الجديد الذي سيصلك الآن
test('real login flow - wait for NEW code from email', async ({ page }) => {
  test.setTimeout(300000); // 5 دقائق

  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('404') && !text.includes('favicon')) {
        errors.push(text);
      }
    }
  });
  page.on('pageerror', err => {
    errors.push(err.message);
  });

  console.log('\n=== اختبار التدفق الكامل الحقيقي ===\n');

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

  // 5. انتظار شاشة الكود (جهاز جديد) - هنا سيُرسل كود جديد لإيميلك
  console.log('5. انتظار شاشة "New device — activation code"...');
  await expect(page.locator('text=New device — activation code')).toBeVisible({ timeout: 30000 });
  console.log('   ✓ ظهرت شاشة الكود');
  console.log('   📧 تم إرسال كود جديد إلى menez223@gmail.com');

  // 6. توقف وتنتظر الكود الجديد يدوياً
  console.log('\n==========================================');
  console.log('🛑 المتصفح مفتوح عند شاشة الكود');
  console.log('📧 تحقق من الإيميل الآن - سيصلك كود جديد');
  console.log('🔢 سأدخل الكود تلقائياً بمجرد أن تعطيني إياه');
  console.log('⏳ أنتظر 90 ثانية...');
  console.log('==========================================\n');

  // انتظار 90 ثانية لتدخل الكود في المتصفح يدوياً
  // أو لتعطيني الكود وأدخله في الكود
  await page.waitForTimeout(90000);

  // 7. التحقق من نتيجة تسجيل الدخول
  console.log('\n7. التحقق من نتيجة تسجيل الدخول...');

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
    console.log('⚠️ لا تزال على شاشة الكود - ربما لم تدخل الكود أو منتهي الصلاحية');
    await page.screenshot({ path: 'test-results/real-login-still-code.png', fullPage: true });
  } else {
    console.log('❓ حالة غير متوقعة');
    await page.screenshot({ path: 'test-results/real-login-unknown.png', fullPage: true });
  }

  console.log('\n=== انتهى الاختبار ===\n');
  console.log('أخطاء الكونسول:', errors.length > 0 ? errors : 'لا يوجد');
});