// Check current auth state - pending codes and devices

async function checkAuthState() {
  console.log('🔍 Checking authentication state...');
  console.log('Current time:', new Date().toISOString());
  console.log('');

  try {
    // Try to list pending codes via debug endpoint if exists
    const res = await fetch('http://localhost:3000/api/debug/auth-state', {
      cache: 'no-store'
    });

    if (res.ok) {
      const data = await res.json();
      console.log('📊 Auth State:', JSON.stringify(data, null, 2));
    } else {
      console.log('⚠️  No debug endpoint available (this is normal)');
      console.log('');
      console.log('To test verification:');
      console.log('1. Check your email (menez223@gmail.com) for the 6-digit code');
      console.log('2. Run: node scripts/test-full-auth-flow.mjs <CODE>');
      console.log('');
      console.log('Or test directly from browser:');
      console.log('1. Open http://localhost:3000 in incognito mode');
      console.log('2. Click "استوديو" button');
      console.log('3. Login with: project / SPECTRE');
      console.log('4. Enter the 6-digit code you received');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

checkAuthState();
