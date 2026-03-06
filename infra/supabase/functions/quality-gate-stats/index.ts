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

        const { tenant_id, period = 'month' } = await req.json();

        // 1. Fetch all evaluations for the tenant in the given period
        let query = supabaseClient
            .from("quality_evaluations")
            .select("status, overall_score, constraint_results(severity, passed)")
            .eq("tenant_id", tenant_id);

        if (period === 'week') {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            query = query.gte("created_at", weekAgo.toISOString());
        } else if (period === 'month') {
            const monthAgo = new Date();
            monthAgo.setDate(monthAgo.getDate() - 30);
            query = query.gte("created_at", monthAgo.toISOString());
        }

        const { data, error } = await query;
        if (error) throw error;

        const stats = {
            total_evaluated: data.length,
            passed: data.filter(d => d.status === 'passed').length,
            failed: data.filter(d => d.status === 'failed').length,
            exception_approved: data.filter(d => d.status === 'exception_approved').length,
            avg_score: data.length > 0
                ? data.reduce((acc, d) => acc + (d.overall_score || 0), 0) / data.length
                : 0,
        };

        const pass_rate = stats.total_evaluated > 0
            ? ((stats.passed + stats.exception_approved) / stats.total_evaluated) * 100
            : 0;

        return new Response(JSON.stringify({
            success: true,
            data: {
                ...stats,
                pass_rate
            }
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
