'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { FAQS } from './FAQData';

// The five questions that matter most to a first-time visitor. The full set
// still lives in FAQData (and in /docs); the landing page stays intentional.
const FEATURED_QUESTIONS = [
  'What is Naka Labs?',
  'How does the VTX Intelligence Engine work?',
  'Is my wallet data private and secure?',
  'How does the Security Center detect rug pulls?',
  'How does Naka Labs make money?',
];

const FEATURED_FAQS = FEATURED_QUESTIONS
  .map((q) => FAQS.find((f) => f.q === q))
  .filter((f): f is (typeof FAQS)[number] => Boolean(f));

function FAQItem({ q, a, defaultOpen = false }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className="rounded-2xl overflow-hidden transition-colors"
      style={{
        background: open
          ? 'linear-gradient(160deg, rgba(12,18,44,0.7) 0%, rgba(5,8,22,0.88) 100%)'
          : 'rgba(255,255,255,.025)',
        border: `1px solid ${open ? 'rgba(0,150,255,0.35)' : 'rgba(255,255,255,.07)'}`,
      }}
    >
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-4 px-5 sm:px-6 py-5 text-start"
        aria-expanded={open}
      >
        <span className="text-white font-semibold text-sm sm:text-base leading-snug">{q}</span>
        <ChevronDown
          className="w-5 h-5 flex-shrink-0 transition-transform duration-300"
          style={{ color: open ? '#3d9bff' : 'rgba(255,255,255,.4)', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: open ? '500px' : '0px' }}
      >
        <div className="px-5 sm:px-6 pb-6">
          <div className="h-px w-full mb-5" style={{ background: 'rgba(255,255,255,.08)' }} />
          <p className="text-white/60 text-sm leading-relaxed">{a}</p>
        </div>
      </div>
    </div>
  );
}

export function FAQSection() {
  return (
    <section id="faq" className="max-w-3xl mx-auto px-5 py-20 sm:py-24">
      <motion.div className="text-center mb-12"
        initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.5 }}>
        <p className="text-[11px] font-bold uppercase tracking-[0.35em] mb-4" style={{ color: '#1E90FF' }}>
          FAQ
        </p>
        <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">Common questions</h2>
      </motion.div>

      <div className="flex flex-col gap-3">
        {FEATURED_FAQS.map((faq, i) => (
          <motion.div key={faq.q}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.4, delay: i * 0.04 }}>
            <FAQItem q={faq.q} a={faq.a} defaultOpen={i === 0} />
          </motion.div>
        ))}
      </div>
    </section>
  );
}
