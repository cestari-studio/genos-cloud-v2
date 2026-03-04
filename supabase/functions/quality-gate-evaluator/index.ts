import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "https://app.cestari.studio",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const authHeader = req.headers.get("Authorization")!;
        const { data: { user } } = await supabaseClient.auth.getUser(authHeader.replace("Bearer ", ""));

        if (!user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { action, postId, evaluationId, tenantId, ruleId, config, reason, filters } = await req.json();

        // 1. Action: evaluate / re_evaluate
        if (action === "evaluate" || action === "re_evaluate") {
            if (action === "re_evaluate") {
                await supabaseClient.from("quality_evaluations").delete().eq("post_id", postId);
            }

            const { data: evaluation_id, error } = await supabaseClient.rpc("evaluate_post_sql", { p_post_id: postId });

            if (error) throw error;

            // In a real scenario, here we would also trigger Gemini for tone_adherence
            // For this implementation, we assume the SQL helper did the deterministic work.

            const { data: evalData } = await supabaseClient
                .from("quality_evaluations")
                .select("*, constraint_results(*, constraint_rules(*))")
                .eq("id", evaluation_id)
                .single();

            return new Response(JSON.stringify({ success: true, data: evalData }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // 2. Action: approve_exception
        if (action === "approve_exception") {
            const { data, error } = await supabaseClient
                .from("quality_evaluations")
                .update({ status: "exception_approved", evaluated_by: user.id, reason_exception: reason })
                .eq("id", evaluationId)
                .select()
                .single();

            if (error) throw error;

            return new Response(JSON.stringify({ success: true, data }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // 3. Action: list_queue
        if (action === "list_queue") {
            let query = supabaseClient
                .from("quality_evaluations")
                .select(`
          *,
          posts!inner (title, content_type, format),
          constraint_results (id, passed, severity)
        `)
                .order("created_at", { ascending: false });

            if (filters?.tenant_id) query = query.eq("tenant_id", filters.tenant_id);
            if (filters?.status) query = query.eq("status", filters.status);

            const { data, error } = await query;
            if (error) throw error;

            return new Response(JSON.stringify({ success: true, data }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // 4. Action: manage_rules
        if (action === "manage_rules") {
            const { sub_action, ruleData } = await req.json();

            if (sub_action === "list") {
                const { data, error } = await supabaseClient.from("constraint_rules").select("*").eq("tenant_id", tenantId);
                if (error) throw error;
                return new Response(JSON.stringify({ success: true, data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (sub_action === "toggle") {
                const { data, error } = await supabaseClient.from("constraint_rules").update({ enabled: ruleData.enabled }).eq("id", ruleId).select().single();
                if (error) throw error;
                return new Response(JSON.stringify({ success: true, data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (sub_action === "seed") {
                const { error } = await supabaseClient.rpc("seed_default_constraints", { p_tenant_id: tenantId });
                if (error) throw error;
                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
        }

        return new Response(JSON.stringify({ error: "Invalid action" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
