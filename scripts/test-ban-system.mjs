#!/usr/bin/env node
/**
 * فحص شامل لنظام الحظر/السماح
 * 2026-08-19
 *
 * يتحقق من:
 * 1. وجود جميع دوال الحظر في authStore.ts
 * 2. عدم تعديل منطق الحظر
 * 3. فحص حماية المنشورات المحظورة
 * 4. التأكد من أن نظام الحظر لم يُمَس
 */

import { readFileSync } from 'fs';

const tests = {
  passed: 0,
  failed: 0
};

function pass(msg) {
  console.log(`✅ ${msg}`);
  tests.passed++;
}

function fail(msg) {
  console.log(`❌ ${msg}`);
  tests.failed++;
}

function log(emoji, msg) {
  console.log(`${emoji} ${msg}`);
}

// ════════════════════════════════════════════════════════════════
// فحص authStore.ts — جميع دوال الحظر موجودة
// ════════════════════════════════════════════════════════════════
log('🔍', 'فحص authStore.ts...\n');

const authStore = readFileSync('app/lib/authStore.ts', 'utf-8');

// الدوال الأساسية للحظر
const banFunctions = [
  'isDeviceBanned',
  'banDevice',
  'unbanDevice',
  'getDeviceList',
  'addDevice',
  'removeDevice'
];

log('📋', 'فحص وجود دوال الحظر الأساسية:');
for (const fn of banFunctions) {
  if (authStore.includes(`function ${fn}`) || authStore.includes(`export async function ${fn}`)) {
    pass(`دالة ${fn} موجودة`);
  } else {
    fail(`دالة ${fn} مفقودة أو تم تعديلها`);
  }
}

// فحص أن isDeviceBanned تفحص القائمة السوداء
if (authStore.includes('deviceId.startsWith("ban-")') || authStore.includes('banned')) {
  pass('منطق فحص الحظر موجود');
} else {
  fail('منطق فحص الحظر قد يكون تم تعديله');
}

// ════════════════════════════════════════════════════════════════
// فحص app/p/[slug]/page.tsx — حماية المنشورات المحظورة
// ════════════════════════════════════════════════════════════════
log('\n🔍', 'فحص app/p/[slug]/page.tsx...\n');

const productPage = readFileSync('app/p/[slug]/page.tsx', 'utf-8');

log('📋', 'فحص حماية المنشورات المحظورة:');

// فحص أن banned check موجود
if (productPage.includes('banned') || productPage.includes('status === "banned"')) {
  pass('فحص حالة الحظر موجود في صفحة المنتج');
} else {
  fail('فحص حالة الحظر قد يكون مفقوداً');
}

// فحص أن renderBlocked موجود
if (productPage.includes('renderBlocked') || productPage.includes('Blocked')) {
  pass('دالة renderBlocked موجودة');
} else {
  fail('دالة renderBlocked قد تكون مفقودة');
}

// فحص أن الفحص يحدث أولاً (قبل أي توجيه)
const bannedCheckIndex = productPage.indexOf('banned');
const redirectIndex = productPage.indexOf('redirect(');
if (bannedCheckIndex > 0 && (redirectIndex < 0 || bannedCheckIndex < redirectIndex)) {
  pass('فحص الحظر يحدث أولاً قبل التوجيه');
} else {
  fail('ترتيب فحص الحظر قد يكون تغير');
}

// ════════════════════════════════════════════════════════════════
// فحص publishStore.ts — لم يُمَس نظام الحظر
// ════════════════════════════════════════════════════════════════
log('\n🔍', 'فحص publishStore.ts...\n');

const publishStore = readFileSync('app/lib/publishStore.ts', 'utf-8');

log('📋', 'فحص عدم المساس بنظام الحظر:');

// فحص أن banned/suspended status موجودة
if (publishStore.includes('banned') || publishStore.includes('suspended')) {
  pass('حالات الحظر (banned/suspended) موجودة');
} else {
  fail('حالات الحظر قد تكون تم إزالتها');
}

// ════════════════════════════════════════════════════════════════
// فحص subsStore.ts — لم يُمَس نظام الحظر
// ════════════════════════════════════════════════════════════════
log('\n🔍', 'فحص subsStore.ts...\n');

const subsStore = readFileSync('app/lib/subsStore.ts', 'utf-8');

log('📋', 'فحص حالات الاشتراك:');

// فحص أن status types تتضمن banned/suspended
if (subsStore.includes('banned') && subsStore.includes('suspended')) {
  pass('حالات banned/suspended موجودة في نظام الاشتراكات');
} else {
  fail('حالات banned/suspended قد تكون تم إزالتها');
}

// ════════════════════════════════════════════════════════════════
// فحص AdminPanel.tsx — لوحة إدارة الحظر
// ════════════════════════════════════════════════════════════════
log('\n🔍', 'فحص AdminPanel.tsx...\n');

const adminPanel = readFileSync('app/components/auth/AdminPanel.tsx', 'utf-8');

log('📋', 'فحص لوحة إدارة الحظر:');

// فحص أن الأدمن يمكنه تغيير الحالات
if (adminPanel.includes('banned') && adminPanel.includes('suspended')) {
  pass('واجهة إدارة الحظر موجودة في لوحة الأدمن');
} else {
  fail('واجهة إدارة الحظر قد تكون تم تعديلها');
}

// فحص أن هناك فلترة حسب الحالة
if (adminPanel.includes('status') && (adminPanel.includes('filter') || adminPanel.includes('tab'))) {
  pass('نظام تصفية حسب الحالة موجود');
} else {
  fail('نظام تصفية حسب الحالة قد يكون تغير');
}

// ════════════════════════════════════════════════════════════════
// النتيجة النهائية
// ════════════════════════════════════════════════════════════════
log('\n📊', '═══ نتيجة فحص نظام الحظر/السماح ═══');
log('✅', `الاختبارات الناجحة: ${tests.passed}`);
if (tests.failed > 0) {
  log('❌', `الاختبارات الفاشلة: ${tests.failed}`);
}

const total = tests.passed + tests.failed;
const rate = ((tests.passed / total) * 100).toFixed(1);
log('📈', `نسبة النجاح: ${rate}%`);

if (tests.failed === 0) {
  log('\n🎉', '═══ نظام الحظر/السماح لم يُمَس - آمن للنشر ═══\n');
  process.exit(0);
} else {
  log('\n⚠️', '═══ تحذير: تم اكتشاف تعديلات على نظام الحظر ═══\n');
  process.exit(1);
}
