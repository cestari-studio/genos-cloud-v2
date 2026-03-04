import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const BUCKET = 'content-media';

// Formato limits definition (from prompt)
const FORMAT_LIMITS: Record<string, { maxFiles: number; acceptVideo: boolean; acceptImage: boolean }> = {
  feed: { maxFiles: 1, acceptVideo: true, acceptImage: true },
  carrossel: { maxFiles: 10, acceptVideo: true, acceptImage: true },
  stories: { maxFiles: 10, acceptVideo: true, acceptImage: true },
  reels: { maxFiles: 1, acceptVideo: true, acceptImage: false }
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization')!;
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: corsHeaders });
  }

  const sb = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { data: { user }, error: authErr } = await sb.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !user) throw new Error('Unauthorized');

    let payloadStr = '';
    let action = '';

    // Handle multipart/form-data vs application/json
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      action = formData.get('action') as string;
      // For upload & replace
      if (action === 'upload') {
        return await handleUpload(sb, user.id, formData);
      } else if (action === 'replace') {
        return await handleReplace(sb, user.id, formData);
      }
    } else {
      const payload = await req.json();
      action = payload.action;
      if (action === 'assign') {
        return await handleAssign(sb, user.id, payload);
      } else if (action === 'delete') {
        return await handleDelete(sb, user.id, payload);
      } else if (action === 'process_renames') {
        // Internal/Cron triggers might come differently, but keeping it unified
        return await handleProcessRenames(sb, payload);
      }
    }

    throw new Error('Unsupported action');
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
});

async function handleUpload(sb: ReturnType<typeof createClient>, userId: string, fd: FormData) {
  const file = fd.get('file') as File;
  const postId = fd.get('post_id') as string;
  const tenantId = fd.get('tenant_id') as string;

  if (!file || !postId || !tenantId) throw new Error('Missing file, post_id or tenant_id');

  // Mime check
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime'];
  if (!allowedMimes.includes(file.type)) throw new Error(`Mime type ${file.type} not allowed.`);

  // Size check (max 50MB)
  if (file.size > 50 * 1024 * 1024) throw new Error('File exceeds 50MB limits.');

  const ext = file.name.split('.').pop() || 'bin';
  const uuid = crypto.randomUUID();
  const tempPath = `${tenantId}/temp/${postId}/${uuid}.${ext.toLowerCase()}`;
  const fileType = file.type.startsWith('image') ? 'image' : 'video';

  // 1. Upload to temp
  const { error: uploadErr } = await sb.storage.from(BUCKET).upload(tempPath, file);
  if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

  // Create public url for thumbnail right away from temp
  const { data: pubData } = sb.storage.from(BUCKET).getPublicUrl(tempPath);

  // 2. Insert into post_media as pending
  // Use an arbitrary position for now like current timestamp sequence or highly padded value to avoid uniqueness constraint crashes 
  // before exact assignment. We'll set it to a large negative number temporarily.
  const tempPosition = -Math.floor(Date.now() / 1000);

  const { data: mediaRec, error: dbErr } = await sb.from('post_media').insert({
    post_id: postId,
    position: tempPosition,
    type: fileType,
    original_file_name: file.name,
    file_name: file.name, // Temp
    storage_path: tempPath,
    file_size: file.size,
    mime_type: file.type,
    status: 'pending',
    thumbnail_url: pubData.publicUrl,
    uploaded_by: userId
  }).select().single();

  if (dbErr) {
    await sb.storage.from(BUCKET).remove([tempPath]);
    throw new Error(`DB Insert failed: ${dbErr.message}`);
  }

  return new Response(JSON.stringify({ success: true, media: mediaRec }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handleAssign(sb: ReturnType<typeof createClient>, userId: string, payload: any) {
  const { post_id, tenant_id, assignments } = payload;
  // assignments: { media_id: string, position: number }[]

  // Fetch the Post to get tenant_name and scheduled_date
  const { data: post, error: pErr } = await sb.from('posts').select('*, tenants(name)').eq('id', post_id).single();
  if (pErr || !post) throw new Error('Post not found');

  const tenantName = post.tenants?.name || 'Tenant';
  const scheduledDate = post.scheduled_date || post.created_at;

  const results = [];

  // For each assignment, rename and move
  for (const assign of assignments) {
    const { media_id, position } = assign;

    const { data: media, error: mErr } = await sb.from('post_media').select('*').eq('id', media_id).single();
    if (mErr || !media) throw new Error(`Media ${media_id} not found`);

    const ext = media.original_file_name?.split('.').pop() || 'bin';

    // Call the PSQL rename tool
    const { data: newFilename } = await sb.rpc('generate_media_filename', {
      p_tenant_name: tenantName,
      p_scheduled_date: scheduledDate,
      p_post_id: post_id,
      p_position: position,
      p_extension: ext
    });

    const newPath = `${tenant_id}/${post_id}/${newFilename}`;

    let targetPathURL = '';

    if (media.storage_path !== newPath) {
      const { error: moveErr } = await sb.storage.from(BUCKET).move(media.storage_path, newPath);
      // Note: If crossing folders, standard move works. If it fails due to existance, handle carefully.
      if (moveErr) throw new Error(`Move failed for ${media_id}: ${moveErr.message}`);
    }

    const { data: pubData } = sb.storage.from(BUCKET).getPublicUrl(newPath);
    targetPathURL = pubData.publicUrl;

    // Update post_media
    const { data: updated, error: updErr } = await sb.from('post_media').update({
      position: position,
      file_name: newFilename,
      storage_path: newPath,
      wix_media_url: targetPathURL,
      thumbnail_url: targetPathURL, // Default to self, frontend could replace with extracted thumbnails for videos later
      status: 'uploaded'
    }).eq('id', media_id).select().single();

    if (updErr) throw new Error(`DB Update failed for ${media_id}: ${updErr.message}`);

    results.push(updated);
  }

  return new Response(JSON.stringify({ success: true, media: results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handleDelete(sb: ReturnType<typeof createClient>, userId: string, payload: any) {
  const { media_id, post_id } = payload;

  // Fetch
  const { data: media, error: mErr } = await sb.from('post_media').select('storage_path').eq('id', media_id).single();
  if (mErr || !media) throw new Error('Media not found');

  // Delete physically
  if (media.storage_path) {
    await sb.storage.from(BUCKET).remove([media.storage_path]);
  }

  // Delete logically
  await sb.from('post_media').delete().eq('id', media_id);

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handleReplace(sb: ReturnType<typeof createClient>, userId: string, fd: FormData) {
  const file = fd.get('file') as File;
  const mediaId = fd.get('media_id') as string;
  const postId = fd.get('post_id') as string;

  // Fetch existing media
  const { data: oldMedia, error: oldErr } = await sb.from('post_media').select('*').eq('id', mediaId).single();
  if (oldErr || !oldMedia) throw new Error('Old media not found');

  // Delete old physical file
  if (oldMedia.storage_path) {
    await sb.storage.from(BUCKET).remove([oldMedia.storage_path]);
  }

  // Upload new file to the SAME ultimate path if possible, but we need to re-generate filename 
  // depending on the new extension. Let's extract the new extension.
  const ext = file.name.split('.').pop() || 'bin';
  const fileType = file.type.startsWith('image') ? 'image' : 'video';

  // Fetch the Post to re-generate standard filename
  const { data: post, error: pErr } = await sb.from('posts').select('*, tenants(name)').eq('id', postId).single();
  if (pErr || !post) throw new Error('Post not found');

  const tenantName = post.tenants?.name || 'Tenant';
  const scheduledDate = post.scheduled_date || post.created_at;
  const position = oldMedia.position;

  const { data: newFilename } = await sb.rpc('generate_media_filename', {
    p_tenant_name: tenantName,
    p_scheduled_date: scheduledDate,
    p_post_id: postId,
    p_position: position,
    p_extension: ext
  });

  const targetPath = `${post.tenant_id}/${postId}/${newFilename}`;

  // Upload new directly to target path
  const { error: uploadErr } = await sb.storage.from(BUCKET).upload(targetPath, file);
  if (uploadErr) throw new Error('Failed to upload new file for replace');

  const { data: pubData } = sb.storage.from(BUCKET).getPublicUrl(targetPath);

  const { data: updatedMedia, error: updErr } = await sb.from('post_media').update({
    file_name: newFilename,
    original_file_name: file.name,
    storage_path: targetPath,
    wix_media_url: pubData.publicUrl,
    thumbnail_url: pubData.publicUrl,
    file_size: file.size,
    mime_type: file.type,
    type: fileType,
    uploaded_by: userId
  }).eq('id', mediaId).select().single();

  if (updErr) throw new Error('Failed to update DB for Replace');

  return new Response(JSON.stringify({ success: true, media: updatedMedia }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Optional internal route placeholder for batch rename processors if called natively here
async function handleProcessRenames(sb: ReturnType<typeof createClient>, payload: any) {
  return new Response(JSON.stringify({ success: true, message: 'delegated to media-rename-processor' }), {
    headers: { ...corsHeaders }
  });
}
