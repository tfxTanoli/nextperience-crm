# Google OAuth Implementation Guide

## Overview

This document explains how Google OAuth authentication is implemented in the Nextperience CRM application. The implementation uses Supabase's built-in OAuth provider for secure and seamless authentication.

## Architecture

### Components Involved

1. **Frontend**: React component (`LoginForm.tsx`) handles OAuth flow initiation
2. **Backend**: Supabase Auth manages OAuth token exchange and user creation
3. **Provider**: Google OAuth 2.0 for authentication
4. **Database**: Supabase PostgreSQL stores user data

### Flow Diagram

```
User clicks "Sign in/up with Google"
    ↓
LoginForm.tsx calls supabase.auth.signInWithOAuth()
    ↓
Redirects to Google OAuth consent screen
    ↓
User selects Google account and grants permissions
    ↓
Google redirects to Supabase callback URL with authorization code
    ↓
Supabase exchanges code for access token using Client Secret
    ↓
User created/updated in auth.users table
    ↓
Redirects back to localhost:5173 with session tokens
    ↓
Application authenticated and dashboard loads
```

## Configuration

### Google Cloud Console Setup

**Project**: peak-suprstate-476006-i6
**OAuth Client ID**: 2743739487-gclvjgj42qnumkf984il93e9qr69joof.apps.googleusercontent.com

**Authorized Redirect URIs**:
- `https://hsftnenijlcpqbqzpyhk.supabase.co/auth/v1/callback` (Production)
- `http://localhost:5173/` (Development)

### Supabase Configuration

**Project URL**: https://hsftnenijlcpqbqzpyhk.supabase.co
**Project ID**: hsftnenijlcpqbqzpyhk

**Google OAuth Provider Settings**:
- **Client ID**: 2743739487-gclvjgj42qnumkf984il93e9qr69joof.apps.googleusercontent.com
- **Client Secret**: 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
- **Callback URL**: https://hsftnenijlcpqbqzpyhk.supabase.co/auth/v1/callback
- **Status**: Enabled

## Implementation Details

### Frontend Code

**File**: `src/components/auth/LoginForm.tsx`

```typescript
const handleGoogleAuth = async () => {
  setGoogleLoading(true);
  setError('');

  try {
    console.log('[GoogleAuth] Starting OAuth flow for mode:', viewMode);

    // Use Supabase's built-in OAuth provider
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (oauthError) {
      throw oauthError;
    }

    console.log('[GoogleAuth] OAuth flow initiated');
    setGoogleLoading(false);
  } catch (error) {
    console.error('Google OAuth error:', error);
    setError(error instanceof Error ? error.message : 'Failed to authenticate with Google');
    setGoogleLoading(false);
  }
};
```

### Key Parameters

- **provider**: 'google' - Specifies Google as the OAuth provider
- **redirectTo**: `${window.location.origin}` - Redirects back to the application after authentication
- **access_type**: 'offline' - Requests refresh token for offline access
- **prompt**: 'consent' - Always shows consent screen (useful for testing)

## User Data Captured

When a user authenticates via Google OAuth, the following data is captured:

### From Google
- **Email**: usman5194999@gmail.com
- **Full Name**: Muhammad Usman
- **Picture**: User's Google profile picture URL
- **Email Verified**: true/false status
- **Provider ID**: Google's unique user ID

### Stored in Supabase

**auth.users table**:
- `id`: UUID (27aa200b-4251-48de-b47b-245c4e5a84b7)
- `email`: usman5194999@gmail.com
- `user_metadata`: Contains name, picture, email_verified, etc.
- `app_metadata`: Contains provider info (google)
- `created_at`: Timestamp of account creation
- `confirmed_at`: Email confirmation timestamp

## Authentication Flow

### Sign-In Flow

1. User clicks "Sign in with Google" button
2. `handleGoogleAuth()` is called with `viewMode: 'signin'`
3. Supabase redirects to Google OAuth consent screen
4. User selects account and grants permissions
5. Google redirects to Supabase callback with authorization code
6. Supabase exchanges code for access token using Client Secret
7. User session created in browser
8. Redirects back to application dashboard

### Sign-Up Flow

1. User clicks "Sign up with Google" button
2. `handleGoogleAuth()` is called with `viewMode: 'signup'`
3. Same OAuth flow as sign-in
4. If user doesn't exist, new account is created automatically
5. User is logged in immediately after account creation

## Session Management

### Token Storage

Supabase automatically manages tokens:
- **Access Token**: Short-lived JWT token (1 hour)
- **Refresh Token**: Long-lived token for refreshing access
- **Session**: Stored in browser localStorage

### Session Verification

The application checks for active session on page load:
- If session exists, user is logged in
- If session expired, refresh token is used to get new access token
- If no session, user is redirected to login page

## Error Handling

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `redirect_uri_mismatch` | Redirect URI not registered in Google Cloud | Add URI to Google OAuth client authorized redirect URIs |
| `invalid_client` | Client ID or Secret incorrect | Verify credentials in Supabase and Google Cloud |
| `Unable to exchange external code` | Client Secret mismatch | Update Client Secret in Supabase to match Google Cloud |
| `access_denied` | User denied permissions | User can retry and grant permissions |

## Testing

### Manual Testing Steps

1. **Sign-In Test**:
   - Navigate to http://localhost:5173
   - Click "Sign in with Google"
   - Select Google account
   - Verify dashboard loads
   - Check Supabase auth.users table for user record

2. **Sign-Up Test**:
   - Sign out from application
   - Click "Sign up with Google"
   - Select Google account
   - Verify new user created in Supabase
   - Verify dashboard loads

3. **Session Persistence**:
   - Sign in with Google
   - Refresh page
   - Verify user still logged in
   - Check browser localStorage for session tokens

## Security Considerations

1. **Client Secret**: Never expose in frontend code (stored securely in Supabase)
2. **HTTPS**: Always use HTTPS in production (OAuth requires secure connection)
3. **Redirect URI**: Only register trusted redirect URIs in Google Cloud
4. **Token Expiration**: Access tokens expire after 1 hour (automatic refresh)
5. **CORS**: Supabase handles CORS for OAuth endpoints

## Troubleshooting

### User Not Created

**Check**:
1. Verify Google OAuth provider is enabled in Supabase
2. Check Supabase auth.users table for user record
3. Review browser console for errors
4. Check Supabase logs for OAuth errors

### Session Lost After Refresh

**Check**:
1. Verify localStorage is not cleared
2. Check if refresh token is valid
3. Verify session expiration time
4. Check browser privacy settings

### Redirect Loop

**Check**:
1. Verify redirectTo URL matches application origin
2. Check if session is being created properly
3. Verify auth context is initialized correctly

## Related Files

- `src/components/auth/LoginForm.tsx` - OAuth flow implementation
- `src/contexts/GoogleAuthContext.tsx` - Google auth context
- `src/contexts/AuthContext.tsx` - General auth context
- `.env` - Environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)

## References

- [Supabase OAuth Documentation](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Supabase Auth API Reference](https://supabase.com/docs/reference/javascript/auth-signinwithoauth)

