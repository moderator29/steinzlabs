'use client';

import { useState, useEffect } from 'react';
import { Rocket, ArrowLeft, Clock, Users, DollarSign, TrendingUp, CheckCircle, Zap, ExternalLink, Loader2, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface LaunchProject {
  id: string;
  name: string;
  description: string;
  category: string;
  chain: string;
  goal: number;
  raised: number;
  builderName: string;
  verified: boolean;
  daysLeft: number;
  status: string;
  investors: number;
  tags: string[];
  website: string;
  milestones: { name: string; status: string }[];
}

interface Stats {
  totalRaised: number;
  totalProjects: number;
  totalInvestors: number;
  activeProjects: number;
}

export default function LaunchpadPage() {
  const router = useRouter();
  const [filter, setFilter] = useState('All');
  const [projects, setProjects] = useState<LaunchProject[]>([]);
  const [stats, setStats] = useState<Stats>({ totalRaised: 0, totalProjects: 0, totalInvestors: 0, activeProjects: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/builder-submissions?type=projects&status=all');
      const data = await res.json();
      setProjects(data.projects || []);
      if (data.stats) setStats(data.stats);
    } catch (err) {
      console.error('Failed to fetch launchpad data:', err);
    } finally {
      setLoading(false);
    }
  };

  const statusColor = (status: string) => {
    if (status === 'active') return 'bg-[#10B981]/20 text-[#10B981]';
    if (status === 'funded' || status === 'completed') return 'bg-[#00E5FF]/20 text-[#00E5FF]';
    if (status === 'pending') return 'bg-[#F59E0B]/20 text-[#F59E0B]';
    return 'bg-gray-500/20 text-gray-500';
  };

  const statusLabel = (status: string) => {
    if (status === 'active') return 'Live';
    if (status === 'funded') return 'Funded';
    if (status === 'completed') return 'Completed';
    if (status === 'pending') return 'Upcoming';
    return status;
  };

  const filtered = projects.filter(p => {
    if (filter === 'All') return true;
    if (filter === 'Live') return p.status === 'active';
    if (filter === 'Upcoming') return p.status === 'pending';
    if (filter === 'Funded') return p.status === 'funded' || p.status === 'completed';
    return true;
  });

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      <div className="sticky top-0 z-40 glass backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Rocket className="w-5 h-5 text-[#00E5FF]" />
          <h1 className="text-sm font-heading font-bold">Launchpad</h1>
          <span className="ml-auto px-2 py-0.5 bg-[#10B981]/20 text-[#10B981] rounded text-[10px] font-semibold">Milestone-Gated</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="glass rounded-xl p-4 border border-[#00E5FF]/20 bg-gradient-to-r from-[#00E5FF]/5 to-[#7C3AED]/5">
          <h2 className="text-sm font-bold mb-1">STEINZ Milestone-Gated Launchpad</h2>
          <p className="text-[11px] text-gray-400 leading-relaxed mb-3">
            Every project is verified, every milestone is enforced, and every investor is protected. Funds release only when builders deliver.
          </p>
          <Link href="/dashboard/builder-funding" className="inline-flex items-center gap-1 text-[11px] text-[#00E5FF] font-semibold hover:underline">
            Apply to Launch <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div className="glass rounded-xl p-3 border border-white/10 text-center">
            <div className="text-lg font-bold text-[#10B981]">${(stats.totalRaised / 1000).toFixed(0)}K</div>
            <div className="text-[10px] text-gray-500">Total Raised</div>
          </div>
          <div className="glass rounded-xl p-3 border border-white/10 text-center">
            <div className="text-lg font-bold text-[#00E5FF]">{stats.totalProjects}</div>
            <div className="text-[10px] text-gray-500">Projects</div>
          </div>
          <div className="glass rounded-xl p-3 border border-white/10 text-center">
            <div className="text-lg font-bold text-[#7C3AED]">{stats.activeProjects}</div>
            <div className="text-[10px] text-gray-500">Active</div>
          </div>
          <div className="glass rounded-xl p-3 border border-white/10 text-center">
            <div className="text-lg font-bold text-[#F59E0B]">{stats.totalInvestors}</div>
            <div className="text-[10px] text-gray-500">Investors</div>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {['All', 'Live', 'Upcoming', 'Funded'].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap ${filter === f ? 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white' : 'bg-[#111827] text-gray-400'}`}>
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-[#00E5FF] mx-auto mb-3 animate-spin" />
            <p className="text-sm text-gray-400">Loading projects...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((project) => {
              const pct = project.goal > 0 ? Math.round((project.raised / project.goal) * 100) : 0;
              const completedMilestones = project.milestones?.filter(m => m.status === 'completed').length || 0;
              const totalMilestones = project.milestones?.length || 0;

              return (
                <div key={project.id} className="glass rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-gradient-to-br from-[#00E5FF]/20 to-[#7C3AED]/20 rounded-lg flex items-center justify-center relative">
                        <span className="text-xs font-bold">{project.name.charAt(0)}</span>
                        {project.verified && <img src="/verified-badge.png" alt="Verified" className="absolute -bottom-1 -right-1 w-4 h-4" />}
                      </div>
                      <div>
                        <div className="text-xs font-bold flex items-center gap-1.5">
                          {project.name}
                        </div>
                        <div className="text-[10px] text-gray-500">{project.description.slice(0, 50)}...</div>
                      </div>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${statusColor(project.status)}`}>
                      {statusLabel(project.status)}
                    </span>
                  </div>

                  <div className="mb-2">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-gray-500">${project.raised.toLocaleString()} / ${project.goal.toLocaleString()}</span>
                      <span className="font-semibold text-[#00E5FF]">{pct}%</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div className="h-2 rounded-full bg-gradient-to-r from-[#00E5FF] to-[#7C3AED]" style={{ width: `${Math.min(pct, 100)}%` }}></div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-[10px] text-gray-500">
                    <span className="flex items-center gap-0.5"><Users className="w-3 h-3" /> {project.investors}</span>
                    <span>{project.chain}</span>
                    <span>{project.category}</span>
                    {totalMilestones > 0 && <span>{completedMilestones}/{totalMilestones} milestones</span>}
                    {project.daysLeft > 0 && <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> {project.daysLeft}d</span>}
                    <Link href="/dashboard/builder-funding" className="ml-auto text-[#00E5FF] font-semibold flex items-center gap-0.5">
                      Details <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="text-center py-12">
                <Rocket className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-400">No projects in this category yet</p>
                <Link href="/dashboard/builder-funding" className="text-xs text-[#00E5FF] mt-2 inline-block hover:underline">
                  Submit your project
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
