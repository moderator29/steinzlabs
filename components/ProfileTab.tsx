'use client';

import { User, Award, BarChart3, Bell, Shield, Settings, HelpCircle, LogOut, ChevronRight, Lock } from 'lucide-react';

export default function ProfileTab() {
  return (
    <div>
      <div className="flex flex-col items-center mb-6">
        <div className="w-20 h-20 bg-[#1A2235] rounded-full flex items-center justify-center mb-3 border-2 border-white/10">
          <User className="w-10 h-10 text-gray-500" />
        </div>
        <h2 className="text-lg font-heading font-bold">Guest User</h2>
        <p className="text-xs text-gray-400">Connect wallet to unlock features</p>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-6">
        <div className="glass rounded-lg p-3 text-center border border-white/10">
          <div className="text-lg font-bold">0</div>
          <div className="text-[10px] text-gray-400">Predictions</div>
        </div>
        <div className="glass rounded-lg p-3 text-center border border-white/10">
          <div className="text-lg font-bold">0%</div>
          <div className="text-[10px] text-gray-400">Win Rate</div>
        </div>
        <div className="glass rounded-lg p-3 text-center border border-white/10">
          <div className="text-lg font-bold">0</div>
          <div className="text-[10px] text-gray-400">Points</div>
        </div>
      </div>

      <SectionLabel>Activity</SectionLabel>
      <ProfileRow icon={Award} label="Achievements" sub="Track your progress" />
      <ProfileRow icon={BarChart3} label="Analytics" sub="View your stats" />

      <SectionLabel>Settings</SectionLabel>
      <ProfileRow icon={Bell} label="Notifications" sub="Manage alerts" />
      <ProfileRow icon={Lock} label="Security" sub="Protect your account" />
      <ProfileRow icon={Settings} label="Preferences" sub="App settings" />

      <SectionLabel>Support</SectionLabel>
      <ProfileRow icon={HelpCircle} label="Help Center" sub="FAQs & support" />

      <button className="flex items-center gap-3 w-full px-3 py-3 mt-2 text-[#EF4444] text-sm hover:bg-white/5 rounded-lg transition-colors">
        <LogOut className="w-4 h-4" />
        <span className="font-semibold">Sign Out</span>
      </button>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 mb-2">
      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">{children}</span>
    </div>
  );
}

function ProfileRow({ icon: Icon, label, sub }: { icon: React.ElementType; label: string; sub: string }) {
  return (
    <button className="flex items-center gap-3 w-full px-3 py-3 hover:bg-white/5 rounded-lg transition-colors border-b border-white/5">
      <Icon className="w-4 h-4 text-[#00E5FF] flex-shrink-0" />
      <div className="flex-1 text-left">
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-[10px] text-gray-500">{sub}</div>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-600" />
    </button>
  );
}
