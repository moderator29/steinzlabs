'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BookOpen, Plus, Eye, EyeOff, Trash2, Edit2, Save, X,
  RefreshCw, Loader2, Search, Globe, Upload, Image, FileText,
} from 'lucide-react';
import { formatTimeAgo } from '@/lib/formatters';
import { sanitizeHtml } from '@/lib/utils/sanitize';

/* ── Types ─────────────────────────────────────────────────────────────────── */

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
  scheduled_at?: string | null;
  created_at: string;
}

type EditorTab = 'write' | 'preview';

/* ── Constants ─────────────────────────────────────────────────────────────── */

const CATEGORIES = [
  'General', 'Analysis', 'Research', 'Report', 'Tutorial',
  'News', 'DeFi', 'Security', 'On-Chain', 'Market Analysis',
];

const BLANK: Omit<ResearchPost, 'id' | 'created_at'> = {
  title: '', slug: '', summary: '', content: '', category: 'General',
  image_url: null, tags: [], published: false, published_at: null, scheduled_at: null,
};

const EMOJIS = [
  '📈', '📉', '🚀', '🔥', '💎', '💰', '⚡', '🎯', '🛡️', '🔒', '🔑', '📊',
  '🐋', '🐳', '🚨', '⚠️', '✅', '❌', '🟢', '🔴', '🟠', '🟡', '🔷', '🔶',
  '🎉', '🎊', '👀', '👋', '🙏', '💡', '📌', '📎', '🧠', '🤖', '🧪', '🔮',
];

/* ── Markdown helpers ──────────────────────────────────────────────────────── */

function inlineMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong class="font-bold italic text-white">$1</strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-white">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="italic text-gray-200">$1</em>')
    .replace(/`([^`\n]+)`/g, '<code class="text-xs bg-black/40 border border-white/10 rounded px-1.5 py-0.5 font-mono text-[#7C9EFF]">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-[#0A1EFF] underline underline-offset-2" target="_blank" rel="noopener noreferrer">$1</a>');
}

function renderMarkdown(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let inCode = false;
  let codeBuf: string[] = [];

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (!inCode) { inCode = true; codeBuf = []; }
      else {
        out.push(`<pre class="bg-black/50 border border-white/10 rounded-xl p-4 overflow-x-auto my-3 text-xs font-mono text-emerald-300 whitespace-pre">${codeBuf.join('\n')}</pre>`);
        inCode = false;
      }
      continue;
    }
    if (inCode) { codeBuf.push(line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')); continue; }

    if (line.startsWith('### ')) { out.push(`<h3 class="text-base font-bold text-white mt-4 mb-1">${inlineMarkdown(line.slice(4))}</h3>`); continue; }
    if (line.startsWith('## '))  { out.push(`<h2 class="text-lg font-bold text-white mt-5 mb-2">${inlineMarkdown(line.slice(3))}</h2>`); continue; }
    if (line.startsWith('# '))   { out.push(`<h1 class="text-2xl font-bold text-white mt-6 mb-3">${inlineMarkdown(line.slice(2))}</h1>`); continue; }
    if (/^---+$/.test(line.trim())) { out.push('<hr class="border-white/10 my-4" />'); continue; }
    if (line.startsWith('> '))   { out.push(`<blockquote class="border-l-2 border-[#0A1EFF]/50 pl-4 py-1 my-2 text-gray-400 italic">${inlineMarkdown(line.slice(2))}</blockquote>`); continue; }
    if (/^[-*] /.test(line))     { out.push(`<li class="ml-5 list-disc text-gray-300 my-0.5">${inlineMarkdown(line.slice(2))}</li>`); continue; }
    if (/^\d+\. /.test(line))    { out.push(`<li class="ml-5 list-decimal text-gray-300 my-0.5">${inlineMarkdown(line.replace(/^\d+\. /, ''))}</li>`); continue; }
    if (line.trim() === '')      { out.push('<div class="my-2"></div>'); continue; }
    out.push(`<p class="text-gray-300 leading-relaxed my-1">${inlineMarkdown(line)}</p>`);
  }

  return out.join('');
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
}

/* ── Main page component ───────────────────────────────────────────────────── */

export default function AdminResearchPage() {
  const [posts, setPosts]           = useState<ResearchPost[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState<string | null>(null);
  const [form, setForm]             = useState({ ...BLANK });
  const [search, setSearch]         = useState('');
  const [error, setError]           = useState<string | null>(null);
  const [editorTab, setEditorTab]   = useState<EditorTab>('write');
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const token    = (): string => (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('admin_token') ?? '' : '');
  const authHdr  = (): Record<string, string> => ({ Authorization: `Bearer ${token()}` });
  const jsonHdrs = (): Record<string, string> => ({ 'Content-Type': 'application/json', ...authHdr() });

  /* ── Load posts ─────────────────────────────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/research', { headers: authHdr() });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as { posts: ResearchPost[] };
      setPosts(data.posts ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  /* ── Open new / edit ────────────────────────────────────────────────────── */
  const openNew = () => { setEditing(null); setForm({ ...BLANK }); setEditorTab('write'); setShowForm(true); };

  const openEdit = (post: ResearchPost) => {
    setEditing(post.id);
    setForm({ title: post.title, slug: post.slug, summary: post.summary, content: post.content,
              category: post.category, image_url: post.image_url, tags: post.tags,
              published: post.published, published_at: post.published_at });
    setEditorTab('write');
    setShowForm(true);
  };

  /* ── Save ───────────────────────────────────────────────────────────────── */
  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const body = { ...form, slug: form.slug || slugify(form.title) };
      const isNew = !editing;
      const res = await fetch('/api/admin/research', {
        method: isNew ? 'POST' : 'PATCH',
        headers: jsonHdrs(),
        body: JSON.stringify(isNew ? body : { id: editing, ...body }),
      });
      if (!res.ok) { const d = await res.json() as { error?: string }; throw new Error(d.error ?? 'Save failed'); }
      setShowForm(false);
      setEditing(null);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  /* ── Toggle publish ─────────────────────────────────────────────────────── */
  const togglePublish = async (post: ResearchPost) => {
    const res = await fetch('/api/admin/research', { method: 'PATCH', headers: jsonHdrs(),
      body: JSON.stringify({ id: post.id, published: !post.published }) });
    if (!res.ok) { alert('Failed to update'); return; }
    await load();
  };

  /* ── Delete ─────────────────────────────────────────────────────────────── */
  const deletePost = async (post: ResearchPost) => {
    if (!confirm(`Delete "${post.title}"?`)) return;
    const res = await fetch(`/api/admin/research?id=${post.id}`, { method: 'DELETE', headers: authHdr() });
    if (!res.ok) { alert('Delete failed'); return; }
    await load();
  };

  /* ── Image upload ───────────────────────────────────────────────────────── */
  const handleImageFile = async (file: File) => {
    setImageUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/research/upload', { method: 'POST', headers: authHdr(), body: fd });
      if (!res.ok) { const d = await res.json() as { error?: string }; throw new Error(d.error ?? 'Upload failed'); }
      const { url } = await res.json() as { url: string };
      setForm(f => ({ ...f, image_url: url }));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Image upload failed');
    } finally {
      setImageUploading(false);
    }
  };

  const filtered  = posts.filter(p => !search || [p.title, p.category, p.summary].some(s => s.toLowerCase().includes(search.toLowerCase())));
  const published = filtered.filter(p => p.published);
  const drafts    = filtered.filter(p => !p.published);

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#0A1EFF]" />
            Research Labs CMS
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {posts.length} posts · {published.length} published · {drafts.length} drafts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading} className="p-2 text-gray-400 hover:text-white border border-[#1E2433] rounded-lg transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={openNew} className="flex items-center gap-2 text-xs font-semibold text-white bg-[#0A1EFF] hover:bg-[#0818CC] rounded-lg px-4 py-2 transition-colors">
            <Plus className="w-3.5 h-3.5" /> New Post
          </button>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">{error}</div>}

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search posts…"
          className="w-full bg-[#141824] border border-[#1E2433] rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#0A1EFF]/50" />
      </div>

      {/* Post list */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-gray-600 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <BookOpen className="w-10 h-10 text-gray-700" />
          <p className="text-sm text-gray-500">{search ? 'No posts match your search' : 'No posts yet — create your first one'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(post => (
            <div key={post.id} className="bg-[#141824] border border-[#1E2433] rounded-xl p-4 flex items-center gap-4 hover:border-[#2E3443] transition-colors">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${post.published ? 'bg-emerald-400' : 'bg-gray-600'}`} />
              {post.image_url && <img src={post.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-white/10" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-sm font-semibold text-white truncate">{post.title}</h3>
                  <span className="text-[10px] bg-[#0A1EFF]/15 text-[#6B7FFF] border border-[#0A1EFF]/20 px-1.5 py-0.5 rounded-full flex-shrink-0">{post.category}</span>
                </div>
                <p className="text-xs text-gray-500 truncate">{post.summary || 'No summary'}</p>
                <p className="text-[10px] text-gray-600 mt-0.5">
                  {post.published && post.published_at
                    ? `Published ${formatTimeAgo(new Date(post.published_at))}`
                    : `Draft · Created ${formatTimeAgo(new Date(post.created_at))}`}
                  {post.slug && <span className="ml-2 opacity-60">/{post.slug}</span>}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {post.published && (
                  <a href={`/dashboard/research?post=${post.id}`} target="_blank"
                    className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-[#1E2433] transition-colors" title="View live">
                    <Globe className="w-3.5 h-3.5" />
                  </a>
                )}
                <button onClick={() => togglePublish(post)} title={post.published ? 'Unpublish' : 'Publish'}
                  className={`p-1.5 rounded-lg transition-colors ${post.published ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-gray-500 hover:text-white hover:bg-[#1E2433]'}`}>
                  {post.published ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => openEdit(post)} title="Edit"
                  className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-[#1E2433] transition-colors">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => deletePost(post)} title="Delete"
                  className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create / Edit modal ─────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-5xl bg-[#0D1120] border border-[#1E2433] rounded-2xl flex flex-col h-[92vh]">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E2433] flex-shrink-0">
              <h2 className="text-sm font-bold text-white">{editing ? 'Edit Post' : 'New Post'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white p-1 rounded-lg hover:bg-white/[0.06]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Two-column layout: left=fields, right=editor */}
            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row gap-0 min-h-0">

              {/* Left column — metadata fields (stacks above editor on mobile) */}
              <div className="w-full lg:w-72 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-[#1E2433] overflow-y-auto p-5 space-y-4">

                {/* Title */}
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Title *</label>
                  <input type="text" value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value, slug: slugify(e.target.value) }))}
                    className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0A1EFF]/50"
                    placeholder="Post title" />
                </div>

                {/* Slug */}
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Slug</label>
                  <input type="text" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                    className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#0A1EFF]/50"
                    placeholder="auto-generated" />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0A1EFF]/50">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Summary */}
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Summary</label>
                  <textarea value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} rows={3}
                    className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0A1EFF]/50 resize-none"
                    placeholder="Short description shown in feed" />
                </div>

                {/* Image — upload + URL */}
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Cover Image</label>
                  {/* File upload button */}
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = ''; }} />
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={imageUploading}
                    className="w-full flex items-center justify-center gap-2 border border-dashed border-[#1E2433] hover:border-[#0A1EFF]/50 rounded-xl py-3 text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-50 mb-2">
                    {imageUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {imageUploading ? 'Uploading…' : 'Upload image'}
                  </button>
                  {/* OR paste URL */}
                  <input type="url" value={form.image_url ?? ''} onChange={e => setForm(f => ({ ...f, image_url: e.target.value || null }))}
                    className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#0A1EFF]/50"
                    placeholder="…or paste URL" />
                  {form.image_url && (
                    <div className="mt-2 relative">
                      <img src={form.image_url} alt="preview" className="w-full h-28 object-cover rounded-lg border border-white/10" />
                      <button onClick={() => setForm(f => ({ ...f, image_url: null }))}
                        className="absolute top-1 right-1 p-0.5 bg-black/60 rounded-full text-white hover:bg-black/80">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Tags (comma separated)</label>
                  <input type="text" value={form.tags.join(', ')}
                    onChange={e => setForm(f => ({ ...f, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }))}
                    className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0A1EFF]/50"
                    placeholder="DeFi, Solana, Analysis" />
                </div>

                {/* Schedule (optional) */}
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Schedule publish (optional)</label>
                  <input
                    type="datetime-local"
                    value={form.scheduled_at ?? ''}
                    onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value || null }))}
                    className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#0A1EFF]/50"
                  />
                  {form.scheduled_at && (
                    <p className="text-[10px] text-amber-300/80 mt-1">
                      Saves as a draft until this time. A server worker publishes it automatically.
                    </p>
                  )}
                </div>

                {/* Publish toggle */}
                <label className="flex items-center gap-3 cursor-pointer pt-1">
                  <div onClick={() => setForm(f => ({ ...f, published: !f.published }))}
                    className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${form.published ? 'bg-emerald-500' : 'bg-[#1E2433]'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.published ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-sm text-gray-300">{form.scheduled_at ? 'Scheduled' : form.published ? 'Published' : 'Draft'}</span>
                </label>
              </div>

              {/* Right column — markdown editor */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* Write / Preview tabs */}
                <div className="flex border-b border-[#1E2433] flex-shrink-0">
                  {(['write', 'preview'] as EditorTab[]).map(tab => (
                    <button key={tab} onClick={() => setEditorTab(tab)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold capitalize transition-colors border-b-2 ${
                        editorTab === tab ? 'border-[#0A1EFF] text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                      {tab === 'write' ? <FileText className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {tab}
                    </button>
                  ))}
                  <div className="ml-auto flex items-center gap-2 px-4">
                    <EmojiPickerButton onPick={(e) => setForm(f => ({ ...f, content: f.content + e }))} />
                    <span className="text-[10px] text-gray-600">Markdown supported</span>
                  </div>
                </div>

                {/* Editor / Preview body */}
                {editorTab === 'write' ? (
                  <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                    className="flex-1 bg-[#080C18] text-sm text-gray-200 font-mono p-5 resize-none focus:outline-none leading-relaxed"
                    placeholder={'# Heading\n\nStart writing your post in **markdown**...\n\n## Section\n\nParagraph text here.\n\n```js\nconst x = 1;\n```'} />
                ) : (
                  <div className="flex-1 overflow-y-auto p-6 bg-[#080C18]">
                    {form.content
                      ? <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMarkdown(form.content)) }} />
                      : <p className="text-gray-600 text-sm italic">Nothing to preview yet.</p>}
                  </div>
                )}
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#1E2433] flex-shrink-0">
              <button onClick={() => setShowForm(false)} className="text-xs text-gray-400 hover:text-white px-4 py-2 rounded-lg border border-[#1E2433] hover:border-[#2E3443] transition-colors">
                Cancel
              </button>
              <button onClick={save} disabled={saving || !form.title.trim()}
                className="flex items-center gap-2 text-xs font-semibold text-white bg-[#0A1EFF] hover:bg-[#0818CC] disabled:opacity-50 px-5 py-2 rounded-lg transition-colors">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmojiPickerButton({ onPick }: { onPick: (e: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (!ref.current?.contains(e.target as Node)) setOpen(false); }
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-[11px] px-2 py-1 rounded-md bg-[#1E2433] hover:bg-[#2E3443] text-gray-400 hover:text-white transition-colors"
        title="Insert emoji"
      >
        😀
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-[#0e1220] border border-white/[0.08] rounded-xl p-2 shadow-2xl z-50 grid grid-cols-6 gap-1">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => { onPick(e); setOpen(false); }}
              className="w-8 h-8 flex items-center justify-center text-lg rounded-md hover:bg-white/[0.06] transition-colors"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
