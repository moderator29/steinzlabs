'use client';

import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ImagePlus, Send, X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/hooks/useAuth';

/**
 * Group chat composer — text + up to 4 images with a live pre-post preview, in
 * the platform's glass + motion language. Images upload to the shared wire-media
 * bucket (public URLs), then post as media_urls. Send is blocked until every
 * pending upload settles, so a message never ships with a half-uploaded image.
 */

const MAX_IMAGES = 4;
const MAX_BYTES = 1_048_576; // 1MB, matches the wire-media bucket cap

interface Pending { id: string; preview: string; url: string | null; uploading: boolean; error?: boolean; }
export interface GroupMessage { id: string; author_id: string; body: string; media_urls: string[]; created_at: string; author: unknown; }

function uid() {
  return (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function GroupComposer({ groupId, onSent }: { groupId: string; onSent: (m: GroupMessage) => void }) {
  const { user } = useAuth();
  const [draft, setDraft] = useState('');
  const [images, setImages] = useState<Pending[]>([]);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const anyUploading = images.some((i) => i.uploading);
  const canSend = (draft.trim().length > 0 || images.some((i) => i.url)) && !sending && !anyUploading;

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (fileRef.current) fileRef.current.value = '';
    if (!user) return;
    const room = MAX_IMAGES - images.length;
    for (const file of files.slice(0, Math.max(0, room))) {
      if (!file.type.startsWith('image/') || file.size > MAX_BYTES) continue;
      const id = uid();
      const preview = URL.createObjectURL(file);
      setImages((prev) => [...prev, { id, preview, url: null, uploading: true }]);
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().slice(0, 5);
      try {
        const path = `${user.id}/${uid()}.${ext}`;
        const { error } = await supabase.storage.from('wire-media').upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false });
        if (error) throw error;
        const { data: pub } = supabase.storage.from('wire-media').getPublicUrl(path);
        setImages((prev) => prev.map((im) => im.id === id ? { ...im, uploading: false, url: pub?.publicUrl ?? null, error: !pub?.publicUrl } : im));
      } catch {
        setImages((prev) => prev.map((im) => im.id === id ? { ...im, uploading: false, error: true } : im));
      }
    }
  };

  const remove = (id: string) => setImages((prev) => {
    const g = prev.find((i) => i.id === id);
    if (g) { try { URL.revokeObjectURL(g.preview); } catch { /* ignore */ } }
    return prev.filter((i) => i.id !== id);
  });

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    const body = draft.trim();
    const media_urls = images.map((i) => i.url).filter((u): u is string => !!u);
    try {
      const r = await fetch(`/api/groups/${groupId}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, media_urls }),
      });
      const j = await r.json();
      if (j?.message) {
        onSent(j.message);
        images.forEach((i) => { try { URL.revokeObjectURL(i.preview); } catch { /* ignore */ } });
        setDraft(''); setImages([]);
      }
    } catch { /* keep draft on failure */ } finally { setSending(false); }
  };

  return (
    <div className="sticky bottom-0 bg-[#05080F]/92 backdrop-blur-md border-t border-white/10 naka-safe-bottom">
      <AnimatePresence>
        {images.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex gap-2 px-4 pt-3 overflow-x-auto no-scrollbar">
              {images.map((im) => (
                <motion.div
                  key={im.id}
                  layout
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.85, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                  className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden border border-white/10"
                  style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.2)' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={im.preview} alt="" className={`w-full h-full object-cover ${im.uploading ? 'opacity-50' : ''}`} />
                  {im.uploading ? (
                    <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="w-5 h-5 text-white animate-spin" /></div>
                  ) : null}
                  {im.error ? <div className="absolute inset-0 bg-rose-500/25 flex items-center justify-center text-[10px] text-white font-semibold">Failed</div> : null}
                  <button type="button" onClick={() => remove(im.id)} aria-label="Remove image" className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white/90 hover:bg-black/80">
                    <X className="w-3 h-3" />
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex items-end gap-2 px-4 py-3">
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={pick} />
        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={() => fileRef.current?.click()}
          disabled={images.length >= MAX_IMAGES}
          aria-label="Add image"
          className="w-10 h-10 shrink-0 rounded-full inline-flex items-center justify-center text-[#7FB2FF] bg-[#0066FF]/[0.1] border border-[#0066FF]/25 hover:bg-[#0066FF]/[0.18] disabled:opacity-40 transition-colors"
        >
          <ImagePlus className="w-[18px] h-[18px]" />
        </motion.button>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
          rows={1}
          placeholder="Message the group…"
          className="flex-1 min-w-0 resize-none bg-[#0066FF]/[0.06] border border-[#0066FF]/25 rounded-2xl px-4 py-2.5 text-base text-white placeholder:text-white/40 outline-none focus:border-[#0066FF]/60"
        />
        <motion.button
          type="submit"
          whileTap={{ scale: 0.9 }}
          disabled={!canSend}
          aria-label="Send"
          className="w-10 h-10 shrink-0 rounded-full text-white inline-flex items-center justify-center disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg,#1E90FF,#0066FF)', boxShadow: '0 0 18px rgba(0,102,255,.5), inset 0 1px 0 rgba(255,255,255,.25)' }}
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </motion.button>
      </form>
    </div>
  );
}

export default GroupComposer;
