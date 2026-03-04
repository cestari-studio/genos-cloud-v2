// genOS — analytics-aggregator edge function
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const authHeader = req.headers.get("Authorization") ?? "";
        const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
        if (!user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { action, tenant_id, days = 30 } = await req.json();
        if (!tenant_id) {
            return new Response(JSON.stringify({ error: "tenant_id required" }), {
                status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const since = new Date();
        since.setDate(since.getDate() - days);
        const sinceISO = since.toISOString();

        // ─── OVERVIEW ───────────────────────────────────────────────────────
        if (action === "overview") {
            const [
                { data: logs },
                { count: postsTotal },
                { count: postsApproved },
                { data: scheduleSlots },
                { data: evals },
            ] = await Promise.all([
                supabase.from("usage_logs").select("cost, operation, format, created_at").eq("tenant_id", tenant_id).gte("created_at", sinceISO),
                supabase.from("posts").select("*", { count: "exact", head: true }).eq("tenant_id", tenant_id).gte("created_at", sinceISO),
                supabase.from("posts").select("*", { count: "exact", head: true }).eq("tenant_id", tenant_id).eq("status", "approved").gte("created_at", sinceISO),
                supabase.from("publish_queue").select("platform, status, created_at").eq("tenant_id", tenant_id).gte("created_at", sinceISO),
                supabase.from("quality_evaluations").select("overall_score, status").eq("tenant_id", tenant_id).gte("created_at", sinceISO),
            ]);

            const totalTokens = (logs || []).reduce((s: number, l: any) => s + (Number(l.cost) || 0), 0);
            const avgScore = evals?.length ? Math.round(evals.reduce((s: number, e: any) => s + (e.overall_score || 0), 0) / evals.length) : 0;
            const publishedCount = (scheduleSlots || []).filter((s: any) => s.status === "published").length;

            return new Response(JSON.stringify({
                success: true, data: {
                    total_tokens: totalTokens,
                    total_posts: postsTotal || 0,
                    approved_posts: postsApproved || 0,
                    approval_rate: postsTotal ? Math.round(((postsApproved || 0) / postsTotal) * 100) : 0,
                    avg_quality_score: avgScore,
                    published_count: publishedCount,
                    total_evaluations: evals?.length || 0,
                }
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // ─── USAGE BY FORMAT ────────────────────────────────────────────────
        if (action === "usage_by_format") {
            const { data: logs } = await supabase
                .from("usage_logs")
                .select("format, operation, cost")
                .eq("tenant_id", tenant_id)
                .gte("created_at", sinceISO);

            const byFormat: Record<string, number> = {};
            const byOperation: Record<string, number> = {};
            (logs || []).forEach((l: any) => {
                byFormat[l.format || "outros"] = (byFormat[l.format || "outros"] || 0) + (Number(l.cost) || 0);
                byOperation[l.operation || "generate"] = (byOperation[l.operation || "generate"] || 0) + (Number(l.cost) || 0);
            });

            return new Response(JSON.stringify({
                success: true, data: {
                    by_format: Object.entries(byFormat).map(([group, value]) => ({ group, value })),
                    by_operation: Object.entries(byOperation).map(([group, value]) => ({ group, value })),
                }
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // ─── USAGE TIMELINE ─────────────────────────────────────────────────
        if (action === "usage_timeline") {
            const { data: logs } = await supabase
                .from("usage_logs")
                .select("cost, created_at, format")
                .eq("tenant_id", tenant_id)
                .gte("created_at", sinceISO)
                .order("created_at", { ascending: true });

            // Group by date + format
            const byDateFormat: Record<string, Record<string, number>> = {};
            (logs || []).forEach((l: any) => {
                const date = new Date(l.created_at).toISOString().slice(0, 10);
                const fmt = l.format || "outros";
                if (!byDateFormat[date]) byDateFormat[date] = {};
                byDateFormat[date][fmt] = (byDateFormat[date][fmt] || 0) + (Number(l.cost) || 0);
            });

            const timeline = Object.entries(byDateFormat).flatMap(([date, formats]) =>
                Object.entries(formats).map(([group, value]) => ({ date, group, value }))
            );

            return new Response(JSON.stringify({ success: true, data: { timeline } }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // ─── QUALITY TRENDS ─────────────────────────────────────────────────
        if (action === "quality_trends") {
            const { data: evals } = await supabase
                .from("quality_evaluations")
                .select("overall_score, status, created_at")
                .eq("tenant_id", tenant_id)
                .gte("created_at", sinceISO)
                .order("created_at", { ascending: true });

            const byDate: Record<string, { total: number; sum: number; passed: number }> = {};
            (evals || []).forEach((e: any) => {
                const date = new Date(e.created_at).toISOString().slice(0, 10);
                if (!byDate[date]) byDate[date] = { total: 0, sum: 0, passed: 0 };
                byDate[date].total++;
                byDate[date].sum += e.overall_score || 0;
                if (e.status === "passed" || e.status === "exception_approved") byDate[date].passed++;
            });

            const trends = Object.entries(byDate).map(([date, v]) => ({
                date,
                avg_score: Math.round(v.sum / v.total),
                pass_rate: Math.round((v.passed / v.total) * 100),
            }));

            return new Response(JSON.stringify({ success: true, data: { trends } }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // ─── PUBLISH PERFORMANCE ────────────────────────────────────────────
        if (action === "publish_performance") {
            const { data: slots } = await supabase
                .from("publish_queue")
                .select("platform, status, created_at")
                .eq("tenant_id", tenant_id)
                .gte("created_at", sinceISO);

            const byPlatform: Record<string, { total: number; published: number; failed: number }> = {};
            (slots || []).forEach((s: any) => {
                const p = s.platform || "outros";
                if (!byPlatform[p]) byPlatform[p] = { total: 0, published: 0, failed: 0 };
                byPlatform[p].total++;
                if (s.status === "published") byPlatform[p].published++;
                if (s.status === "failed") byPlatform[p].failed++;
            });

            const performance = Object.entries(byPlatform).map(([platform, v]) => ({
                platform,
                total: v.total,
                published: v.published,
                failed: v.failed,
                success_rate: v.total ? Math.round((v.published / v.total) * 100) : 0,
            }));

            return new Response(JSON.stringify({ success: true, data: { performance } }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        return new Response(JSON.stringify({ error: "Invalid action" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
