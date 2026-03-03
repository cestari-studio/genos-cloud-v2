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

        if (!user) throw new Error("Unauthorized");

        const { action, ...body } = await req.json();

        if (action === "enqueue") {
            const { post_id, platforms, scheduled_at } = body;

            const { data: tenant } = await supabaseClient.from("posts").select("tenant_id").eq("id", post_id).single();

            const results = [];
            for (const platform of platforms) {
                const { data: conn } = await supabaseClient
                    .from("social_connections")
                    .select("id")
                    .eq("tenant_id", tenant.tenant_id)
                    .eq("platform", platform)
                    .eq("status", "active")
                    .maybeSingle();

                if (conn) {
                    const { data: queueItem } = await supabaseClient.from("publish_queue").insert({
                        tenant_id: tenant.tenant_id,
                        post_id,
                        connection_id: conn.id,
                        platform,
                        scheduled_at,
                        status: "pending"
                    }).select().single();
                    results.push({ platform, id: queueItem.id });
                }
            }

            return new Response(JSON.stringify({ data: { queued: results } }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (action === "publish_now") {
            const { id } = body;
            const { data: item } = await supabaseClient
                .from("publish_queue")
                .select(`*, posts (*), social_connections (*)`)
                .eq("id", id)
                .single();

            if (!item) throw new Error("Queue item not found");

            // Get decrypted token
            const { data: token } = await supabaseClient.rpc("get_social_token", { p_connection_id: item.connection_id });

            let externalId = "";

            if (item.platform === "facebook") {
                const fbUrl = `https://graph.facebook.com/v22.0/${item.social_connections.platform_user_id}/feed`;
                const res = await fetch(fbUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        message: item.posts.body,
                        access_token: token
                    })
                });
                const data = await res.json();
                if (data.error) throw new Error(data.error.message);
                externalId = data.id;
            }

            if (item.platform === "instagram") {
                // Step 1: Create media container
                const containerUrl = `https://graph.facebook.com/v22.0/${item.social_connections.platform_user_id}/media`;
                const containerRes = await fetch(containerUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        image_url: item.posts.image_url, // Assume post has image_url for now
                        caption: item.posts.body,
                        access_token: token
                    })
                });
                const containerData = await containerRes.json();
                if (containerData.error) throw new Error(containerData.error.message);

                // Update status for polling
                await supabaseClient.from("publish_queue").update({
                    status: "container_created",
                    container_id: containerData.id
                }).eq("id", id);

                // Return for polling client or process in processor
                return new Response(JSON.stringify({ data: { status: "processing", container_id: containerData.id } }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            await supabaseClient.from("publish_queue").update({
                status: "published",
                external_post_id: externalId,
                published_at: new Date().toISOString()
            }).eq("id", id);

            return new Response(JSON.stringify({ success: true, external_id: externalId }), {
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
