// اختبار يدوي لعملية التحقق من الرمز
// استخدم هذا السكريبت لإرسال طلب verify مباشر

const testVerify = async (code) => {
  const fingerprint = 'test-device-' + Date.now();

  console.log('🔍 Testing verification with:');
  console.log('  Username: spectre');
  console.log('  Code:', code);
  console.log('  Fingerprint:', fingerprint);
  console.log('');

  try {
    const response = await fetch('http://localhost:3000/api/auth/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'spectre',
        code: code,
        fingerprint: fingerprint
      })
    });

    console.log('📡 Response Status:', response.status);
    console.log('📡 Response Headers:', Object.fromEntries(response.headers.entries()));

    const text = await response.text();
    console.log('📡 Response Body (raw):', text);

    try {
      const json = JSON.parse(text);
      console.log('📡 Response Body (parsed):', JSON.stringify(json, null, 2));
    } catch {
      console.log('⚠️  Response is not JSON');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
};

// استخدم: node scripts/manual-verify-test.mjs <CODE>
const code = process.argv[2];

if (!code) {
  console.log('Usage: node scripts/manual-verify-test.mjs <6-digit-code>');
  process.exit(1);
}

testVerify(code);
