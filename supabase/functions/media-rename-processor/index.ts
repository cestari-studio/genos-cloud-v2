import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUCKET = 'content-media';

Deno.serve(async (req: Request) => {
  const sbAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Fetch pending rename tasks from activity_log
    // Note: Assuming `processed` column exists or using standard read-then-update logic mapped by external trigger.
    // We will query pending items identified by an implicit structured data block.
    const { data: pendingLogs, error: logErr } = await sbAdmin
      .from('activity_log')
      .select('*')
      .eq('category', 'media')
      .in('action', ['rename_required', 'batch_rename_required'])
      .order('created_at', { ascending: true })
      .limit(50); // Process blocks

    if (logErr) throw new Error(`Log fetch error: ${logErr.message}`);
    if (!pendingLogs || pendingLogs.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No pending renames' }), { status: 200 });
    }

    let processedCount = 0;

    for (const log of pendingLogs) {
      const { action, details, tenant_id } = log;

      if (action === 'rename_required') {
        const postId = details?.post_id;
        if (!postId) continue;

        // Fetch media attached to this post
        const { data: medias } = await sbAdmin.from('post_media').select('*').eq('post_id', postId).not('storage_path', 'is', null);

        if (medias) {
          for (const m of medias) {
            try {
              await executeMove(sbAdmin, m);
            } catch (e: any) {
              console.error(`Move failed on Media ID ${m.id}`, e.message);
            }
          }
        }
      } else if (action === 'batch_rename_required') {
        // Fetch ALL media attached to any post mapped to this tenant
        const { data: posts } = await sbAdmin.from('posts').select('id').eq('tenant_id', tenant_id);
        if (posts) {
          const postIds = posts.map(p => p.id);
          // Fetch all media
          for (let i = 0; i < postIds.length; i += 10) {
            const batchPostIds = postIds.slice(i, i + 10);
            const { data: medias } = await sbAdmin.from('post_media').select('*').in('post_id', batchPostIds).not('storage_path', 'is', null);
            if (medias) {
              for (const m of medias) {
                try {
                  await executeMove(sbAdmin, m);
                } catch (e: any) {
                  console.error(`Batch Move failed on Media ID ${m.id}`, e.message);
                }
              }
            }
          }
        }
      }

      // Acknowledge processed event by appending a generic finish tag, deleting, or updating processed state
      await sbAdmin.from('activity_log').delete().eq('id', log.id); // Consuming logic, ideally implement `processed` bit logic.
      processedCount++;
    }

    return new Response(JSON.stringify({ success: true, processedCount }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400
    });
  }
});

async function executeMove(sb: ReturnType<typeof createClient>, media: any) {
  if (!media.wix_media_url || !media.storage_path) return;

  // Reverse engineer old path from public URL
  // Format: "https://[ref].supabase.co/storage/v1/object/public/content-media/[PATH]"
  const urlParts = media.wix_media_url.split('/content-media/');
  if (urlParts.length < 2) return;
  const oldPath = decodeURIComponent(urlParts[1]);
  const newPath = media.storage_path;

  if (oldPath !== newPath) {
    // Run Move command
    const { error: moveErr } = await sb.storage.from(BUCKET).move(oldPath, newPath);
    if (moveErr) {
      // Might already be moved if duplicate call, check if exists
      // For resilience, throw to log.
      throw moveErr;
    }

    // Re-align wix_media_url with new mapping
    const { data: pubData } = sb.storage.from(BUCKET).getPublicUrl(newPath);
    await sb.from('post_media').update({
      wix_media_url: pubData.publicUrl,
      thumbnail_url: pubData.publicUrl
    }).eq('id', media.id);
  }
}
