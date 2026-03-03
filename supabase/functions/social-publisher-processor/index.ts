import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req: Request) => {
    const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    try {
        // 1. Process Pending/Scheduled items
        const { data: pendingItems } = await supabaseClient
            .from("publish_queue")
            .select("id")
            .eq("status", "pending")
            .lte("scheduled_at", new Date().toISOString());

        for (const item of pendingItems || []) {
            // Call publish_now action on social-publisher
            await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/social-publisher`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ action: "publish_now", id: item.id })
            });
        }

        // 2. Poll Instagram Containers
        const { data: processingItems } = await supabaseClient
            .from("publish_queue")
            .select(`*, social_connections (*)`)
            .eq("status", "container_created");

        for (const item of processingItems || []) {
            // Get decrypted token
            const { data: token } = await supabaseClient.rpc("get_social_token", { p_connection_id: item.connection_id });

            const pollUrl = `https://graph.facebook.com/v22.0/${item.container_id}?fields=status_code&access_token=${token}`;
            const pollRes = await fetch(pollUrl);
            const pollData = await pollRes.json();

            if (pollData.status_code === "FINISHED") {
                // Final publish
                const publishUrl = `https://graph.facebook.com/v22.0/${item.social_connections.platform_user_id}/media_publish`;
                const finalRes = await fetch(publishUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        creation_id: item.container_id,
                        access_token: token
                    })
                });
                const finalData = await finalRes.json();

                if (finalData.id) {
                    await supabaseClient.from("publish_queue").update({
                        status: "published",
                        external_post_id: finalData.id,
                        published_at: new Date().toISOString()
                    }).eq("id", item.id);
                }
            } else if (pollData.status_code === "ERROR") {
                await supabaseClient.from("publish_queue").update({
                    status: "failed",
                    last_error: "Meta container processing failed"
                }).eq("id", item.id);
            }
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json" },
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { "Content-Type": "application/json" },
            status: 500,
        });
    }
});
