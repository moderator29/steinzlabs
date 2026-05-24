import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminRequest } from '@/lib/auth/adminAuth';
import { logAdminAction } from '@/lib/admin/auditLog';

const BUCKET = 'research-images';
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

export async function POST(request: NextRequest) {
  // Standardized admin auth — accepts both ADMIN_BEARER_TOKEN and
  // Supabase JWT (profiles.role='admin'). Previously the route locked
  // out JWT-authenticated admins by checking only the env bearer.
  const adminId = await verifyAdminRequest(request);
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 415 });
  }

  const buffer = await file.arrayBuffer();
  if (buffer.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds 5 MB limit' }, { status: 413 });
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const safeName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(safeName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      // Bucket may not exist yet — create it then retry once
      if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
        await supabase.storage.createBucket(BUCKET, { public: true });
        const retry = await supabase.storage.from(BUCKET).upload(safeName, buffer, {
          contentType: file.type,
          upsert: false,
        });
        if (retry.error) throw new Error(retry.error.message);
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(retry.data.path);
        void logAdminAction({ adminId, action: 'research_upload', details: { path: retry.data.path, bytes: buffer.byteLength, contentType: file.type } });
        return NextResponse.json({ url: urlData.publicUrl });
      }
      throw new Error(error.message);
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
    void logAdminAction({ adminId, action: 'research_upload', details: { path: data.path, bytes: buffer.byteLength, contentType: file.type } });
    return NextResponse.json({ url: urlData.publicUrl });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
