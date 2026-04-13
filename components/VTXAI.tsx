'use client';

import { useState } from 'react';
import { Send, Bot } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function VTXAI() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm VTX AI — on-chain intelligence. Ask me anything about tokens, wallets, or smart money.",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    if (!input.trim()) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      // Call VTX AI API
      const response = await fetch('/api/vtx-ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: messages,
        }),
      });

      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (error) {
      console.error('Chat failed:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 bg-[#141824] rounded-lg shadow-2xl border border-[#1E2433] flex flex-col h-[500px]">
      {/* Header */}
      <div className="bg-[#0A1EFF] p-4 rounded-t-lg flex items-center gap-2">
        <Bot size={20} className="text-white" />
        <span className="text-white font-medium">VTX AI</span>
        <span className="ml-auto text-xs text-white/70">On-chain Intelligence</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, i) => (
          <div
            key={i}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === 'user'
                  ? 'bg-[#0A1EFF] text-white'
                  : 'bg-[#0A0E1A] text-gray-300'
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#0A0E1A] rounded-lg p-3 text-gray-400">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-[#1E2433]">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ask about any token or wallet..."
            className="flex-1 bg-[#0A0E1A] border border-[#1E2433] rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#0A1EFF]"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="bg-[#0A1EFF] hover:bg-[#0916CC] disabled:bg-gray-700 text-white p-2 rounded"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
