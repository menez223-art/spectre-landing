import { chromium } from 'playwright';

async function testNewDeviceLogin() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  console.log('🔍 Step 1: Opening homepage...');
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'test-results/01-homepage.png' });

  console.log('🔍 Step 2: Clicking Studio button...');
  await page.click('text=استوديو');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'test-results/02-auth-gate.png' });

  console.log('🔍 Step 3: Entering credentials...');
  await page.fill('input[type="text"]', 'spectre');
  await page.fill('input[type="password"]', 'spec1234');
  await page.screenshot({ path: 'test-results/03-credentials-filled.png' });

  console.log('🔍 Step 4: Submitting login...');

  // Listen to network requests
  page.on('response', async (response) => {
    if (response.url().includes('/api/auth/login')) {
      console.log('📡 Login Response Status:', response.status());
      const body = await response.text();
      console.log('📡 Login Response Body:', body);
    }
    if (response.url().includes('/api/auth/verify')) {
      console.log('📡 Verify Response Status:', response.status());
      const body = await response.text();
      console.log('📡 Verify Response Body:', body);
    }
  });

  await page.click('button:has-text("دخول")');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/04-after-login.png' });

  // Check if verification code input appears
  const hasCodeInput = await page.locator('input[placeholder*="رمز"]').count() > 0;

  if (hasCodeInput) {
    console.log('✅ Verification code input appeared');
    console.log('⏳ Waiting for you to provide the 6-digit code...');
    console.log('');
    console.log('==========================================');
    console.log('📧 Check your admin email for the code');
    console.log('🔢 Enter the code when ready (type it in console):');
    console.log('==========================================');

    // Wait for manual input
    await page.waitForTimeout(60000); // Wait 60 seconds for code

  } else {
    console.log('❌ Verification code input did NOT appear');
    await page.screenshot({ path: 'test-results/04-error-state.png' });
  }

  console.log('🔍 Final page state:');
  const currentUrl = page.url();
  console.log('Current URL:', currentUrl);

  await page.waitForTimeout(5000);
  await browser.close();
}

testNewDeviceLogin().catch(console.error);
