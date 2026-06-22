'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight, X } from 'lucide-react';
import { useFocusTrap } from '@/lib/a11y/useFocusTrap';

/**
 * Naka ⌘K command palette. Linear / Notion / Vercel-style global
 * action search — keyboard shortcut Cmd+K / Ctrl+K opens it on any
 * page. Items are statically declared per-section; future iteration
 * (audit §5.10 / B.14) wires dynamic results (token search, whale
 * lookup, recent context-feed events) via a passed `query` callback.
 *
 * Zero dep. Headless-UI shape (overlay + portalless dialog) so we
 * don't pull cmdk for what is a 100-line component.
 */

export interface CommandItem {
  id: string;
  label: string;
  group?: string;
  hint?: string;
  href?: string;
  onSelect?: () => void;
}

const DEFAULT_ITEMS: CommandItem[] = [
  // Navigation
  { id: 'go-dashboard',  label: 'Dashboard',     group: 'Navigation', href: '/dashboard' },
  { id: 'go-market',     label: 'Market',         group: 'Navigation', href: '/dashboard/market' },
  { id: 'go-portfolio',  label: 'Portfolio',     group: 'Navigation', href: '/dashboard/portfolio' },
  { id: 'go-whales',     label: 'Whale tracker',  group: 'Navigation', href: '/dashboard/whales' },
  { id: 'go-clusters',   label: 'Wallet clusters', group: 'Navigation', href: '/dashboard/clusters' },
  { id: 'go-sniper',     label: 'Sniper bot',     group: 'Navigation', href: '/dashboard/sniper' },
  { id: 'go-vtx',        label: 'VTX Agent',     group: 'Navigation', href: '/dashboard/vtx-ai' },
  { id: 'go-alerts',     label: 'Alerts',         group: 'Navigation', href: '/dashboard/alerts' },
  // Actions
  { id: 'act-swap',      label: 'Open swap',       group: 'Actions',   href: '/dashboard/swap' },
  { id: 'act-research',  label: 'Open research',   group: 'Actions',   href: '/research' },
  { id: 'act-settings',  label: 'Open settings',  group: 'Actions',   href: '/dashboard/settings' },
  { id: 'act-cult',      label: 'NakaCult',       group: 'Actions',   href: '/naka-cult' },
  // Account
  { id: 'acct-profile',  label: 'Profile',         group: 'Account',   href: '/dashboard/profile' },
  { id: 'acct-docs',     label: 'Docs',            group: 'Account',   href: '/docs' },
];

export interface CommandPaletteProps {
  items?: CommandItem[];
  /** Override the default Cmd+K trigger. */
  hotkey?: string;
}

function isHotkey(e: KeyboardEvent, key: string): boolean {
  return (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === key.toLowerCase();
}

export function CommandPalette({ items = DEFAULT_ITEMS, hotkey = 'k' }: CommandPaletteProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(open, () => setOpen(false));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isHotkey(e, hotkey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hotkey, open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      // Defer focus so the input mounts first.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.label.toLowerCase().includes(q) || i.group?.toLowerCase().includes(q));
  }, [items, query]);

  const select = (item: CommandItem) => {
    setOpen(false);
    if (item.onSelect) item.onSelect();
    else if (item.href) router.push(item.href);
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-[250] flex items-start justify-center pt-[15vh] px-4 bg-black/60 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        ref={trapRef}
        className="w-full max-w-xl rounded-2xl bg-[#0F1320] border border-white/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 border-b border-white/10">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, filtered.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === 'Enter' && filtered[active]) {
                e.preventDefault();
                select(filtered[active]);
              }
            }}
            placeholder="Jump to anything…"
            className="flex-1 bg-transparent py-3.5 text-sm placeholder-slate-500 focus:outline-none"
          />
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded hover:bg-white/[0.06] text-slate-500"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-slate-500">No matches.</div>
          ) : (
            filtered.map((item, i) => (
              <button
                key={item.id}
                onMouseEnter={() => setActive(i)}
                onClick={() => select(item)}
                className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-start text-sm transition-colors ${i === active ? 'bg-white/[0.05]' : 'hover:bg-white/[0.03]'}`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span className="text-slate-200 truncate">{item.label}</span>
                  {item.group ? (
                    <span className="text-[10px] uppercase tracking-wider text-slate-500">{item.group}</span>
                  ) : null}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              </button>
            ))
          )}
        </div>
        <div className="px-4 py-2 border-t border-white/10 text-[10px] text-slate-500 flex items-center gap-3">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
