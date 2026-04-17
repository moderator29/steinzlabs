'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, X, Loader2, MessageCircle, ChevronDown } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

const CATEGORIES = ['Account', 'Wallet', 'Trading', 'Features', 'Billing', 'Bug Report'];

interface Props {
  onClose?: () => void;
}

export function AISupportChat({ onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: text, timestamp: Date.now() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    const assistantMsg: Message = { role: 'assistant', content: '', timestamp: Date.now() };
    setMessages(prev => [...prev, assistantMsg]);

    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) throw new Error('Support service unavailable');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                accumulated += parsed.text;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { ...updated[updated.length - 1], content: accumulated };
                  return updated;
                });
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: 'Sorry, I could not connect to support right now. Please try again or email support@nakalabs.com.',
        };
        return updated;
      });
      console.error('[AISupportChat] Error:', err instanceof Error ? err.message : err);
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = (cat: string) => {
    setCategory(cat);
    sendMessage(`I need help with: ${cat}`);
  };

  return (
    <div className="flex flex-col h-full bg-[#0D1117] rounded-xl border border-[#1E2433] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E2433] bg-[#141824]">
        <div className="flex items-center gap-2">
          <MessageCircle size={16} className="text-[#0A1EFF]" />
          <span className="text-white font-semibold text-sm">AI Customer Support</span>
          <span className="text-[10px] text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">Online</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={16} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="bg-[#141824] rounded-lg p-4 border border-[#1E2433]">
              <p className="text-gray-300 text-sm">
                Welcome to Naka Labs support. I can help you with questions about your account, wallet, trading features, and more.
              </p>
              <p className="text-gray-400 text-sm mt-2">What can I help you with today?</p>
            </div>
            {!category && (
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => handleCategorySelect(cat)}
                    className="text-left px-3 py-2.5 bg-[#141824] border border-[#1E2433] rounded-lg text-sm text-gray-300 hover:border-[#0A1EFF]/50 hover:text-white transition-colors"
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2.5 text-sm ${
                msg.role === 'user'
                  ? 'bg-[#0A1EFF] text-white'
                  : 'bg-[#141824] border border-[#1E2433] text-gray-300'
              }`}
            >
              {msg.content || (loading && i === messages.length - 1 ? (
                <Loader2 size={14} className="animate-spin text-gray-400" />
              ) : '')}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-4 py-3 border-t border-[#1E2433] bg-[#141824]">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
            placeholder="Type your question..."
            disabled={loading}
            className="flex-1 bg-[#0D1117] border border-[#1E2433] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/50 disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="bg-[#0A1EFF] hover:bg-[#0916CC] disabled:opacity-50 text-white px-3 py-2 rounded-lg transition-colors"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}
