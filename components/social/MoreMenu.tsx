'use client';

import { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, UserMinus, VolumeX, Flag, Share2, Link as LinkIcon, ShieldAlert } from 'lucide-react';
import { useFocusTrap } from '@/lib/a11y/useFocusTrap';

/**
 * MoreMenu — the "⋯" overflow menu next to Follow / Message on a
 * profile header. Block / Mute / Report are destructive — they render
 * in crimson tones for emphasis. Share + Copy link are neutral.
 */

export interface MoreMenuProps {
  targetId: string;
  targetUsername: string;
  isBlocked: boolean;
  isMuted: boolean;
  onChange?: () => void;
}

export function MoreMenu({ targetId, targetUsername, isBlocked, isMuted, onChange }: MoreMenuProps) {
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const toggleBlock = async () => {
    const res = await fetch(`/api/social/block${isBlocked ? `?target_id=${targetId}` : ''}`, {
      method: isBlocked ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: isBlocked ? undefined : JSON.stringify({ target_id: targetId }),
    });
    if (res.ok) { onChange?.(); setOpen(false); }
  };
  const toggleMute = async () => {
    const res = await fetch(`/api/social/mute${isMuted ? `?target_id=${targetId}` : ''}`, {
      method: isMuted ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: isMuted ? undefined : JSON.stringify({ target_id: targetId }),
    });
    if (res.ok) { onChange?.(); setOpen(false); }
  };
  const copyLink = async () => {
    try {
      const url = `${window.location.origin}/u/${targetUsername}`;
      await navigator.clipboard.writeText(url);
      setOpen(false);
    } catch {
      // Clipboard blocked — silently fail; user can manually copy from URL bar.
    }
  };
  const share = async () => {
    try {
      const url = `${window.location.origin}/u/${targetUsername}`;
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: `@${targetUsername} on Steinz Labs`, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      setOpen(false);
    } catch {
      /* user cancelled share — ignore */
    }
  };

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="More actions"
        className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-slate-300"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 rounded-xl bg-[#0F1627] border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)] py-1 z-50">
          <button onClick={share} className="w-full text-start flex items-center gap-2 px-3 py-2 text-[12px] text-slate-200 hover:bg-white/[0.04]">
            <Share2 className="w-3.5 h-3.5" />Share profile
          </button>
          <button onClick={copyLink} className="w-full text-start flex items-center gap-2 px-3 py-2 text-[12px] text-slate-200 hover:bg-white/[0.04]">
            <LinkIcon className="w-3.5 h-3.5" />Copy profile link
          </button>
          <div className="my-1 border-t border-white/[0.06]" />
          <button onClick={toggleMute} className="w-full text-start flex items-center gap-2 px-3 py-2 text-[12px] text-amber-300 hover:bg-amber-500/[0.06]">
            <VolumeX className="w-3.5 h-3.5" />{isMuted ? 'Unmute' : 'Mute'} @{targetUsername}
          </button>
          <button onClick={toggleBlock} className="w-full text-start flex items-center gap-2 px-3 py-2 text-[12px] text-red-400 hover:bg-red-500/[0.06]">
            <UserMinus className="w-3.5 h-3.5" />{isBlocked ? 'Unblock' : 'Block'} @{targetUsername}
          </button>
          <button onClick={() => setReporting(true)} className="w-full text-start flex items-center gap-2 px-3 py-2 text-[12px] text-red-400 hover:bg-red-500/[0.06]">
            <Flag className="w-3.5 h-3.5" />Report @{targetUsername}
          </button>
        </div>
      )}
      {reporting && <ReportDialog targetId={targetId} username={targetUsername} onClose={() => { setReporting(false); setOpen(false); }} />}
    </div>
  );
}

function ReportDialog({ targetId, username, onClose }: { targetId: string; username: string; onClose: () => void }) {
  const [category, setCategory] = useState<'spam' | 'harassment' | 'scam' | 'impersonation' | 'other'>('harassment');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A11Y4: focus trap + Escape closes.
  const trapRef = useFocusTrap<HTMLDivElement>(true, onClose);
  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/social/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reported_id: targetId, category, reason: reason.trim() || category }),
      });
      if (res.ok) setDone(true);
      else {
        const j = await res.json().catch(() => null);
        setError(j?.error || 'Could not submit report');
      }
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Report @${username}`}>
      <div ref={trapRef} className="w-full max-w-md mx-4 rounded-2xl bg-[#0F1627] border border-white/10 p-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert className="w-4 h-4 text-red-400" />
          <h2 className="text-base font-semibold text-white">Report @{username}</h2>
        </div>
        {done ? (
          <>
            <p className="text-sm text-slate-300">Thanks — moderators will review. Your identity stays private.</p>
            <div className="mt-4 flex justify-end">
              <button onClick={onClose} className="px-4 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.10] text-slate-200 text-sm">Close</button>
            </div>
          </>
        ) : (
          <>
            <label className="block text-[11px] uppercase tracking-wide text-slate-400 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
              className="w-full mb-3 bg-[#0A0E1A] border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200"
            >
              <option value="spam">Spam</option>
              <option value="harassment">Harassment</option>
              <option value="scam">Scam / fraud</option>
              <option value="impersonation">Impersonation</option>
              <option value="other">Other</option>
            </select>
            <label className="block text-[11px] uppercase tracking-wide text-slate-400 mb-1">Details</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="What happened? Include links if relevant."
              className="w-full mb-3 bg-[#0A0E1A] border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600"
            />
            {error && <div className="mb-3 text-[11px] text-red-400">{error}</div>}
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 text-sm">Cancel</button>
              <button
                onClick={submit}
                disabled={submitting || reason.length < 4}
                className="px-4 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 text-sm font-semibold disabled:opacity-50"
              >
                {submitting ? 'Sending…' : 'Submit report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
