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
    const authHeader = req.headers.get("Authorization");
    let user: any = null;

    // If authorization header is provided, verify the user
    if (authHeader) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey, {
        global: {
          headers: { Authorization: authHeader },
        },
      });

      const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();
      if (!userError && authUser) {
        user = authUser;
      }
    }

    // If no authenticated user, that's okay for signin/signup flow
    console.log("[OAuth] User authenticated:", !!user);

    const base = new URL(req.url).origin.replace("http://", "https://");
    const redirectUri = `${base}/functions/v1/google-oauth-callback`;
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID") ?? Deno.env.get("VITE_GOOGLE_CLIENT_ID");

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_CLIENT_ID not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Determine scope based on whether user is authenticated
    let scope: string;
    if (user) {
      // For authenticated users connecting Gmail
      scope = [
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/userinfo.email",
      ].join(" ");
    } else {
      // For sign-in/sign-up
      scope = [
        "openid",
        "email",
        "profile",
      ].join(" ");
    }

    const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    auth.searchParams.set("client_id", clientId);
    auth.searchParams.set("redirect_uri", redirectUri);
    auth.searchParams.set("response_type", "code");
    auth.searchParams.set("scope", scope);
    auth.searchParams.set("access_type", "offline");
    auth.searchParams.set("prompt", "select_account consent");
    auth.searchParams.set("include_granted_scopes", "true");
    if (user) {
      auth.searchParams.set("state", user.id);
    }

    console.log("[OAuth] Generated auth URL");
    console.log("[OAuth] Redirect URI:", redirectUri);
    console.log("[OAuth] Scope:", scope);

    return new Response(JSON.stringify({
      authUrl: auth.toString(),
      redirectUri: redirectUri
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});