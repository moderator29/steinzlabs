'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Menu, X, ChevronRight, ExternalLink } from 'lucide-react';
import { DocsSidebar, DOC_SECTIONS } from '@/components/docs/DocsSidebar';
import GlobalControls from '@/components/GlobalControls';
import { DocsSection01 } from '@/components/docs/DocsSection01';
import { DocsSection02 } from '@/components/docs/DocsSection02';
import { DocsSection03 } from '@/components/docs/DocsSection03';
import { DocsSection04 } from '@/components/docs/DocsSection04';
import { DocsSection05 } from '@/components/docs/DocsSection05';
import { DocsSection06 } from '@/components/docs/DocsSection06';
import { DocsSection07 } from '@/components/docs/DocsSection07';
import { DocsSection08 } from '@/components/docs/DocsSection08';
import { DocsSection09 } from '@/components/docs/DocsSection09';
import { DocsSection10 } from '@/components/docs/DocsSection10';
import { DocsSection11 } from '@/components/docs/DocsSection11';
import { DocsSection12 } from '@/components/docs/DocsSection12';
import { DocsSection13 } from '@/components/docs/DocsSection13';

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('getting-started');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const allIds = DOC_SECTIONS.flatMap(s => [
      s.id,
      ...(s.subsections?.map(sub => sub.id) ?? []),
    ]);

    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActiveSection(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 },
    );

    allIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const currentLabel = DOC_SECTIONS.find(s =>
    s.id === activeSection || s.subsections?.some(sub => sub.id === activeSection)
  )?.label ?? 'Documentation';

  return (
    <div className="min-h-screen bg-[#080C18] text-white">
      {/* Top Nav — clean single-row layout on all sizes.
          Mobile: hamburger + compact "NAKA Docs" title + Open App only
                  (toggles live inside the sidebar drawer to avoid overflow).
          Desktop: full label + Back link + toggle cluster + Whitepaper + Open App. */}
      <div className="sticky top-0 z-40 bg-[#080C18]/98 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              className="lg:hidden p-2 rounded-lg hover:bg-white/[0.06] transition-colors flex-shrink-0"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5 text-gray-400" />
            </button>
            <Link href="/" className="hidden sm:flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm flex-shrink-0">
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </Link>
            <span className="hidden sm:block w-px h-4 bg-white/[0.08] flex-shrink-0" />
            <div className="flex items-center gap-1.5 min-w-0">
              <BookOpen className="w-4 h-4 text-[#0A1EFF] flex-shrink-0" />
              <span className="text-sm font-semibold text-white whitespace-nowrap truncate">
                <span className="hidden sm:inline">NAKA LABS Docs</span>
                <span className="sm:hidden">Docs</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <GlobalControls className="hidden sm:flex" />
            <Link href="/whitepaper" className="hidden lg:flex text-xs text-gray-400 hover:text-white transition-colors px-3 py-1.5 border border-white/[0.08] rounded-lg hover:border-white/[0.15]">
              Whitepaper
            </Link>
            <Link href="/dashboard" className="text-xs bg-[#0A1EFF] hover:bg-[#0818CC] text-white px-3 py-1.5 rounded-lg transition-colors font-semibold whitespace-nowrap">
              Open App
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-[#0D1117] border-r border-white/[0.06] overflow-y-auto">
            <div className="flex items-center justify-between px-4 h-14 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#0A1EFF]" />
                <span className="text-sm font-semibold">Documentation</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-white/[0.06]">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="p-4">
              <DocsSidebar
                activeSection={activeSection}
                onSectionClick={() => setMobileOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 lg:py-12 lg:flex lg:gap-12">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-60 flex-shrink-0">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">
            <DocsSidebar activeSection={activeSection} />
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 max-w-3xl">
          <div className="mb-10 pb-8 border-b border-white/[0.06]">
            <div className="inline-flex items-center gap-2 bg-[#0A1EFF]/10 border border-[#0A1EFF]/20 rounded-full px-3 py-1 text-xs text-[#0A1EFF] font-semibold mb-4">
              <BookOpen className="w-3 h-3" />
              Platform Documentation
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">NAKA LABS</h1>
            <p className="text-gray-400 text-sm sm:text-base leading-relaxed max-w-2xl">
              The complete reference for every feature in NAKA LABS — your institutional-grade on-chain intelligence operating system. Navigate using the menu to explore any section.
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              {['Intelligence', 'Security', 'Trading', 'Portfolio', 'AI'].map(tag => (
                <span key={tag} className="text-[10px] px-2 py-0.5 bg-white/[0.05] border border-white/[0.08] rounded-full text-gray-400">{tag}</span>
              ))}
            </div>
          </div>

          <DocsSection01 />
          <DocsSection02 />
          <DocsSection03 />
          <DocsSection04 />
          <DocsSection05 />
          <DocsSection06 />
          <DocsSection07 />
          <DocsSection08 />
          <DocsSection09 />
          <DocsSection10 />
          <DocsSection11 />
          <DocsSection12 />
          <DocsSection13 />

          <div className="mt-16 pt-8 border-t border-white/[0.06]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <span className="text-xs text-gray-600">&copy; 2026 NAKA LABS. All rights reserved.</span>
              <div className="flex items-center gap-4">
                <Link href="/whitepaper" className="flex items-center gap-1 text-xs text-[#0A1EFF] hover:text-[#0A1EFF]/80 transition-colors">
                  <ExternalLink className="w-3 h-3" />View Whitepaper
                </Link>
                <Link href="/dashboard" className="text-xs text-gray-400 hover:text-white transition-colors">Open App</Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
