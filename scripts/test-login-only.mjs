// Test LOGIN only and save fingerprint for later verify
// Usage: node scripts/test-login-only.mjs

import crypto from 'crypto';
import fs from 'fs';

const STORED_FINGERPRINT_FILE = './.test-fingerprint';

function generateFingerprint() {
  return 'test-device-' + crypto.randomBytes(8).toString('hex');
}

async function testLoginOnly() {
  const username = 'project';
  const password = 'SPECTRE';
  const fingerprint = generateFingerprint();

  console.log('═══════════════════════════════════════════════════════');
  console.log('🧪 Testing LOGIN only (will save fingerprint)');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log('📋 Test parameters:');
  console.log('  Username:', username);
  console.log('  Password:', '***' + password.slice(-4));
  console.log('  Fingerprint:', fingerprint);
  console.log('');

  console.log('───────────────────────────────────────────────────────');
  console.log('LOGIN (POST /api/auth/login)');
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

    const actualData = loginData.data || loginData;
    const error = loginData.error;

    if (error) {
      console.error('❌ Login failed with error:', error);
      return;
    }

    if (actualData.approved) {
      console.log('✅ Device was ALREADY approved (first device or previously approved)');
      console.log('🎉 Authentication complete!');
      // Clean up stored fingerprint since we don't need it
      try {
        fs.unlinkSync(STORED_FINGERPRINT_FILE);
      } catch {}
      return;
    }

    if (!actualData.approved && actualData.codeRequestedAt) {
      console.log('✅ Login successful - device needs verification');
      console.log('📧 Verification code was sent at:', actualData.codeRequestedAt);
      console.log('');

      // Save fingerprint for later verify
      fs.writeFileSync(STORED_FINGERPRINT_FILE, fingerprint, 'utf8');
      console.log('💾 Saved fingerprint to:', STORED_FINGERPRINT_FILE);
      console.log('');
      console.log('═══════════════════════════════════════════════════════');
      console.log('📧 CHECK YOUR EMAIL (menez223@gmail.com)');
      console.log('═══════════════════════════════════════════════════════');
      console.log('');
      console.log('Once you receive the 6-digit code, run:');
      console.log('  node scripts/test-verify-only.mjs <CODE>');
      console.log('');
      console.log('Example:');
      console.log('  node scripts/test-verify-only.mjs 123456');
      console.log('');
    } else {
      console.error('❌ Unexpected login response:', loginData);
    }

  } catch (error) {
    console.error('❌ Login network error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testLoginOnly();
