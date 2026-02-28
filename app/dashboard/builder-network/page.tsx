'use client';

import { Building2, ArrowLeft, Search, CheckCircle, Globe, Users, Code, Star, MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function BuilderNetworkPage() {
  const router = useRouter();
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  const builders = [
    { name: 'Alex Chen', role: 'Full-Stack Dev', skills: ['Solidity', 'React', 'Node.js'], rating: 4.9, projects: 12, verified: true, available: true },
    { name: 'Sarah Kim', role: 'Smart Contract Auditor', skills: ['Solidity', 'Vyper', 'Security'], rating: 4.8, projects: 28, verified: true, available: true },
    { name: 'Marcus Johnson', role: 'DeFi Protocol Engineer', skills: ['Rust', 'Solana', 'Anchor'], rating: 4.7, projects: 8, verified: true, available: false },
    { name: 'Priya Patel', role: 'Frontend Developer', skills: ['React', 'Next.js', 'TypeScript'], rating: 4.6, projects: 15, verified: false, available: true },
    { name: 'David Liu', role: 'Blockchain Architect', skills: ['Cosmos SDK', 'Go', 'Rust'], rating: 4.9, projects: 6, verified: true, available: true },
    { name: 'Emma Wilson', role: 'UI/UX Designer', skills: ['Figma', 'Web3 UX', 'Branding'], rating: 4.5, projects: 22, verified: true, available: true },
  ];

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      <div className="sticky top-0 z-40 glass backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Building2 className="w-5 h-5 text-[#00E5FF]" />
          <h1 className="text-sm font-heading font-bold">Builder Network</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2 bg-[#111827] border border-white/10 rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-gray-500" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search builders..." className="bg-transparent focus:outline-none text-xs w-full text-gray-300 placeholder-gray-500" />
        </div>

        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {['All', 'Available', 'Verified', 'Developers', 'Auditors', 'Designers'].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap ${filter === f ? 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white' : 'bg-[#111827] text-gray-400'}`}>
              {f}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {builders.map((builder) => (
            <div key={builder.name} className="glass rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#00E5FF]/20 to-[#7C3AED]/20 rounded-full flex items-center justify-center text-xs font-bold">
                    {builder.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <div className="text-xs font-bold flex items-center gap-1">
                      {builder.name}
                      {builder.verified && <CheckCircle className="w-3 h-3 text-[#00E5FF]" />}
                    </div>
                    <div className="text-[10px] text-gray-500">{builder.role}</div>
                  </div>
                </div>
                <div className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${builder.available ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-gray-500/20 text-gray-500'}`}>
                  {builder.available ? 'Available' : 'Busy'}
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {builder.skills.map((skill) => (
                  <span key={skill} className="px-1.5 py-0.5 bg-[#111827] rounded text-[9px] text-gray-400">{skill}</span>
                ))}
              </div>
              <div className="flex items-center gap-4 text-[10px] text-gray-500">
                <span className="flex items-center gap-0.5"><Star className="w-3 h-3 text-[#F59E0B]" /> {builder.rating}</span>
                <span className="flex items-center gap-0.5"><Code className="w-3 h-3" /> {builder.projects} projects</span>
                <button className="ml-auto flex items-center gap-0.5 text-[#00E5FF] font-semibold">
                  <MessageSquare className="w-3 h-3" /> Contact
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
