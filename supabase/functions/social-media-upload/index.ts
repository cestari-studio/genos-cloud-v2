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

        const formData = await req.formData();
        const file = formData.get("file") as File;
        const path = `uploads/${user.id}/${Date.now()}_${file.name}`;

        const { data, error } = await supabaseClient.storage
            .from("social-media")
            .upload(path, file, {
                contentType: file.type,
                upsert: true
            });

        if (error) throw error;

        const { data: { publicUrl } } = supabaseClient.storage
            .from("social-media")
            .getPublicUrl(path);

        return new Response(JSON.stringify({ data: { url: publicUrl } }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
});
