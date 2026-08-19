#!/usr/bin/env node
/**
 * اختبار شامل لجميع خصائص مشروع SPECTRE
 * 2026-08-19
 */

const BASE_URL = 'http://localhost:3001';

const tests = {
  passed: 0,
  failed: 0,
  results: []
};

function log(emoji, message) {
  console.log(`${emoji} ${message}`);
}

function pass(testName) {
  tests.passed++;
  tests.results.push({ test: testName, status: 'PASS' });
  log('✅', testName);
}

function fail(testName, error) {
  tests.failed++;
  tests.results.push({ test: testName, status: 'FAIL', error });
  log('❌', `${testName} - ${error}`);
}

async function testPage(path, expectedStatus = 200) {
  try {
    const response = await fetch(`${BASE_URL}${path}`);
    if (response.status === expectedStatus) {
      pass(`صفحة ${path} ترجع ${expectedStatus}`);
      return response;
    } else {
      fail(`صفحة ${path}`, `توقعت ${expectedStatus} لكن حصلت على ${response.status}`);
      return null;
    }
  } catch (error) {
    fail(`صفحة ${path}`, error.message);
    return null;
  }
}

async function runTests() {
  log('🚀', 'بدء الاختبار الشامل لمشروع SPECTRE\n');

  // ════════════════════════════════════════════════════════════════
  // المرحلة 1: اختبار الصفحات الأساسية
  // ════════════════════════════════════════════════════════════════
  log('📄', '═══ المرحلة 1: اختبار الصفحات الأساسية ═══');

  const homeResponse = await testPage('/');
  if (homeResponse) {
    const html = await homeResponse.text();

    // فحص محتوى الصفحة الرئيسية
    if (html.includes('Your store, ready in seconds') || html.includes('متجرك جاهز في ثوانٍ')) {
      pass('عنوان البطل موجود في الصفحة الرئيسية');
    } else {
      fail('عنوان البطل', 'النص غير موجود في الصفحة الرئيسية');
    }

    // فحص صورة الاشتراكات
    if (html.includes('/FB.png')) {
      pass('صورة الاشتراكات FB.png موجودة');
    } else {
      fail('صورة الاشتراكات', 'FB.png غير موجودة');
    }

    // فحص قسم "كيف يعمل"
    if (html.includes('howTitle') || html.includes('كيف يعمل')) {
      pass('قسم "كيف يعمل" موجود');
    } else {
      fail('قسم "كيف يعمل"', 'القسم غير موجود');
    }
  }

  await testPage('/pricing');
  await testPage('/studio');
  await testPage('/admin', 307); // يُعيد توجيه لصفحة تسجيل الدخول

  // ════════════════════════════════════════════════════════════════
  // المرحلة 2: اختبار API Endpoints
  // ════════════════════════════════════════════════════════════════
  log('\n🔌', '═══ المرحلة 2: اختبار API Endpoints ═══');

  // اختبار endpoint تسجيل الدخول (بدون بيانات اعتماد)
  try {
    const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '', password: '', fingerprint: 'test' })
    });

    if (loginResponse.status === 400 || loginResponse.status === 401) {
      pass('API تسجيل الدخول يستجيب بشكل صحيح');
    } else {
      fail('API تسجيل الدخول', `حالة غير متوقعة: ${loginResponse.status}`);
    }
  } catch (error) {
    fail('API تسجيل الدخول', error.message);
  }

  // اختبار endpoint التحقق (بدون بيانات)
  try {
    const verifyResponse = await fetch(`${BASE_URL}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '', code: '', fingerprint: 'test' })
    });

    if (verifyResponse.status === 400 || verifyResponse.status === 401) {
      pass('API التحقق يستجيب بشكل صحيح');
    } else {
      fail('API التحقق', `حالة غير متوقعة: ${verifyResponse.status}`);
    }
  } catch (error) {
    fail('API التحقق', error.message);
  }

  // ════════════════════════════════════════════════════════════════
  // المرحلة 3: فحص الملفات الثابتة
  // ════════════════════════════════════════════════════════════════
  log('\n📦', '═══ المرحلة 3: فحص الملفات الثابتة ═══');

  await testPage('/FB.png');
  await testPage('/favicon.ico');

  // ════════════════════════════════════════════════════════════════
  // النتيجة النهائية
  // ════════════════════════════════════════════════════════════════
  log('\n📊', '═══ النتيجة النهائية ═══');
  log('✅', `الاختبارات الناجحة: ${tests.passed}`);
  if (tests.failed > 0) {
    log('❌', `الاختبارات الفاشلة: ${tests.failed}`);
  }

  const totalTests = tests.passed + tests.failed;
  const successRate = ((tests.passed / totalTests) * 100).toFixed(1);
  log('📈', `نسبة النجاح: ${successRate}%`);

  if (tests.failed === 0) {
    log('\n🎉', '═══ جميع الاختبارات نجحت! جاهز للنشر ═══\n');
    process.exit(0);
  } else {
    log('\n⚠️', '═══ بعض الاختبارات فشلت - يُرجى المراجعة ═══\n');
    process.exit(1);
  }
}

// تشغيل الاختبارات
runTests().catch(error => {
  log('💥', `خطأ فادح: ${error.message}`);
  process.exit(1);
});
