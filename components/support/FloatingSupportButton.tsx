'use client';

import { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { AISupportChat } from './AISupportChat';

export function FloatingSupportButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && (
        <div className="fixed bottom-20 right-4 z-[60] w-[380px] max-w-[calc(100vw-2rem)] shadow-2xl rounded-2xl overflow-hidden">
          <AISupportChat onClose={() => setOpen(false)} />
        </div>
      )}
      <button
        onClick={() => setOpen(p => !p)}
        className="fixed bottom-4 right-4 z-[60] w-14 h-14 bg-[#0A1EFF] hover:bg-[#0818CC] rounded-full shadow-lg shadow-[#0A1EFF]/30 flex items-center justify-center transition-all"
        aria-label="AI Support Chat"
      >
        {open ? <X className="w-6 h-6 text-white" /> : <MessageCircle className="w-6 h-6 text-white" />}
      </button>
    </>
  );
}
