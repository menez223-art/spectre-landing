import { test, expect } from '@playwright/test';

// هذا الاختبار للتشغيل اليدوي - سيظهر المتصفح وتتوقف عند شاشة الكود
test('real login flow with actual 6-digit code from email', async ({ page }) => {
  test.setTimeout(300000); // 5 دقائق للسماح بالاختبار اليدوي

  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    errors.push(err.message);
  });

  console.log('\n=== بدء اختبار تسجيل الدخول الحقيقي ===\n');

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
  console.log('   ✓ ظهرت شاشة الكود - تم إرسال الكود إلى إيميل الأدمن');

  // 6. توقف هنا - أنت تدخل الكود يدوياً
  console.log('\n==========================================');
  console.log('🛑 المتصفح مفتوح الآن عند شاشة إدخال الكود');
  console.log('📧 تحقق من إيميل الأدمن (menez223@gmail.com)');
  console.log('🔢 أدخل الكود يدوياً في المتصفح');
  console.log('⏳ سأنتظر 60 ثانية...');
  console.log('==========================================\n');

  // انتظار 60 ثانية لتدخل الكود
  await page.waitForTimeout(60000);

  // 7. التحقق هل تم تسجيل الدخول
  console.log('\n7. التحقق من نتيجة تسجيل الدخول...');

  // البحث عن مؤشرات النجاح - إما اختفت شاشة الكود أو ظهرت واجهة الاستوديو
  const stillOnCodeScreen = await page.locator('text=New device — activation code').isVisible().catch(() => false);
  const studioUI = await page.locator('text=استوديو صفحات الهبوط').isVisible().catch(() => false);
  const productForm = await page.locator('input[placeholder*="منتج"]').isVisible().catch(() => false);

  if (!stillOnCodeScreen && (studioUI || productForm)) {
    console.log('✅ نجح تسجيل الدخول! واجهة الاستوديو ظهرت');
  } else if (await page.locator('text=Incorrect code').isVisible().catch(() => false)) {
    console.log('❌ كود خاطئ - ظهرت رسالة "Incorrect code"');
  } else if (stillOnCodeScreen) {
    console.log('⚠️ لا تزال على شاشة الكود - ربما لم تدخل الكود أو الكود منتهي الصلاحية');
  } else {
    console.log('❓ حالة غير متوقعة - تحقق من المتصفح يدوياً');
  }

  // لقطة شاشة للتوثيق
  await page.screenshot({ path: 'test-results/real-login-result.png', fullPage: true });
  console.log('📸 تم حفظ لقطة شاشة: test-results/real-login-result.png');

  console.log('\n=== انتهى الاختبار ===\n');
  console.log('أخطاء الكونسول:', errors.length > 0 ? errors : 'لا يوجد');
});