const { chromium } = require('playwright');
const fs = require('fs');

const SUPABASE_URL = 'https://hsftnenijlcpqbqzpyhk.supabase.co';
const APP_URL = 'http://localhost:5173';
const EMAIL = 'lacapkatrian@gmail.com';
const PASSWORD = '@2025Tng';

async function analyzeGoogleOAuth() {
  console.log('🔍 ANALYZING GOOGLE OAUTH FLOW\n');
  console.log('═'.repeat(80));

  const browser = await chromium.launch({ headless: false });
  const context = await browser.createContext();
  const page = await context.newPage();

  // Enable console logging
  page.on('console', msg => {
    if (msg.type() === 'log') console.log(`[BROWSER LOG] ${msg.text()}`);
    if (msg.type() === 'error') console.error(`[BROWSER ERROR] ${msg.text()}`);
    if (msg.type() === 'warn') console.warn(`[BROWSER WARN] ${msg.text()}`);
  });

  // Capture network requests
  const requests = [];
  page.on('request', req => {
    requests.push({
      url: req.url(),
      method: req.method(),
      headers: req.headers(),
      timestamp: new Date().toISOString()
    });
  });

  try {
    console.log('\n📍 STEP 1: Navigate to app');
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
    console.log('✅ App loaded');

    console.log('\n📍 STEP 2: Login');
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button:has-text("Sign in")');
    await page.waitForNavigation({ waitUntil: 'networkidle' });
    console.log('✅ Logged in');

    console.log('\n📍 STEP 3: Navigate to Email Composer');
    // Find and click email button
    const emailButton = await page.$('button:has-text("Send Email")') || 
                       await page.$('button:has-text("Email")');
    if (emailButton) {
      await emailButton.click();
      await page.waitForTimeout(1000);
      console.log('✅ Email composer opened');
    } else {
      console.log('⚠️  Email button not found, looking for connect button');
    }

    console.log('\n📍 STEP 4: Check Google Connection Status');
    const connectButton = await page.$('button:has-text("Connect with Google")');
    if (connectButton) {
      console.log('✅ "Connect with Google" button found - NOT CONNECTED');
    } else {
      console.log('✅ "Connect with Google" button NOT found - MIGHT BE CONNECTED');
    }

    console.log('\n📍 STEP 5: Analyze OAuth Start Function');
    const oauthStartUrl = `${SUPABASE_URL}/functions/v1/google-oauth-start`;
    console.log(`Testing: ${oauthStartUrl}`);

    const session = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sb-hsftnenijlcpqbqzpyhk-auth-token') || '{}');
    });

    if (session.access_token) {
      console.log('✅ Session token found');
      
      const response = await page.evaluate(async (url, token) => {
        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        return {
          status: res.status,
          redirected: res.redirected,
          url: res.url,
          headers: Object.fromEntries(res.headers)
        };
      }, oauthStartUrl, session.access_token);

      console.log(`Response Status: ${response.status}`);
      console.log(`Redirected: ${response.redirected}`);
      if (response.redirected) {
        console.log(`Redirect URL: ${response.url}`);
        if (response.url.includes('accounts.google.com')) {
          console.log('✅ Correctly redirects to Google OAuth');
        }
      }
    } else {
      console.log('❌ No session token found');
    }

    console.log('\n📍 STEP 6: Check Environment Variables');
    const envVars = await page.evaluate(() => {
      return {
        VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
        VITE_GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        VITE_GOOGLE_CLIENT_SECRET: import.meta.env.VITE_GOOGLE_CLIENT_SECRET,
      };
    });

    console.log('Frontend Environment Variables:');
    console.log(`  VITE_SUPABASE_URL: ${envVars.VITE_SUPABASE_URL ? '✅ Set' : '❌ Not set'}`);
    console.log(`  VITE_GOOGLE_CLIENT_ID: ${envVars.VITE_GOOGLE_CLIENT_ID ? '✅ Set' : '❌ Not set'}`);
    console.log(`  VITE_GOOGLE_CLIENT_SECRET: ${envVars.VITE_GOOGLE_CLIENT_SECRET ? '✅ Set' : '❌ Not set'}`);

    console.log('\n📍 STEP 7: Check Google Tokens in Database');
    const hasTokens = await page.evaluate(async () => {
      const { data } = await window.supabase
        .from('google_tokens')
        .select('*')
        .maybeSingle();
      return !!data;
    });
    console.log(`Google Tokens in DB: ${hasTokens ? '✅ Found' : '❌ Not found'}`);

    console.log('\n📍 STEP 8: Network Requests Analysis');
    const googleRequests = requests.filter(r => r.url.includes('google'));
    const supabaseRequests = requests.filter(r => r.url.includes('supabase'));
    
    console.log(`Total Google requests: ${googleRequests.length}`);
    console.log(`Total Supabase requests: ${supabaseRequests.length}`);

    if (googleRequests.length > 0) {
      console.log('\nGoogle Requests:');
      googleRequests.forEach(r => console.log(`  - ${r.method} ${r.url}`));
    }

    console.log('\n📍 STEP 9: Check Browser Console for Errors');
    const logs = await page.evaluate(() => {
      return window.__consoleLogs || [];
    });

    console.log('\n═'.repeat(80));
    console.log('\n📊 SUMMARY\n');

    const issues = [];
    if (!envVars.VITE_GOOGLE_CLIENT_ID) issues.push('❌ VITE_GOOGLE_CLIENT_ID not set');
    if (!envVars.VITE_GOOGLE_CLIENT_SECRET) issues.push('❌ VITE_GOOGLE_CLIENT_SECRET not set');
    if (!hasTokens) issues.push('❌ No Google tokens in database');
    if (googleRequests.length === 0) issues.push('⚠️  No Google API requests detected');

    if (issues.length === 0) {
      console.log('✅ All checks passed!');
    } else {
      console.log('Issues found:');
      issues.forEach(issue => console.log(`  ${issue}`));
    }

    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      environment: envVars,
      hasTokens,
      googleRequests: googleRequests.length,
      supabaseRequests: supabaseRequests.length,
      issues
    };

    fs.writeFileSync('oauth-analysis-report.json', JSON.stringify(report, null, 2));
    console.log('\n📄 Detailed report saved to: oauth-analysis-report.json');

  } catch (error) {
    console.error('❌ Error during analysis:', error);
  } finally {
    await browser.close();
  }
}

analyzeGoogleOAuth().catch(console.error);

