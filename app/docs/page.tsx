'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield, Brain, Zap, Globe, Code, Search, BookOpen, Lock, TrendingUp } from 'lucide-react';
import { DocsSidebar, DOC_SECTIONS } from '@/components/docs/DocsSidebar';
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

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('getting-started');

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

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white">
      {/* Top Nav */}
      <div className="sticky top-0 z-20 bg-[#0A0E1A]/95 backdrop-blur border-b border-[#1E2433]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
            <span className="text-[#1E2433]">|</span>
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#0A1EFF]" />
              <span className="text-sm font-semibold text-white">STEINZ LABS Docs</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/whitepaper" className="text-xs text-gray-400 hover:text-white transition-colors px-3 py-1.5 border border-[#1E2433] rounded-lg hover:border-[#2E3443]">
              Whitepaper
            </Link>
            <Link href="/dashboard" className="text-xs bg-[#0A1EFF] hover:bg-[#0818CC] text-white px-3 py-1.5 rounded-lg transition-colors font-medium">
              Open App
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10 flex gap-10">
        <DocsSidebar activeSection={activeSection} />

        {/* Main Content */}
        <main className="flex-1 min-w-0 max-w-3xl">
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 bg-[#0A1EFF]/10 border border-[#0A1EFF]/20 rounded-full px-3 py-1 text-xs text-[#0A1EFF] font-medium mb-4">
              <BookOpen className="w-3 h-3" />
              Developer Documentation
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">STEINZ LABS Documentation</h1>
            <p className="text-gray-400 text-sm leading-relaxed">
              Complete reference for every feature, API, and integration. Use the sidebar to navigate sections.
            </p>
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

          <div className="mt-12 pt-8 border-t border-[#1E2433] flex items-center justify-between text-xs text-gray-600">
            <span>&copy; 2026 STEINZ LABS. All rights reserved.</span>
            <Link href="/whitepaper" className="text-[#0A1EFF] hover:text-[#0A1EFF]/80 transition-colors">View Whitepaper</Link>
          </div>
        </main>
      </div>
    </div>
  );
}
