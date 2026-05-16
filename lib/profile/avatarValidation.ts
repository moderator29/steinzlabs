/**
 * Client-side avatar-upload validation. Caller calls validateAvatar()
 * BEFORE shipping the file to Supabase Storage so the user sees an
 * inline error within a frame instead of waiting for the upload to
 * fail server-side. Pure — no IO.
 */

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_DIMENSION = 2048; // 2048x2048 max — guard against camera dumps

export interface AvatarValidationResult {
  ok: boolean;
  error?: string;
  /** Detected dimensions when the file passes initial checks. */
  width?: number;
  height?: number;
}

export async function validateAvatar(file: File): Promise<AvatarValidationResult> {
  if (!file) return { ok: false, error: 'No file selected' };
  if (file.size > MAX_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return { ok: false, error: `File is ${mb}MB; max 2MB.` };
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return { ok: false, error: `Unsupported format: ${file.type || 'unknown'}. Use JPG, PNG, WebP, or GIF.` };
  }
  try {
    const dims = await readDimensions(file);
    if (dims.width > MAX_DIMENSION || dims.height > MAX_DIMENSION) {
      return {
        ok: false,
        error: `Image is ${dims.width}×${dims.height}; max ${MAX_DIMENSION}×${MAX_DIMENSION}.`,
      };
    }
    return { ok: true, width: dims.width, height: dims.height };
  } catch {
    return { ok: false, error: 'Could not read image dimensions.' };
  }
}

function readDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('window unavailable'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };
    img.src = url;
  });
}

/**
 * Sanitize an arbitrary filename for use as a Supabase Storage object
 * key. Lowercase, strip everything that's not alphanumeric or one of
 * a few safe characters, cap length, prepend the user id segment.
 */
export function avatarStorageKey(userId: string, filename: string): string {
  const ext = (filename.match(/\.([a-z0-9]+)$/i)?.[1] ?? 'png').toLowerCase().slice(0, 5);
  const safe = filename
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 32)
    .toLowerCase();
  return `${userId}/${Date.now()}-${safe}.${ext}`;
}
