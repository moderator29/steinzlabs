'use client';

import { useEffect } from 'react';
import { getCurrentLang } from '@/lib/i18n/useTranslate';

// Global DOM-walking auto-translator. Rationale: the platform has
// thousands of string literals in JSX, and wrapping every one in a
// <T> hook is a month of grunt work. Instead: when the user picks a
// language, walk the body, collect visible text nodes, batch them to
// /api/translate, swap textContent in place. A MutationObserver
// catches dynamic React renders. Original English is stashed on the
// node via a WeakMap so switching back to "en" restores it.
//
// Skips: <script>, <style>, <code>, <pre>, <input>, <textarea>,
// contenteditable, any element with [data-no-translate], and numeric-
// only strings. Results cached in localStorage per lang to survive
// reloads without re-hitting the API.

const BATCH_SIZE = 40;
const DEBOUNCE_MS = 400;
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'INPUT', 'TEXTAREA', 'NOSCRIPT', 'SVG', 'PATH']);
const NUMERIC_RE = /^[\s\d.,+\-%$€£¥₿()\/:]*$/;

type TextNodeMap = WeakMap<Text, string>;
const original: TextNodeMap = new WeakMap();
// Nodes we've just written to — the observer skips characterData
// mutations on these to avoid an infinite retranslate loop.
const justWrote = new WeakSet<Text>();

function setNodeValue(node: Text, v: string) {
  if (node.nodeValue === v) return;
  justWrote.add(node);
  node.nodeValue = v;
}

function cacheKey(lang: string) { return `naka_tx_${lang}`; }
function loadCache(lang: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(cacheKey(lang));
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function saveCache(lang: string, map: Record<string, string>) {
  try { localStorage.setItem(cacheKey(lang), JSON.stringify(map)); } catch { /* quota */ }
}

function isSkippable(node: Node): boolean {
  let el: Node | null = node.parentNode;
  while (el && el !== document.body) {
    if (el.nodeType === 1) {
      const e = el as Element;
      if (SKIP_TAGS.has(e.tagName)) return true;
      if (e.hasAttribute('data-no-translate')) return true;
      if (e.getAttribute('contenteditable') === 'true') return true;
    }
    el = el.parentNode;
  }
  return false;
}

function collectTextNodes(root: Node, out: Text[]) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const t = n.nodeValue ?? '';
      if (!t.trim() || t.trim().length < 2) return NodeFilter.FILTER_REJECT;
      if (NUMERIC_RE.test(t)) return NodeFilter.FILTER_REJECT;
      if (isSkippable(n)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let cur: Node | null;
  while ((cur = walker.nextNode())) out.push(cur as Text);
}

async function translateBatch(texts: string[], target: string): Promise<string[]> {
  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: texts, target }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return texts;
    const json = await res.json() as { translations?: string[] };
    return json.translations ?? texts;
  } catch { return texts; }
}

async function translateAll(target: string) {
  if (target === 'en') {
    // Restore originals
    const nodes: Text[] = [];
    collectTextNodes(document.body, nodes);
    for (const n of nodes) {
      const orig = original.get(n);
      if (orig !== undefined && n.nodeValue !== orig) setNodeValue(n, orig);
    }
    return;
  }

  const cache = loadCache(target);
  const nodes: Text[] = [];
  collectTextNodes(document.body, nodes);

  const toFetch: { node: Text; text: string }[] = [];
  for (const n of nodes) {
    const cur = n.nodeValue ?? '';
    if (!original.has(n)) original.set(n, cur);
    const key = (original.get(n) ?? cur).trim();
    if (!key) continue;
    if (cache[key]) {
      if (n.nodeValue !== cache[key]) setNodeValue(n, cache[key]);
    } else {
      toFetch.push({ node: n, text: key });
    }
  }

  // Deduplicate by text — many nodes share strings.
  const uniq = Array.from(new Set(toFetch.map((x) => x.text)));
  for (let i = 0; i < uniq.length; i += BATCH_SIZE) {
    const chunk = uniq.slice(i, i + BATCH_SIZE);
    const out = await translateBatch(chunk, target);
    chunk.forEach((src, idx) => {
      const t = out[idx] || src;
      cache[src] = t;
    });
  }
  saveCache(target, cache);

  for (const { node, text } of toFetch) {
    const t = cache[text];
    if (t && node.nodeValue !== t) setNodeValue(node, t);
  }
}

export default function AutoTranslate() {
  useEffect(() => {
    let lang = getCurrentLang();
    let pending = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // First-paint flash guard: if the user's stored language isn't
    // English, hide the body until the initial translate pass completes
    // (or a 1.5s safety timeout fires — so a slow /api/translate can't
    // leave the page blank). CSS transitions in so it's a gentle fade
    // rather than a snap.
    const flashGuardActive = lang !== 'en';
    const html = document.documentElement;
    if (flashGuardActive) {
      html.classList.add('naka-translating');
    }
    const revealPage = () => {
      html.classList.remove('naka-translating');
    };
    let safetyTimer: ReturnType<typeof setTimeout> | null = null;
    if (flashGuardActive) {
      safetyTimer = setTimeout(revealPage, 1500);
    }

    const run = (reveal = false) => {
      if (pending) return;
      pending = true;
      Promise.resolve().then(async () => {
        try { await translateAll(lang); } finally {
          pending = false;
          if (reveal) {
            if (safetyTimer) { clearTimeout(safetyTimer); safetyTimer = null; }
            revealPage();
          }
        }
      });
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => run(false), DEBOUNCE_MS);
    };

    const onLang = () => {
      lang = getCurrentLang();
      // RTL handling for Arabic
      document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
      run(false);
    };

    // Initial pass if user already has a non-en language stored.
    if (lang !== 'en') {
      document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
      // Shorter settle than before — 150ms — because we're hiding the
      // page anyway, so reducing time-to-reveal matters more than
      // waiting for subtree to stabilise.
      setTimeout(() => run(true), 150);
    }

    window.addEventListener('naka_lang_change', onLang);

    const mo = new MutationObserver((mutations) => {
      if (lang === 'en') return;
      // Filter out mutations we caused ourselves.
      let realChange = false;
      for (const m of mutations) {
        if (m.type === 'characterData') {
          const t = m.target as Text;
          if (justWrote.has(t)) { justWrote.delete(t); continue; }
          realChange = true;
          break;
        }
        if (m.type === 'childList' && (m.addedNodes.length || m.removedNodes.length)) {
          realChange = true;
          break;
        }
      }
      if (realChange) schedule();
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      window.removeEventListener('naka_lang_change', onLang);
      mo.disconnect();
      if (timer) clearTimeout(timer);
      if (safetyTimer) clearTimeout(safetyTimer);
      revealPage();
    };
  }, []);

  return null;
}
