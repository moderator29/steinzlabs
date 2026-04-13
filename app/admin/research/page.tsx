'use client';

import { useState } from 'react';
import { BookOpen, Plus, Eye, EyeOff, Trash2, Edit2, Save, X } from 'lucide-react';
import { formatTimeAgo } from '@/lib/formatters';

interface ResearchPost {
  id: string;
  title: string;
  slug: string;
  summary: string;
  body: string;
  category: string;
  published: boolean;
  createdAt: number;
  views: number;
}

const MOCK_POSTS: ResearchPost[] = [
  { id: '1', title: 'How Whale Clusters Predict 10x Moves', slug: 'whale-clusters-10x', summary: 'Analysis of 500+ cluster events and their price outcomes.', body: '...', category: 'Analysis', published: true, createdAt: Date.now() - 86400_000, views: 2840 },
  { id: '2', title: 'MEV on Solana: A Deep Dive', slug: 'mev-solana-deep-dive', summary: 'How Jito and Solana MEV compares to Ethereum Flashbots.', body: '...', category: 'Research', published: true, createdAt: Date.now() - 172800_000, views: 1560 },
  { id: '3', title: 'Draft: Smart Money Q2 2026 Review', slug: 'smart-money-q2-2026', summary: 'Quarterly performance review of tracked smart money wallets.', body: '...', category: 'Report', published: false, createdAt: Date.now() - 3600_000, views: 0 },
];

const CATEGORIES = ['Analysis', 'Research', 'Report', 'Tutorial', 'News'];

const BLANK: Omit<ResearchPost, 'id' | 'createdAt' | 'views'> = {
  title: '', slug: '', summary: '', body: '', category: 'Analysis', published: false,
};

export default function ResearchPage() {
  const [posts, setPosts] = useState(MOCK_POSTS);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ ...BLANK });

  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const handleTitleChange = (title: string) => {
    setForm(f => ({ ...f, title, slug: slugify(title) }));
  };

  const save = () => {
    if (!form.title.trim()) return;
    if (editing) {
      setPosts(prev => prev.map(p => p.id === editing ? { ...p, ...form } : p));
      setEditing(null);
    } else {
      setPosts(prev => [{ ...form, id: Date.now().toString(), createdAt: Date.now(), views: 0 }, ...prev]);
    }
    setForm({ ...BLANK });
    setShowForm(false);
  };

  const editPost = (post: ResearchPost) => {
    setForm({ title: post.title, slug: post.slug, summary: post.summary, body: post.body, category: post.category, published: post.published });
    setEditing(post.id);
    setShowForm(true);
  };

  const togglePublish = (id: string) => setPosts(prev => prev.map(p => p.id === id ? { ...p, published: !p.published } : p));
  const deletePost = (id: string) => setPosts(prev => prev.filter(p => p.id !== id));

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Research Posts</h1>
          <p className="text-xs text-gray-500 mt-0.5">Create and manage research articles published to users</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditing(null); setForm({ ...BLANK }); }}
          className="flex items-center gap-2 text-xs bg-[#0A1EFF] hover:bg-[#0818CC] text-white px-3 py-2 rounded-lg transition-colors font-medium">
          <Plus className="w-3.5 h-3.5" /> New Post
        </button>
      </div>

      {showForm && (
        <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">{editing ? 'Edit Post' : 'New Research Post'}</h3>
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <input value={form.title} onChange={e => handleTitleChange(e.target.value)} placeholder="Post title"
            className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40" />
          <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="URL slug"
            className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2.5 text-sm text-white font-mono placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40" />
          <textarea value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} rows={2} placeholder="Summary (shown in cards)"
            className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 resize-none" />
          <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={8} placeholder="Full article body (Markdown)..."
            className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2.5 text-sm text-white font-mono placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 resize-none" />
          <div className="flex items-center gap-3">
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.published} onChange={e => setForm(f => ({ ...f, published: e.target.checked }))} className="accent-[#0A1EFF]" />
              <span className="text-xs text-gray-300">Publish immediately</span>
            </label>
            <div className="flex-1" />
            <button onClick={save} className="flex items-center gap-2 bg-[#0A1EFF] hover:bg-[#0818CC] text-white text-xs px-4 py-2 rounded-lg font-medium transition-colors">
              <Save className="w-3.5 h-3.5" /> {editing ? 'Update' : 'Publish'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {posts.map(post => (
          <div key={post.id} className="bg-[#141824] border border-[#1E2433] rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <BookOpen className="w-4 h-4 text-[#0A1EFF] flex-shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-semibold text-white">{post.title}</span>
                    <span className="text-[10px] bg-[#1E2433] text-gray-400 px-2 py-0.5 rounded">{post.category}</span>
                    {post.published
                      ? <span className="text-[10px] text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">Published</span>
                      : <span className="text-[10px] text-gray-500 bg-gray-500/10 px-2 py-0.5 rounded-full">Draft</span>}
                  </div>
                  <p className="text-xs text-gray-400 mb-1">{post.summary}</p>
                  <div className="flex items-center gap-3 text-[10px] text-gray-500">
                    <span>{formatTimeAgo(post.createdAt)}</span>
                    <span>{post.views.toLocaleString()} views</span>
                    <span className="font-mono">/research/{post.slug}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => editPost(post)} className="text-gray-500 hover:text-white transition-colors"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => togglePublish(post.id)} className="text-gray-500 hover:text-white transition-colors">
                  {post.published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={() => deletePost(post.id)} className="text-red-500/50 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
