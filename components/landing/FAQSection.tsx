'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { FAQS } from './FAQData';

function FAQItem({ q, a, defaultOpen = false }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)' }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
        aria-expanded={open}
      >
        <span className="text-white font-semibold text-sm md:text-base leading-snug">{q}</span>
        <ChevronDown
          className="w-5 h-5 flex-shrink-0 text-white/40 transition-transform duration-300"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: open ? '500px' : '0px' }}
      >
        <div className="px-6 pb-6">
          <div className="h-px w-full mb-5" style={{ background: 'rgba(255,255,255,.08)' }} />
          <p className="text-white/60 text-sm leading-relaxed">{a}</p>
        </div>
      </div>
    </div>
  );
}

export function FAQSection() {
  return (
    <section id="faq" className="max-w-4xl mx-auto px-5 py-24">
      <motion.div className="text-center mb-16"
        initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.5 }}>
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4 text-sm font-semibold"
          style={{ background: 'rgba(10,30,255,.1)', border: '1px solid rgba(10,30,255,.3)', color: '#6d85ff' }}
        >
          FAQ
        </div>
        <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Common questions</h2>
        <p className="text-white/50 max-w-xl mx-auto">Everything you need to know about Steinz Labs.</p>
      </motion.div>

      <div className="flex flex-col gap-3">
        {FAQS.map((faq, i) => (
          <motion.div key={faq.q}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.4, delay: i * 0.03 }}>
            <FAQItem q={faq.q} a={faq.a} defaultOpen={i === 0} />
          </motion.div>
        ))}
      </div>
    </section>
  );
}
