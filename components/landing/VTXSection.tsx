'use client';

import { motion } from 'framer-motion';
import { MessageSquare, Layers, Zap } from 'lucide-react';
import { staggerContainer, cardReveal } from '@/lib/animations';

const STEPS = [
  {
    icon: MessageSquare,
    title: 'Ask anything',
    body: 'A token, a wallet, a contract, or plain English. VTX understands on-chain context natively.',
  },
  {
    icon: Layers,
    title: 'Seven sources, synthesized',
    body: 'Price, security, social, on-chain history, and entity intelligence, cross-referenced in real time.',
  },
  {
    icon: Zap,
    title: 'A clear answer',
    body: 'A structured token card, wallet profile, or security report with a risk score and a recommendation.',
  },
];

export function VTXSection() {
  return (
    <section className="py-20 sm:py-24 px-5 relative overflow-hidden">
      <div className="max-w-5xl mx-auto relative z-10">
        <motion.div
          className="text-center mb-12 max-w-xl mx-auto"
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.5 }}
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.35em] mb-4" style={{ color: '#1E90FF' }}>
            VTX AI
          </p>
          <h2 className="text-3xl sm:text-[40px] font-black text-white leading-tight">
            Intelligence that thinks{' '}
            <span style={{ color: '#1E90FF' }}>before you trade.</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed" style={{ color: '#B4C0E0' }}>
            Ask in plain English. VTX pulls from seven intelligence sources at once and returns a structured, actionable read.
          </p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
        >
          {STEPS.map((step, i) => (
            <motion.div key={step.title} variants={cardReveal}>
              <div
                className="relative rounded-2xl p-6 h-full flex flex-col gap-4"
                style={{
                  background: 'linear-gradient(160deg, rgba(12,18,44,0.6) 0%, rgba(5,8,22,0.85) 100%)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <span className="absolute top-4 right-5 font-black select-none" style={{ fontSize: 40, color: 'rgba(0,102,255,0.16)', lineHeight: 1 }}>
                  0{i + 1}
                </span>
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(0,102,255,0.12)', border: '1px solid rgba(0,150,255,0.35)' }}
                >
                  <step.icon className="w-6 h-6" style={{ color: '#3d9bff' }} strokeWidth={1.6} />
                </div>
                <div>
                  <h3 className="text-[17px] font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#95a3c9' }}>{step.body}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
