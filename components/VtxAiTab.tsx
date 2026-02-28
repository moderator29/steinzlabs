'use client';

import { useState, useRef, useEffect } from 'react';
import { BarChart3, Briefcase, AlertTriangle, Radio, Send, Bot, User, Loader2, Trash2 } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const STORAGE_KEY = 'vtx-ai-chat-history';

function loadChatHistory(): Message[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function saveChatHistory(messages: Message[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50)));
  } catch {}
}

export default function VtxAiTab() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      const saved = loadChatHistory();
      if (saved.length > 0) setMessages(saved);
    }
  }, []);

  useEffect(() => {
    if (initialized.current && messages.length > 0) {
      saveChatHistory(messages);
    }
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const quickActions = [
    { icon: BarChart3, label: 'Market Overview', prompt: 'Give me a quick overview of the current crypto market. What are the major trends today?' },
    { icon: Briefcase, label: 'Portfolio Check', prompt: 'What are the best strategies for diversifying a crypto portfolio right now?' },
    { icon: AlertTriangle, label: 'Risk Analysis', prompt: 'What are the biggest risks in the crypto market right now? Any red flags to watch?' },
    { icon: Radio, label: 'Signal Analysis', prompt: 'What on-chain signals are showing the most bullish or bearish activity right now?' },
  ];

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    setLoading(true);

    try {
      const response = await fetch('/api/vtx-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          history: messages.slice(-10),
        }),
      });

      const data = await response.json();

      if (data.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${data.error}` }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Failed to connect to VTX AI. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(message);
  };

  return (
    <div className="flex flex-col min-h-[65vh]">
      <div className="glass rounded-xl p-3 border border-white/10 flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-gradient-to-br from-[#00E5FF]/20 to-[#7C3AED]/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-[#00E5FF]" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold">VTX AI</div>
          <div className="text-[10px] text-gray-400">Powered by Claude &bull; Live market data</div>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              title="Clear chat"
            >
              <Trash2 className="w-3.5 h-3.5 text-gray-500" />
            </button>
          )}
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-[#10B981] rounded-full animate-pulse"></div>
            <span className="text-[10px] text-[#10B981] font-semibold">Live</span>
          </div>
        </div>
      </div>

      {messages.length === 0 ? (
        <>
          <p className="text-sm text-gray-300 text-center mb-6 leading-relaxed px-2">
            Ask me anything — I search for real-time prices, trends, and on-chain data before answering. Try asking about current BTC price or market trends.
          </p>

          <div className="grid grid-cols-2 gap-2 mb-6">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  onClick={() => sendMessage(action.prompt)}
                  className="glass rounded-xl p-4 border border-white/10 hover:border-[#00E5FF]/20 transition-all text-left"
                >
                  <Icon className="w-5 h-5 text-[#00E5FF] mb-2" />
                  <div className="text-xs font-semibold">{action.label}</div>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 scrollbar-hide max-h-[50vh]">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 bg-gradient-to-br from-[#00E5FF] to-[#7C3AED] rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-[#00E5FF]/20 to-[#7C3AED]/20 border border-[#00E5FF]/20'
                  : 'glass border border-white/10'
              }`}>
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
              {msg.role === 'user' && (
                <div className="w-7 h-7 bg-[#1A2235] rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                  <User className="w-3.5 h-3.5 text-gray-400" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 bg-gradient-to-br from-[#00E5FF] to-[#7C3AED] rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="glass border border-white/10 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Searching live data...
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      <div className="mt-auto">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="flex-1 bg-[#111827] border border-white/10 rounded-xl px-4 py-3">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask VTX AI about markets, signals, risk..."
              className="bg-transparent focus:outline-none text-xs w-full text-gray-300 placeholder-gray-500"
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !message.trim()}
            className="w-10 h-10 bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] rounded-xl flex items-center justify-center hover:scale-105 transition-transform flex-shrink-0 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
