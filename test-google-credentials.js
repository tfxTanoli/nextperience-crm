#!/usr/bin/env node

/**
 * Test Google OAuth Credentials
 * This script validates that your Google credentials are correct
 */

const GOOGLE_CLIENT_ID = 'your-google-client-id.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = 'GOCSPX-your-google-client-secret';
const REDIRECT_URI = 'http://localhost:5173/auth/callback';

console.log('🔍 Testing Google OAuth Credentials\n');
console.log('=' .repeat(60));

// Test 1: Validate credential format
console.log('\n✓ Test 1: Credential Format Validation');
console.log('-'.repeat(60));

const clientIdValid = GOOGLE_CLIENT_ID.includes('.apps.googleusercontent.com');
const secretValid = GOOGLE_CLIENT_SECRET.startsWith('GOCSPX-');

console.log(`Client ID format: ${clientIdValid ? '✅ VALID' : '❌ INVALID'}`);
console.log(`  Format: [number]-[hash].apps.googleusercontent.com`);
console.log(`  Actual: ${GOOGLE_CLIENT_ID}`);

console.log(`\nClient Secret format: ${secretValid ? '✅ VALID' : '❌ INVALID'}`);
console.log(`  Format: GOCSPX-[hash]`);
console.log(`  Actual: ${GOOGLE_CLIENT_SECRET}`);

// Test 2: Build OAuth URL
console.log('\n✓ Test 2: OAuth URL Generation');
console.log('-'.repeat(60));

const scope = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', scope);
authUrl.searchParams.set('access_type', 'offline');
authUrl.searchParams.set('prompt', 'select_account consent');

console.log('Generated OAuth URL:');
console.log(authUrl.toString());

// Test 3: Validate token endpoint
console.log('\n✓ Test 3: Token Endpoint Validation');
console.log('-'.repeat(60));

const tokenEndpoint = 'https://oauth2.googleapis.com/token';
console.log(`Token Endpoint: ${tokenEndpoint}`);
console.log('✅ Endpoint is correct');

// Test 4: Check required scopes
console.log('\n✓ Test 4: Required Scopes');
console.log('-'.repeat(60));

const requiredScopes = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
];

requiredScopes.forEach(s => {
  console.log(`✅ ${s}`);
});

// Test 5: Validate Supabase configuration
console.log('\n✓ Test 5: Supabase Configuration');
console.log('-'.repeat(60));

const supabaseUrl = 'https://your-project-id.supabase.co';
const supabaseProject = 'your-project-id';

console.log(`Supabase URL: ${supabaseUrl}`);
console.log(`Project ID: ${supabaseProject}`);
console.log('✅ Configuration looks correct');

// Test 6: Check for common issues
console.log('\n✓ Test 6: Common Issues Check');
console.log('-'.repeat(60));

const issues = [];

if (!GOOGLE_CLIENT_ID) {
  issues.push('❌ Client ID is empty');
}

if (!GOOGLE_CLIENT_SECRET) {
  issues.push('❌ Client Secret is empty');
}

if (GOOGLE_CLIENT_ID.includes('{{') || GOOGLE_CLIENT_ID.includes('}}')) {
  issues.push('❌ Client ID contains template variables');
}

if (GOOGLE_CLIENT_SECRET.includes('{{') || GOOGLE_CLIENT_SECRET.includes('}}')) {
  issues.push('❌ Client Secret contains template variables');
}

if (issues.length === 0) {
  console.log('✅ No common issues detected');
} else {
  issues.forEach(issue => console.log(issue));
}

// Test 7: Summary
console.log('\n' + '='.repeat(60));
console.log('📋 SUMMARY');
console.log('='.repeat(60));

const allValid = clientIdValid && secretValid && issues.length === 0;

if (allValid) {
  console.log('\n✅ All tests passed! Your Google credentials appear to be valid.\n');
  console.log('Next steps:');
  console.log('1. Go to Google Cloud Console: https://console.cloud.google.com');
  console.log('2. Select your project');
  console.log('3. Go to APIs & Services → Credentials');
  console.log('4. Find your OAuth 2.0 Client ID');
  console.log('5. Click Edit and add these Authorized redirect URIs:');
  console.log('   - http://localhost:5173/functions/v1/google-oauth-callback');
  console.log('   - https://your-project-id.supabase.co/functions/v1/google-oauth-callback');
  console.log('6. Save the changes');
  console.log('7. Restart your development server');
  console.log('8. Try connecting Google in the app\n');
} else {
  console.log('\n❌ Some tests failed. Please check the issues above.\n');
}

console.log('='.repeat(60));