'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Inline autocomplete for the Wire composer textarea.
 *
 * Watches the caret, isolates the "active token" (the run of non-space
 * characters ending at the caret) and, when it starts with `$` (a cashtag) or
 * `@` (a mention), queries the one shared search endpoint
 * `/api/coins/search?q=<term>` and exposes the matching coins or people for a
 * dropdown. Selecting an item rewrites that token in place with `$SYMBOL ` or
 * `@username ` and drops the caret just after it. Real data only: when nothing
 * matches, the menu stays closed rather than showing an empty box.
 */

export interface CoinHit {
  chain: string;
  tokenAddress: string;
  tokenKey?: string;
  symbol: string;
  name: string;
  logoUrl: string | null;
  marketCapUsd: number | null;
  verified: boolean;
}

export interface PersonHit {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  verified: boolean;
}

type Kind = 'coin' | 'person';

interface ActiveToken {
  start: number;
  end: number;
  kind: Kind;
  term: string;
}

const MAX_ITEMS = 6;
const DEBOUNCE_MS = 200;

/** Isolate the token ending at the caret and classify it as a cashtag/mention. */
function detectToken(value: string, caret: number): ActiveToken | null {
  let start = caret;
  while (start > 0 && !/\s/.test(value[start - 1])) start--;
  // Extend forward to the end of the token so editing mid-token (caret after
  // "$WI" in "$WIF") still matches and replaces the WHOLE token, not a prefix.
  let end = caret;
  while (end < value.length && !/\s/.test(value[end])) end++;
  const raw = value.slice(start, end);
  const coin = /^\$([A-Za-z0-9]+)$/.exec(raw);
  if (coin) return { start, end, kind: 'coin', term: coin[1] };
  const person = /^@(\w+)$/.exec(raw);
  if (person) return { start, end, kind: 'person', term: person[1] };
  return null;
}

export function useWireAutocomplete(body: string, setBody: (next: string) => void) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [token, setToken] = useState<ActiveToken | null>(null);
  const [coins, setCoins] = useState<CoinHit[]>([]);
  const [people, setPeople] = useState<PersonHit[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const pendingCaret = useRef<number | null>(null);

  // Apply a caret move requested by an item selection, once, after the DOM
  // reflects the new body text.
  useLayoutEffect(() => {
    if (pendingCaret.current != null && textareaRef.current) {
      const pos = pendingCaret.current;
      pendingCaret.current = null;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(pos, pos);
    }
  });

  // If the body changes out from under a live token (submit clears it, AI draft
  // rewrites it), drop the menu so it never points at stale text.
  useEffect(() => {
    if (token && body.slice(token.start, token.end) !== `${token.kind === 'coin' ? '$' : '@'}${token.term}`) {
      setToken(null);
    }
  }, [body, token]);

  // Debounced fetch against the shared search endpoint. One request per token,
  // aborted if the token changes before it resolves.
  useEffect(() => {
    if (!token) {
      setCoins([]);
      setPeople([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/coins/search?q=${encodeURIComponent(token.term)}`, { signal: ctrl.signal });
        if (!res.ok) return;
        const data = (await res.json()) as { coins?: CoinHit[]; people?: PersonHit[] };
        if (token.kind === 'coin') {
          setCoins((data.coins ?? []).slice(0, MAX_ITEMS));
          setPeople([]);
        } else {
          setPeople((data.people ?? []).filter((p) => p.username).slice(0, MAX_ITEMS));
          setCoins([]);
        }
        setActiveIndex(0);
      } catch {
        /* aborted or offline: leave the menu closed, never invent results */
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [token]);

  const kind = token?.kind ?? null;
  const items = kind === 'coin' ? coins : kind === 'person' ? people : [];
  const open = token != null && items.length > 0;

  const selectItem = useCallback(
    (index: number) => {
      if (!token) return;
      const item = kind === 'coin' ? coins[index] : people[index];
      if (!item) return;
      const insert =
        kind === 'coin'
          ? `$${(item as CoinHit).symbol} `
          : `@${(item as PersonHit).username} `;
      const next = body.slice(0, token.start) + insert + body.slice(token.end);
      pendingCaret.current = token.start + insert.length;
      setBody(next);
      setToken(null);
    },
    [body, coins, people, kind, token, setBody],
  );

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setBody(value);
      setToken(detectToken(value, e.target.selectionStart ?? value.length));
    },
    [setBody],
  );

  // Recompute the active token whenever the caret moves (arrows, click, tap).
  const onSelect = useCallback((e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    setToken(detectToken(el.value, el.selectionStart ?? el.value.length));
  }, []);

  // Menu-owned keys while open: navigate, select, dismiss. Returns true when it
  // consumed the event so the composer skips its Cmd/Ctrl+Enter submit + newline.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (!open) return false;
      const count = items.length;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % count);
        return true;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + count) % count);
        return true;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        selectItem(activeIndex);
        return true;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setToken(null);
        return true;
      }
      return false;
    },
    [open, items.length, activeIndex, selectItem],
  );

  return {
    textareaRef,
    onChange,
    onSelect,
    handleKeyDown,
    menu: { open, kind, coins, people, activeIndex },
    setActiveIndex,
    selectItem,
  };
}
