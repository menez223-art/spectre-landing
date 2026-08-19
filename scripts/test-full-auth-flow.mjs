// اختبار كامل لتدفق المصادقة: login → verify
// يحاكي متصفحاً جديداً تماماً

import crypto from 'crypto';

// توليد بصمة جهاز وهمية (fingerprint)
function generateFingerprint() {
  return 'test-device-' + crypto.randomBytes(8).toString('hex');
}

async function testFullAuthFlow(code) {
  const fingerprint = generateFingerprint();
  const username = 'project';
  const password = 'SPECTRE';

  console.log('═══════════════════════════════════════════════════════');
  console.log('🧪 Testing full authentication flow from NEW device');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log('📋 Test parameters:');
  console.log('  Username:', username);
  console.log('  Password:', '***' + password.slice(-4));
  console.log('  Fingerprint:', fingerprint);
  console.log('  Code:', code || '(will be prompted)');
  console.log('');

  // ═══ STEP 1: Login ═══
  console.log('───────────────────────────────────────────────────────');
  console.log('STEP 1: Login (POST /api/auth/login)');
  console.log('───────────────────────────────────────────────────────');

  try {
    const loginRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, fingerprint })
    });

    console.log('✅ Login response status:', loginRes.status);
    console.log('📡 Login response headers:', Object.fromEntries(loginRes.headers.entries()));

    const loginText = await loginRes.text();
    console.log('📄 Login response body (raw):', loginText);

    let loginData;
    try {
      loginData = JSON.parse(loginText);
      console.log('📦 Login response body (parsed):', JSON.stringify(loginData, null, 2));
    } catch (e) {
      console.error('❌ Failed to parse login response as JSON');
      console.error('Error:', e.message);
      return;
    }

    // Extract actual data from wrapper
    const actualData = loginData.data || loginData;

    if (actualData.error || loginData.error) {
      console.error('❌ Login failed with error:', actualData.error || loginData.error);
      return;
    }

    if (actualData.approved) {
      console.log('✅ Device was ALREADY approved (first device or previously approved)');
      console.log('🎉 Authentication complete!');
      return;
    }

    if (!actualData.approved && actualData.codeRequestedAt) {
      console.log('✅ Login successful - device needs verification');
      console.log('📧 Verification code was sent at:', actualData.codeRequestedAt);
      console.log('');
    } else {
      console.error('❌ Unexpected login response:', loginData);
      return;
    }

  } catch (error) {
    console.error('❌ Login network error:', error.message);
    console.error('Stack:', error.stack);
    return;
  }

  // ═══ STEP 2: Verify ═══
  console.log('───────────────────────────────────────────────────────');
  console.log('STEP 2: Verify code (POST /api/auth/verify)');
  console.log('───────────────────────────────────────────────────────');

  if (!code) {
    console.log('⏳ Code not provided - please run with: node scripts/test-full-auth-flow.mjs <CODE>');
    return;
  }

  try {
    const verifyRes = await fetch('http://localhost:3000/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, code, fingerprint })
    });

    console.log('✅ Verify response status:', verifyRes.status);
    console.log('📡 Verify response headers:', Object.fromEntries(verifyRes.headers.entries()));

    const verifyText = await verifyRes.text();
    console.log('📄 Verify response body (raw):', verifyText);

    let verifyData;
    try {
      verifyData = JSON.parse(verifyText);
      console.log('📦 Verify response body (parsed):', JSON.stringify(verifyData, null, 2));
    } catch (e) {
      console.error('❌ Failed to parse verify response as JSON');
      console.error('Error:', e.message);
      console.error('Raw text was:', verifyText.substring(0, 500));
      return;
    }

    // Extract actual data from wrapper
    const actualData = verifyData.data || verifyData;

    console.log('');
    if (actualData.approved) {
      console.log('═══════════════════════════════════════════════════════');
      console.log('🎉 SUCCESS! Device verified and approved');
      console.log('═══════════════════════════════════════════════════════');
    } else if (actualData.error || verifyData.error) {
      console.log('═══════════════════════════════════════════════════════');
      console.log('❌ VERIFICATION FAILED');
      console.log('═══════════════════════════════════════════════════════');
      const errorCode = actualData.error || verifyData.error;
      console.log('Error code:', errorCode);

      const errorMap = {
        'wrong_code': 'The code is incorrect',
        'code_expired': 'The code has expired',
        'too_many_attempts': 'Too many failed attempts',
        'no_pending': 'No pending code for this device',
        'invalid_code': 'Invalid code format (must be 6 digits)'
      };

      console.log('Error message:', errorMap[errorCode] || 'Unknown error');
    } else {
      console.log('═══════════════════════════════════════════════════════');
      console.log('⚠️  UNEXPECTED RESPONSE');
      console.log('═══════════════════════════════════════════════════════');
      console.log('Response:', verifyData);
    }

  } catch (error) {
    console.error('❌ Verify network error:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Get code from command line
const code = process.argv[2];

if (!code) {
  console.log('Usage: node scripts/test-full-auth-flow.mjs <6-digit-code>');
  console.log('');
  console.log('This script will:');
  console.log('  1. Simulate a NEW device login');
  console.log('  2. Request a verification code (sent to admin email)');
  console.log('  3. Verify the code you provide');
  console.log('');
  console.log('Run without code first to trigger email, then run again with the code.');
  process.exit(0);
}

testFullAuthFlow(code);
