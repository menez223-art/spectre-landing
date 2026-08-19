// Test verification with an existing fingerprint and code
// Usage: node scripts/test-verify-only.mjs <CODE>

import crypto from 'crypto';

const STORED_FINGERPRINT_FILE = './.test-fingerprint';

async function testVerifyOnly(code) {
  const username = 'project';

  console.log('═══════════════════════════════════════════════════════');
  console.log('🧪 Testing VERIFY only (using stored fingerprint)');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  // Try to read stored fingerprint from previous login
  let fingerprint = null;
  try {
    const fs = await import('fs');
    if (fs.existsSync(STORED_FINGERPRINT_FILE)) {
      fingerprint = fs.readFileSync(STORED_FINGERPRINT_FILE, 'utf8').trim();
      console.log('✅ Using stored fingerprint:', fingerprint);
    }
  } catch {}

  if (!fingerprint) {
    console.log('❌ No stored fingerprint found!');
    console.log('');
    console.log('You need to run a full login first:');
    console.log('  node scripts/test-login-only.mjs');
    console.log('');
    console.log('Then get the code from email and run:');
    console.log('  node scripts/test-verify-only.mjs <CODE>');
    process.exit(1);
  }

  console.log('📋 Test parameters:');
  console.log('  Username:', username);
  console.log('  Fingerprint:', fingerprint);
  console.log('  Code:', code);
  console.log('');

  console.log('───────────────────────────────────────────────────────');
  console.log('VERIFY (POST /api/auth/verify)');
  console.log('───────────────────────────────────────────────────────');

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
      return;
    }

    const actualData = verifyData.data || verifyData;

    console.log('');
    if (actualData.approved) {
      console.log('═══════════════════════════════════════════════════════');
      console.log('🎉 SUCCESS! Device verified and approved');
      console.log('═══════════════════════════════════════════════════════');

      // Clean up stored fingerprint after success
      try {
        const fs = await import('fs');
        fs.unlinkSync(STORED_FINGERPRINT_FILE);
        console.log('✅ Cleaned up stored fingerprint');
      } catch {}
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
  }
}

const code = process.argv[2];

if (!code) {
  console.log('Usage: node scripts/test-verify-only.mjs <6-digit-code>');
  console.log('');
  console.log('Make sure you ran login first:');
  console.log('  node scripts/test-login-only.mjs');
  process.exit(1);
}

testVerifyOnly(code);
