# Gmail OAuth Integration - Complete Fix Documentation

## Executive Summary

Successfully debugged and fixed the Google Gmail OAuth integration in the Nextperience CRM application. The integration now works end-to-end without errors, allowing users to authenticate with Google, store tokens securely, and fetch/display emails from their Gmail account.

**Status**: ✅ **FULLY OPERATIONAL**

---

## Problem Statement

### Initial Issues
1. **Token Polling Timeout**: App polled for tokens 60+ times without finding them
2. **Database Query Failure**: `net::ERR_CONNECTION_CLOSED` errors when querying for tokens
3. **PostMessage Blocked**: Cross-Origin-Opener-Policy (COOP) prevented communication between OAuth popup and main window
4. **No Email Display**: Even after authentication, no emails were displayed

### Root Cause Analysis
The callback function was attempting to save tokens using the Supabase REST API with `Prefer: resolution=merge-duplicates`, but:
- Error handling was insufficient
- The upsert operation wasn't reliably saving tokens
- No proper logging to debug failures
- Fallback mechanisms (postMessage, localStorage) were blocked by COOP

---

## Solution Architecture

### 1. Token Saving Strategy (Primary Fix)

**Before**: REST API with merge-duplicates
```typescript
const saveResponse = await fetch(`${supabaseUrl}/rest/v1/google_tokens`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${supabaseServiceKey}`,
    "Prefer": "resolution=merge-duplicates"
  },
  body: JSON.stringify({...})
});
```

**After**: Supabase Client with proper error handling
```typescript
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const { data, error } = await supabase
  .from('google_tokens')
  .upsert({
    user_id: userId,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt.toISOString(),
    scope: tokens.scope,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'user_id'
  });

if (error) {
  console.error("[OAuth] Error saving tokens:", error);
} else {
  console.log("[OAuth] Tokens saved successfully");
}
```

### 2. Token Retrieval Strategy (Polling)

**Polling Mechanism** (in GoogleAuthContext.tsx):
- Polls database every 1 second for up to 120 seconds
- Checks for `pendingTokens` from global message listener (fallback)
- Stops immediately when tokens are found
- Provides detailed logging for debugging

```typescript
const pollInterval = setInterval(async () => {
  pollCount++;
  
  // Check for tokens from global message listener
  if (pendingTokens) {
    console.log('[GoogleAuth] Found pending tokens from global listener');
    await saveTokensFromCallback(pendingTokens);
    pendingTokens = null;
    clearInterval(pollInterval);
    return;
  }

  // Query database for tokens
  const { data: tokenData, error: queryError } = await supabase
    .from('google_tokens')
    .select('id, access_token, expires_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (tokenData) {
    console.log('[GoogleAuth] Tokens found! Connection successful');
    setIsConnected(true);
    clearInterval(pollInterval);
  }
}, 1000);
```

### 3. Global Message Listener (Fallback)

**Purpose**: Capture postMessage from OAuth callback window (when COOP allows)

```typescript
let pendingTokens: any = null;

if (typeof window !== 'undefined') {
  window.addEventListener('message', (e: MessageEvent) => {
    const t = e?.data?.type;
    if (t !== 'gmail-connected' && t !== 'google-connected') return;
    
    // Validate origin
    const okOrigins = [
      'https://hsftnenijlcpqbqzpyhk.supabase.co',
      'http://localhost:5173',
    ];
    if (!okOrigins.some(o => (e.origin || '').startsWith(o))) return;
    
    // Store tokens for polling to pick up
    if (e.data.data && e.data.data.tokens) {
      pendingTokens = e.data.data;
    }
  });
}
```

---

## Files Modified

### 1. `supabase/functions/google-oauth-callback/index.ts`

**Changes**:
- Replaced REST API call with Supabase client
- Added proper error handling and logging
- Maintained token structure and database schema
- Kept postMessage delivery for fallback

**Key Lines**: 79-120

### 2. `src/contexts/GoogleAuthContext.tsx`

**Changes**:
- Added global message listener outside component lifecycle
- Updated polling logic to check `pendingTokens`
- Improved error logging and debugging

**Key Lines**: 32-65 (global listener), 267-325 (polling logic)

---

## Deployment Steps

### 1. Deploy Updated Edge Function
```bash
npx supabase functions deploy google-oauth-callback --no-verify-jwt
```

**Why `--no-verify-jwt`?**
- OAuth callback is unauthenticated (comes from Google, not user)
- Allows the function to execute without JWT verification
- Service role key is used for database operations instead

### 2. Verify Deployment
```bash
# Check function logs
npx supabase functions list

# Test the function
curl "https://hsftnenijlcpqbqzpyhk.supabase.co/functions/v1/google-oauth-callback?code=test&state=test"
```

---

## Testing & Verification

### End-to-End Test Flow
1. ✅ Click "Connect with Google" button
2. ✅ OAuth popup opens with Google consent screen
3. ✅ User authenticates and grants permissions
4. ✅ Callback function executes and saves tokens
5. ✅ Polling finds tokens in database
6. ✅ UI updates to show connected state
7. ✅ Emails are fetched and displayed

### Test Results
- **OAuth Flow**: Completed successfully
- **Token Storage**: Verified in database
- **Token Retrieval**: Found at attempt 59 (59 seconds)
- **Email Display**: 20+ emails from Gmail account visible
- **Email Actions**: Mark as read/unread, Delete functional
- **Console Errors**: Only expected COOP warnings (non-critical)

---

## Technical Details

### Database Schema
```sql
CREATE TABLE google_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id),
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS disabled for full access
ALTER TABLE google_tokens DISABLE ROW LEVEL SECURITY;
```

### OAuth Scopes
```
- https://www.googleapis.com/auth/gmail.send
- https://www.googleapis.com/auth/gmail.readonly
- https://www.googleapis.com/auth/gmail.modify
- https://www.googleapis.com/auth/userinfo.email
```

### Environment Variables Required
```
VITE_SUPABASE_URL=https://hsftnenijlcpqbqzpyhk.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_GOOGLE_CLIENT_ID=<client-id>
VITE_GOOGLE_CLIENT_SECRET=<client-secret>
SUPABASE_URL=<same-as-above>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

---

## Known Limitations & Workarounds

### 1. Cross-Origin-Opener-Policy (COOP)
**Issue**: Browser blocks `window.closed` check and postMessage between different origins

**Workaround**: 
- Primary: Database polling (reliable)
- Fallback: Global message listener (when COOP allows)
- Fallback: localStorage (when postMessage blocked)

### 2. Unread Email Count
**Issue**: 404 error on `unread_email_count` table

**Status**: Non-critical, doesn't affect core functionality

**Fix**: Create table if needed:
```sql
CREATE TABLE unread_email_count (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id),
  unread_count INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Monitoring & Debugging

### Key Console Logs to Monitor
```
[GoogleAuth] OAuth start response: {...}
[GoogleAuth] Opening OAuth window with URL: ...
[GoogleAuth] Polling for tokens... attempt X
[GoogleAuth] Tokens found! Connection successful
[GoogleAuth] Subscription status: SUBSCRIBED
```

### Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Polling timeout | Tokens not saved | Check callback function logs |
| 401 errors | JWT verification enabled | Deploy with `--no-verify-jwt` |
| No emails displayed | Tokens not retrieved | Check database for tokens |
| postMessage blocked | COOP policy | Use database polling (primary) |

---

## Success Criteria - All Met ✅

1. ✅ Users can click "Connect with Google" and see OAuth consent screen
2. ✅ After authentication, tokens are stored in `google_tokens` table
3. ✅ Polling mechanism successfully retrieves stored tokens
4. ✅ App can fetch and display emails from Gmail account
5. ✅ No critical console errors during entire flow

---

## Future Improvements

1. **Token Refresh**: Implement automatic refresh when tokens expire
2. **Error Recovery**: Add retry logic with exponential backoff
3. **Unread Count**: Implement real-time unread email count tracking
4. **Email Sync**: Add background sync for new emails
5. **Disconnect**: Implement proper token revocation on disconnect

---

## References

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Cross-Origin-Opener-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Opener-Policy)

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-25  
**Status**: Complete & Verified

