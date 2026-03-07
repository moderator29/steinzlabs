'use client';

import { useState } from 'react';
import { MessageSquare, Search, Plus, ArrowLeft, Send, Globe, Lock, MoreVertical } from 'lucide-react';
import Link from 'next/link';

interface ChatGroup {
  id: number;
  name: string;
  members: number;
  isPublic: boolean;
  lastMessage: string;
  lastUser: string;
  time: string;
  unread: number;
  avatar: string;
  online: boolean;
}

interface Message {
  id: number;
  user: string;
  avatar: string;
  text: string;
  time: string;
  isOwn: boolean;
  reactions: { emoji: string; count: number }[];
}

const GROUPS: ChatGroup[] = [
  { id: 1, name: 'Solana Traders', members: 1247, isPublic: true, lastMessage: 'Just bought the dip', lastUser: 'SolKing', time: '2m', unread: 5, avatar: '☀️', online: true },
  { id: 2, name: 'DeFi Alpha', members: 523, isPublic: false, lastMessage: 'New farm APY 420%', lastUser: 'YieldFarmer', time: '8m', unread: 2, avatar: '💎', online: true },
  { id: 3, name: 'NFT Flippers', members: 892, isPublic: true, lastMessage: 'Floor price mooning', lastUser: 'NFTWhale', time: '15m', unread: 0, avatar: '🖼️', online: false },
  { id: 4, name: 'Builder Network', members: 234, isPublic: true, lastMessage: 'Looking for Rust dev', lastUser: 'DevDAO', time: '1h', unread: 0, avatar: '🔧', online: true },
  { id: 5, name: 'Whale Alerts', members: 3401, isPublic: true, lastMessage: 'Large transfer detected', lastUser: 'WhaleBot', time: '3m', unread: 12, avatar: '🐋', online: true },
];

const MESSAGES: Message[] = [
  { id: 1, user: 'SolanaKing', avatar: '👑', text: 'GM everyone! SOL looking bullish today 🚀', time: '10:32 AM', isOwn: false, reactions: [{ emoji: '👍', count: 12 }, { emoji: '🔥', count: 8 }] },
  { id: 2, user: 'CryptoWhale', avatar: '🐳', text: 'Just bought 10K SOL. Feels good.', time: '10:34 AM', isOwn: false, reactions: [{ emoji: '💎', count: 15 }, { emoji: '🚀', count: 9 }] },
  { id: 3, user: 'You', avatar: '🧑‍💻', text: 'Thoughts on the new DEX launching tomorrow?', time: '10:36 AM', isOwn: true, reactions: [{ emoji: '👀', count: 3 }] },
  { id: 4, user: 'DeFiDegen', avatar: '🦊', text: 'APY is crazy right now on the new pool. 200% on stables.', time: '10:38 AM', isOwn: false, reactions: [{ emoji: '🔥', count: 6 }] },
  { id: 5, user: 'SolanaKing', avatar: '👑', text: 'That DEX looks solid. Audited by CertiK. I\'m in.', time: '10:40 AM', isOwn: false, reactions: [{ emoji: '✅', count: 4 }] },
  { id: 6, user: 'You', avatar: '🧑‍💻', text: 'Good call. Gonna ape in with 500 SOL 💰', time: '10:41 AM', isOwn: true, reactions: [{ emoji: '💎', count: 7 }, { emoji: '🚀', count: 3 }] },
];

export default function MessagesPage() {
  const [activeGroupId, setActiveGroupId] = useState(1);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobile, setShowMobile] = useState<'list' | 'chat'>('list');

  const activeGroup = GROUPS.find((g) => g.id === activeGroupId)!;
  const filteredGroups = GROUPS.filter((g) =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSend = () => {
    if (!messageText.trim()) return;
    setMessageText('');
  };

  return (
    <div className="min-h-screen bg-[#0B0D14] text-white">
      <div className="px-4 pt-4 pb-2 border-b border-white/10">
        <Link href="/dashboard" className="flex items-center gap-2 text-gray-400 text-xs mb-2 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-[#00D4AA]" />
          <h1 className="text-lg font-heading font-bold">Messages</h1>
        </div>
      </div>

      <div className="flex h-[calc(100vh-80px)]">
        <div className={`${showMobile === 'list' ? 'block' : 'hidden'} md:block w-full md:w-[300px] border-r border-white/10 flex-shrink-0 overflow-y-auto`}>
          <div className="p-3">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 bg-[#111827] border border-white/10 rounded-lg px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search conversations..."
                    className="bg-transparent focus:outline-none text-xs w-full text-gray-300 placeholder-gray-500"
                  />
                </div>
              </div>
              <button className="w-8 h-8 bg-gradient-to-r from-[#00D4AA] to-[#6366F1] rounded-lg flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-2 mb-3">
              {['All', 'Groups', 'Direct', 'Unread'].map((tab) => (
                <button key={tab} className="px-2 py-1 rounded text-[10px] font-semibold bg-[#111827] text-gray-400 hover:text-white transition-colors">
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-0.5">
            {filteredGroups.map((group) => (
              <button
                key={group.id}
                onClick={() => { setActiveGroupId(group.id); setShowMobile('chat'); }}
                className={`w-full flex items-center gap-3 px-3 py-3 hover:bg-white/5 transition-colors ${
                  activeGroupId === group.id ? 'bg-[#00D4AA]/5 border-l-2 border-[#00D4AA]' : ''
                }`}
              >
                <div className="relative">
                  <div className="w-10 h-10 bg-[#1A2235] rounded-full flex items-center justify-center text-lg">
                    {group.avatar}
                  </div>
                  {group.online && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#10B981] rounded-full border-2 border-[#0B0D14]"></div>}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold truncate">{group.name}</span>
                    <span className="text-[10px] text-gray-600 flex-shrink-0">{group.time}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500 truncate">{group.lastUser}: {group.lastMessage}</span>
                    {group.unread > 0 && (
                      <span className="w-4 h-4 bg-[#00D4AA] rounded-full text-[9px] font-bold flex items-center justify-center flex-shrink-0">{group.unread}</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className={`${showMobile === 'chat' ? 'block' : 'hidden'} md:block flex-1 flex flex-col`}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <button onClick={() => setShowMobile('list')} className="md:hidden">
                <ArrowLeft className="w-4 h-4 text-gray-400" />
              </button>
              <div className="w-8 h-8 bg-[#1A2235] rounded-full flex items-center justify-center text-sm">{activeGroup.avatar}</div>
              <div>
                <div className="text-sm font-bold">{activeGroup.name}</div>
                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                  <span>{activeGroup.members.toLocaleString()} members</span>
                  {activeGroup.isPublic ? (
                    <span className="flex items-center gap-0.5 text-[#10B981]"><Globe className="w-2.5 h-2.5" /> PUBLIC</span>
                  ) : (
                    <span className="flex items-center gap-0.5 text-[#F59E0B]"><Lock className="w-2.5 h-2.5" /> PRIVATE</span>
                  )}
                </div>
              </div>
            </div>
            <button><MoreVertical className="w-4 h-4 text-gray-400" /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {MESSAGES.map((msg) => (
              <div key={msg.id} className={`flex ${msg.isOwn ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-2 max-w-[85%] ${msg.isOwn ? 'flex-row-reverse' : ''}`}>
                  <div className="w-7 h-7 bg-[#1A2235] rounded-full flex items-center justify-center text-xs flex-shrink-0">
                    {msg.avatar}
                  </div>
                  <div>
                    <div className={`flex items-center gap-2 mb-0.5 ${msg.isOwn ? 'justify-end' : ''}`}>
                      <span className="text-[10px] font-semibold">{msg.user}</span>
                      <span className="text-[9px] text-gray-600">{msg.time}</span>
                    </div>
                    <div className={`rounded-2xl px-3 py-2 text-xs leading-relaxed ${msg.isOwn ? 'bg-gradient-to-r from-[#00D4AA]/20 to-[#6366F1]/20 border border-[#00D4AA]/20' : 'bg-[#1A2235]'}`}>
                      {msg.text}
                    </div>
                    {msg.reactions.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {msg.reactions.map((r, i) => (
                          <button key={i} className="px-1.5 py-0.5 bg-[#111827] rounded-full text-[9px] hover:bg-white/10 transition-colors">
                            {r.emoji} {r.count}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-white/10">
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-[#111827] border border-white/10 rounded-xl px-3 py-2">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Type a message..."
                  className="bg-transparent focus:outline-none text-xs w-full text-gray-300 placeholder-gray-500"
                />
              </div>
              <button
                onClick={handleSend}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                  messageText.trim() ? 'bg-gradient-to-r from-[#00D4AA] to-[#6366F1] hover:scale-105' : 'bg-[#111827] cursor-not-allowed'
                }`}
                disabled={!messageText.trim()}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
