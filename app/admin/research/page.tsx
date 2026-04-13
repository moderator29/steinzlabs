'use client';

import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Plus, Eye, EyeOff, Trash2, Edit2, Save, X, RefreshCw, Loader2, Search, Globe } from 'lucide-react';
import { formatTimeAgo } from '@/lib/formatters';

interface ResearchPost {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  category: string;
  image_url: string | null;
  tags: string[];
  published: boolean;
  published_at: string | null;
  created_at: string;
}

const CATEGORIES = ['General', 'Analysis', 'Research', 'Report', 'Tutorial', 'News', 'DeFi', 'Security', 'On-Chain', 'Market Analysis'];

const BLANK: Omit<ResearchPost, 'id' | 'created_at'> = {
  title: '', slug: '', summary: '', content: '', category: 'General',
  image_url: null, tags: [], published: false, published_at: null,
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
}

export default function AdminResearchPage() {
  const [posts, setPosts] = useState<ResearchPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const token = () => typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('admin_token') ?? '' : '';
  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/research', { headers: { Authorization: `Bearer ${token()}` } });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setPosts(data.posts ?? []);
    } catch (e: any) {
      setError(e.message || 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm({ ...BLANK });
    setShowForm(true);
  };

  const openEdit = (post: ResearchPost) => {
    setEditing(post.id);
    setForm({
      title: post.title, slug: post.slug, summary: post.summary, content: post.content,
      category: post.category, image_url: post.image_url, tags: post.tags,
      published: post.published, published_at: post.published_at,
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const body = { ...form, slug: form.slug || slugify(form.title) };
      const isNew = !editing;
      const res = await fetch('/api/admin/research', {
        method: isNew ? 'POST' : 'PATCH',
        headers: headers(),
        body: JSON.stringify(isNew ? body : { id: editing, ...body }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Save failed');
      }
      setShowForm(false);
      setEditing(null);
      await load();
    } catch (e: any) {
      alert(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (post: ResearchPost) => {
    try {
      const res = await fetch('/api/admin/research', {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ id: post.id, published: !post.published }),
      });
      if (!res.ok) throw new Error('Failed to update');
      await load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const deletePost = async (post: ResearchPost) => {
    if (!confirm(`Delete "${post.title}"?`)) return;
    try {
      const res = await fetch(`/api/admin/research?id=${post.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error('Delete failed');
      await load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const filtered = posts.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.summary.toLowerCase().includes(q);
  });

  const published = filtered.filter(p => p.published);
  const drafts = filtered.filter(p => !p.published);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#0A1EFF]" />
            Research Labs CMS
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">{posts.length} posts · {published.length} published · {drafts.length} drafts</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-[#1E2433] rounded-lg px-3 py-1.5 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={openNew} className="flex items-center gap-2 text-xs font-semibold text-white bg-[#0A1EFF] hover:bg-[#0818CC] rounded-lg px-4 py-2 transition-colors">
            <Plus className="w-3.5 h-3.5" />
            New Post
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">{error}</div>
      )}

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search posts..."
          className="w-full bg-[#141824] border border-[#1E2433] rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#0A1EFF]/50"
        />
      </div>

      {/* Post list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-gray-600 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <BookOpen className="w-10 h-10 text-gray-700" />
          <p className="text-sm text-gray-500">{search ? 'No posts match your search' : 'No posts yet — create your first one'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(post => (
            <div key={post.id} className="bg-[#141824] border border-[#1E2433] rounded-xl p-4 flex items-center gap-4 hover:border-[#2E3443] transition-colors">
              {/* Status dot */}
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${post.published ? 'bg-emerald-400' : 'bg-gray-600'}`} />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-sm font-semibold text-white truncate">{post.title}</h3>
                  <span className="text-[10px] bg-[#0A1EFF]/15 text-[#6B7FFF] border border-[#0A1EFF]/20 px-1.5 py-0.5 rounded-full flex-shrink-0">
                    {post.category}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate">{post.summary || 'No summary'}</p>
                <p className="text-[10px] text-gray-600 mt-0.5">
                  {post.published && post.published_at
                    ? `Published ${formatTimeAgo(new Date(post.published_at))}`
                    : `Draft · Created ${formatTimeAgo(new Date(post.created_at))}`}
                  {post.slug && <span className="ml-2 opacity-60">/{post.slug}</span>}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {post.published && (
                  <a
                    href={`/dashboard/research?post=${post.id}`}
                    target="_blank"
                    className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-[#1E2433] transition-colors"
                    title="View live"
                  >
                    <Globe className="w-3.5 h-3.5" />
                  </a>
                )}
                <button
                  onClick={() => togglePublish(post)}
                  className={`p-1.5 rounded-lg transition-colors ${post.published ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-gray-500 hover:text-white hover:bg-[#1E2433]'}`}
                  title={post.published ? 'Unpublish' : 'Publish'}
                >
                  {post.published ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => openEdit(post)}
                  className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-[#1E2433] transition-colors"
                  title="Edit"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => deletePost(post)}
                  className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-[#0D1120] border border-[#1E2433] rounded-2xl flex flex-col max-h-[90vh]">
            {/* Modal header */}
            <div className="flex items-center justify-between p-5 border-b border-[#1E2433]">
              <h2 className="text-sm font-bold text-white">{editing ? 'Edit Post' : 'New Post'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value, slug: slugify(e.target.value) }))}
                  className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#0A1EFF]/50"
                  placeholder="Post title"
                />
              </div>

              {/* Slug + Category row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Slug</label>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                    className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#0A1EFF]/50"
                    placeholder="auto-generated"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Category</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#0A1EFF]/50"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Summary */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Summary</label>
                <textarea
                  value={form.summary}
                  onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
                  rows={2}
                  className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#0A1EFF]/50 resize-none"
                  placeholder="Short description shown in feed"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Content</label>
                <textarea
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  rows={10}
                  className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#0A1EFF]/50 resize-none font-mono"
                  placeholder="Full post content (markdown supported)"
                />
              </div>

              {/* Image URL + Tags row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Image URL</label>
                  <input
                    type="url"
                    value={form.image_url ?? ''}
                    onChange={e => setForm(f => ({ ...f, image_url: e.target.value || null }))}
                    className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#0A1EFF]/50"
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Tags (comma separated)</label>
                  <input
                    type="text"
                    value={form.tags.join(', ')}
                    onChange={e => setForm(f => ({ ...f, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }))}
                    className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#0A1EFF]/50"
                    placeholder="DeFi, Solana, Analysis"
                  />
                </div>
              </div>

              {/* Publish toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setForm(f => ({ ...f, published: !f.published }))}
                  className={`w-10 h-5 rounded-full transition-colors relative ${form.published ? 'bg-emerald-500' : 'bg-[#1E2433]'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.published ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm text-gray-300">{form.published ? 'Published' : 'Draft'}</span>
              </label>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 p-4 border-t border-[#1E2433]">
              <button onClick={() => setShowForm(false)} className="text-xs text-gray-400 hover:text-white px-4 py-2 rounded-lg border border-[#1E2433] hover:border-[#2E3443] transition-colors">
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving || !form.title.trim()}
                className="flex items-center gap-2 text-xs font-semibold text-white bg-[#0A1EFF] hover:bg-[#0818CC] disabled:opacity-50 px-4 py-2 rounded-lg transition-colors"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {saving ? 'Saving...' : <><Save className="w-3.5 h-3.5" />{editing ? 'Save Changes' : 'Publish Post'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
