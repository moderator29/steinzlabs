'use client';

import { useState } from 'react';
import { Copy, RotateCcw, Pencil, Check, StopCircle } from 'lucide-react';

/**
 * MessageActions — inline action row for VTX assistant + user
 * messages. Covers the audit's B.5 P1 list: copy message, copy as
 * markdown, regenerate, edit-and-resend. Stop-generation button
 * also renders here when the stream is active so the user can
 * abort without hunting for a control in the header.
 *
 * Caller owns the actions; this component is pure UI.
 */

export interface MessageActionsProps {
  text: string;
  /** True when the message is the latest assistant message + the stream is active. */
  streaming?: boolean;
  /** Called when the user hits 'copy as markdown' (the raw text). */
  onCopyMarkdown?: () => void;
  /** Called for 'regenerate this answer'. Assistant-only. */
  onRegenerate?: () => void;
  /** Called for 'edit & resend'. User-only. */
  onEdit?: () => void;
  /** Called for 'stop generation'. Streaming-only. */
  onStop?: () => void;
  role: 'assistant' | 'user';
}

export function MessageActions(props: MessageActionsProps) {
  const [copied, setCopied] = useState(false);

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(props.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
      {props.streaming && props.onStop ? (
        <button
          onClick={props.onStop}
          className="inline-flex items-center gap-1 text-[10px] text-amber-300 hover:text-amber-200 px-1.5 py-1 rounded hover:bg-amber-500/[0.08]"
          aria-label="Stop generation"
        >
          <StopCircle className="w-3 h-3" />
          Stop
        </button>
      ) : null}
      <button
        onClick={copyText}
        aria-label="Copy message"
        className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-white px-1.5 py-1 rounded hover:bg-white/[0.04]"
      >
        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
      {props.onCopyMarkdown ? (
        <button
          onClick={props.onCopyMarkdown}
          aria-label="Copy as markdown"
          className="text-[10px] text-slate-400 hover:text-white px-1.5 py-1 rounded hover:bg-white/[0.04]"
        >
          MD
        </button>
      ) : null}
      {props.role === 'assistant' && props.onRegenerate ? (
        <button
          onClick={props.onRegenerate}
          aria-label="Regenerate"
          className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-white px-1.5 py-1 rounded hover:bg-white/[0.04]"
        >
          <RotateCcw className="w-3 h-3" />
          Regenerate
        </button>
      ) : null}
      {props.role === 'user' && props.onEdit ? (
        <button
          onClick={props.onEdit}
          aria-label="Edit & resend"
          className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-white px-1.5 py-1 rounded hover:bg-white/[0.04]"
        >
          <Pencil className="w-3 h-3" />
          Edit
        </button>
      ) : null}
    </div>
  );
}
