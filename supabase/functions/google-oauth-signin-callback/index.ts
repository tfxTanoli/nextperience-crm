import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code) {
      return errorResponse("Missing authorization code");
    }

    const base = url.origin.replace("http://", "https://");
    const redirectUri = `${base}/functions/v1/google-oauth-signin-callback`;

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID") ?? Deno.env.get("VITE_GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? Deno.env.get("VITE_GOOGLE_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      return errorResponse("OAuth credentials not configured");
    }

    // Exchange code for tokens
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

    // Get user info from Google
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        "Authorization": `Bearer ${tokens.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      return errorResponse("Failed to get user info");
    }

    const googleUser = await userInfoResponse.json();
    console.log("[OAuth] Got Google user:", googleUser.email);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if user exists
    const { data: existingUser } = await supabase.auth.admin.listUsers();
    const user = existingUser?.users?.find(u => u.email === googleUser.email);

    let userId: string;

    if (user) {
      // User exists, use their ID
      userId = user.id;
      console.log("[OAuth] User exists:", userId);
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: googleUser.email,
        email_confirm: true,
        user_metadata: {
          full_name: googleUser.name,
          picture: googleUser.picture,
        },
      });

      if (createError) {
        console.error("[OAuth] Failed to create user:", createError);
        return errorResponse("Failed to create user account");
      }

      userId = newUser.user.id;
      console.log("[OAuth] Created new user:", userId);
    }

    // Generate Supabase session
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: googleUser.email,
    });

    if (sessionError) {
      console.error("[OAuth] Failed to generate session:", sessionError);
      return errorResponse("Failed to create session");
    }

    // Redirect to app with success
    const appUrl = new URL(supabaseUrl);
    const redirectUrl = `${appUrl.origin.replace(".supabase.co", "")}/auth/callback?code=${code}&type=signup`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Signing in...</title>
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
    .spinner {
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-top: 4px solid white;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
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
    <div class="spinner"></div>
    <h2>Signing you in...</h2>
    <p>Please wait while we complete your authentication.</p>
  </div>
  <script>
    // Store the code and redirect
    localStorage.setItem('google_auth_code', '${code}');
    localStorage.setItem('google_user_email', '${googleUser.email}');
    localStorage.setItem('google_user_id', '${userId}');
    
    // Redirect to app
    setTimeout(() => {
      window.location.href = '${window.location.origin}?google_signin=true';
    }, 1000);
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
  <title>Sign in Failed</title>
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
    <h2>Sign in Failed</h2>
    <p>${message}</p>
    <p style="margin-top: 1rem;">Redirecting back...</p>
  </div>
  <script>
    setTimeout(() => {
      window.location.href = '${window.location.origin}?google_error=${encodeURIComponent(message)}';
    }, 2000);
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

