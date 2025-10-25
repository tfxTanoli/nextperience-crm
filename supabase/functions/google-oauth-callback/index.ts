import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Handle GET requests (OAuth callback from Google)
  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    console.log("[OAuth] Callback received - code:", code?.substring(0, 10) + "...", "state:", state);

    if (!code) {
      return errorResponse("Missing authorization code");
    }

    // State is optional - it's only present for authenticated users
    const userId = state || null;

    const base = new URL(req.url).origin.replace("http://", "https://");
    const redirectUri = `${base}/functions/v1/google-oauth-callback`;

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID") ?? Deno.env.get("VITE_GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? Deno.env.get("VITE_GOOGLE_CLIENT_SECRET");

    console.log("[OAuth] Client ID configured:", !!clientId);
    console.log("[OAuth] Client Secret configured:", !!clientSecret);

    if (!clientId || !clientSecret) {
      return errorResponse("OAuth credentials not configured");
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("[OAuth] Token exchange failed:", errorText);
      return errorResponse("Token exchange failed");
    }

    const tokens = await tokenResponse.json();

    const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000));

    // Save tokens directly to database using service role
    let tokensSaved = false;
    if (userId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        console.log("[OAuth] Attempting to save tokens for user:", userId);
        console.log("[OAuth] Supabase URL:", supabaseUrl);
        console.log("[OAuth] Service key available:", !!supabaseServiceKey);

        if (supabaseUrl && supabaseServiceKey) {
          // Use Supabase client with service role for better error handling
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
            console.error("[OAuth] Error saving tokens via Supabase client:", error);
          } else {
            console.log("[OAuth] Tokens saved successfully for user:", userId);
            console.log("[OAuth] Saved data:", data);
            tokensSaved = true;
          }
        } else {
          console.error("[OAuth] Missing Supabase configuration");
        }
      } catch (dbError) {
        console.error("[OAuth] Database error:", dbError);
      }
    }

    // Return tokens as JSON for the browser to handle
    // The browser will save them using an authenticated request
    const responseData = {
      success: true,
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt.toISOString(),
        scope: tokens.scope,
      },
      userId: userId || null,
    };

    // If this is a sign-in/sign-up flow, get user info from Google
    if (!userId) {
      const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: {
          "Authorization": `Bearer ${tokens.access_token}`,
        },
      });

      if (!userInfoResponse.ok) {
        return errorResponse("Failed to get user info from Google");
      }

      const googleUser = await userInfoResponse.json();
      responseData.googleUser = {
        email: googleUser.email,
        name: googleUser.name,
        picture: googleUser.picture,
      };
    }

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Connected to Google</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    }
    .success-icon {
      font-size: 4rem;
      margin-bottom: 1rem;
    }
    h2 {
      margin: 0 0 0.5rem 0;
      font-size: 1.5rem;
    }
    p {
      margin: 0;
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="success-icon">✓</div>
    <h2>Connected Successfully!</h2>
    <p>You can now send emails. This window will close automatically...</p>
  </div>
  <script>
    (function() {
      try {
        const payload = {
          type: 'google-connected',
          success: true,
          data: ${JSON.stringify(responseData)},
          timestamp: Date.now()
        };

        console.log('[Callback] Payload:', payload);
        console.log('[Callback] Window opener exists:', !!window.opener);
        console.log('[Callback] Window opener closed:', window.opener?.closed);

        if (window.opener && !window.opener.closed) {
          console.log('[Callback] Posting success message to opener');
          // Send to all origins since we don't know the exact origin
          window.opener.postMessage(payload, '*');

          // Send again after a short delay to ensure delivery
          setTimeout(() => {
            console.log('[Callback] Sending duplicate message');
            window.opener.postMessage(payload, '*');
          }, 100);

          // Send one more time before closing
          setTimeout(() => {
            console.log('[Callback] Sending final message before close');
            window.opener.postMessage(payload, '*');
          }, 500);
        } else {
          console.warn('[Callback] No valid opener window - storing in localStorage as fallback');
          // Fallback: store in localStorage for the parent to retrieve
          try {
            localStorage.setItem('google_oauth_tokens', JSON.stringify(payload));
          } catch (e) {
            console.error('[Callback] Failed to store in localStorage:', e);
          }
        }
      } catch (e) {
        console.error('[Callback] Error:', e);
      }

      setTimeout(() => {
        console.log('[Callback] Closing window');
        window.close();
      }, 1500);
    })();
  </script>
</body>
</html>`;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (error) {
    console.error("[OAuth] Unexpected error:", error);
    return errorResponse(error.message);
  }
});

function errorResponse(message: string) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Connection Failed</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      color: white;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    }
    .error-icon {
      font-size: 4rem;
      margin-bottom: 1rem;
    }
    h2 {
      margin: 0 0 0.5rem 0;
      font-size: 1.5rem;
    }
    p {
      margin: 0;
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="error-icon">✕</div>
    <h2>Connection Failed</h2>
    <p>${message}</p>
    <p style="margin-top: 1rem;">This window will close automatically...</p>
  </div>
  <script>
    (function() {
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({
            type: 'google-error',
            error: '${message}'
          }, '*');
        }
      } catch (e) {
        console.error('[Callback] Error:', e);
      }

      setTimeout(() => {
        window.close();
      }, 3000);
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 400,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}