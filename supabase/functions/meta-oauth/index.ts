import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
            {
                global: {
                    headers: { Authorization: req.headers.get("Authorization")! },
                },
            }
        );

        const {
            data: { user },
        } = await supabaseClient.auth.getUser();

        if (!user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 401,
            });
        }

        const { action, ...body } = await req.json();

        const META_APP_ID = Deno.env.get("META_APP_ID");
        const META_APP_SECRET = Deno.env.get("META_APP_SECRET");
        const REDIRECT_URI = "https://app.cestari.studio/auth/callback/meta";

        if (action === "get_auth_url") {
            const { provider, tenant_id } = body;
            const state = btoa(JSON.stringify({ tenant_id, provider, uid: user.id, ts: Date.now() }));

            let authUrl = "";
            if (provider === "instagram") {
                authUrl = `https://api.instagram.com/oauth/authorize?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=instagram_business_basic,instagram_business_content_publish&response_type=code&state=${state}`;
            } else if (provider === "facebook") {
                authUrl = `https://www.facebook.com/v22.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=pages_manage_posts,pages_read_engagement,pages_show_list,instagram_basic,instagram_content_publish&response_type=code&state=${state}`;
            }

            return new Response(JSON.stringify({ data: { auth_url: authUrl } }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (action === "exchange_code") {
            const { code, state, provider } = body;
            const stateData = JSON.parse(atob(state));

            // Basic CSRF/Validation
            if (stateData.uid !== user.id) throw new Error("Invalid state");

            if (provider === "instagram") {
                // Exchange for short-lived token
                const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
                    method: "POST",
                    body: new URLSearchParams({
                        client_id: META_APP_ID!,
                        client_secret: META_APP_SECRET!,
                        grant_type: "authorization_code",
                        redirect_uri: REDIRECT_URI,
                        code,
                    }),
                });
                const tokenData = await tokenRes.json();
                if (tokenData.error) throw new Error(tokenData.error_message);

                // Exchange for long-lived token
                const llRes = await fetch(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${META_APP_SECRET}&access_token=${tokenData.access_token}`);
                const llData = await llRes.json();

                // Get profile data
                const profileRes = await fetch(`https://graph.instagram.com/v22.0/me?fields=id,username,profile_picture_url&access_token=${llData.access_token}`);
                const profileData = await profileRes.json();

                // Store in Vault via helper
                const { data: secretId, error: secretError } = await supabaseClient.rpc("store_social_token", {
                    p_tenant_id: stateData.tenant_id,
                    p_platform: "instagram",
                    p_token: llData.access_token
                });

                if (secretError) throw secretError;

                await supabaseClient.from("social_connections").upsert({
                    tenant_id: stateData.tenant_id,
                    platform: "instagram",
                    platform_user_id: profileData.id,
                    platform_username: profileData.username,
                    platform_profile_pic: profileData.profile_picture_url,
                    access_token_encrypted_id: secretId,
                    token_expires_at: new Date(Date.now() + llData.expires_in * 1000).toISOString(),
                    status: "active",
                    connected_by: user.id
                });

                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            if (provider === "facebook") {
                // Exchange for long-lived token
                const tokenUrl = `https://graph.facebook.com/v22.0/oauth/access_token?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&client_secret=${META_APP_SECRET}&code=${code}`;
                const tokenRes = await fetch(tokenUrl);
                const tokenData = await tokenRes.json();

                // Get Pages
                const pagesRes = await fetch(`https://graph.facebook.com/v22.0/me/accounts?access_token=${tokenData.access_token}&fields=id,name,access_token,picture`);
                const pagesData = await pagesRes.json();

                return new Response(JSON.stringify({ data: { pages: pagesData.data } }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }
        }

        if (action === "select_page") {
            const { tenant_id, page_id, page_name, page_token, ig_account_id } = body;

            const { data: secretId } = await supabaseClient.rpc("store_social_token", {
                p_tenant_id: tenant_id,
                p_platform: "facebook",
                p_token: page_token
            });

            await supabaseClient.from("social_connections").upsert({
                tenant_id,
                platform: "facebook",
                platform_user_id: page_id,
                platform_username: page_name,
                access_token_encrypted_id: secretId,
                status: "active",
                connected_by: user.id
            });

            if (ig_account_id) {
                // Also save IG if provided (Meta links them)
                // ... logic for IG via FB ...
            }

            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (action === "list_connections") {
            const { data, error } = await supabaseClient
                .from("social_connections")
                .select("id, platform, platform_username, platform_profile_pic, status, token_expires_at, scopes")
                .eq("tenant_id", body.tenant_id);

            if (error) throw error;
            return new Response(JSON.stringify({ data }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        return new Response(JSON.stringify({ error: "Invalid action" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
});
