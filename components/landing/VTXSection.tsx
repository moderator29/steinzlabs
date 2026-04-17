'use client';

import { motion } from 'framer-motion';
import { MessageSquare, Layers, Zap } from 'lucide-react';
import { staggerContainer, cardReveal } from '@/lib/animations';

const STEPS = [
  {
    num: '01',
    icon: MessageSquare,
    title: 'Ask Anything',
    body: 'Token address, wallet, contract, or plain English. VTX understands on-chain context natively.',
    pills: null,
  },
  {
    num: '02',
    icon: Layers,
    title: '7-Source Analysis',
    body: 'Price, security, social sentiment, on-chain history, entity intelligence — cross-referenced and synthesized in real time.',
    pills: ['Price', 'Security', 'Social', 'On-Chain', 'Entity', 'Market', 'Wallet'],
  },
  {
    num: '03',
    icon: Zap,
    title: 'Structured Intelligence',
    body: 'Complete Token Card, Wallet DNA profile, or security report with VTX Risk Score (0–100) and a clear recommendation.',
    pills: null,
  },
];

export function VTXSection() {
  return (
    <section className="py-24 px-5" style={{ background: '#04040e' }}>
      <div className="max-w-5xl mx-auto">
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.5 }}
        >
          <p className="text-[9px] font-bold uppercase tracking-[5px] mb-4" style={{ color: '#8899cc' }}>
            VTX AI
          </p>
          <h2 className="text-4xl md:text-[36px] font-black text-white leading-tight mb-4">
            Intelligence that thinks before you trade.
          </h2>
          <p className="text-white/40 max-w-lg mx-auto text-sm leading-relaxed">
            Ask anything. VTX pulls from 7 intelligence sources simultaneously and returns structured, actionable analysis.
          </p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-5"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
        >
          {STEPS.map((step, i) => (
            <motion.div key={step.num} variants={cardReveal}>
              <div
                className="relative rounded-2xl p-7 h-full flex flex-col gap-4"
                style={{ background: 'rgba(6,6,15,.6)', border: '1px solid rgba(26,58,204,.12)' }}
              >
                {/* Step number — subtle top-right */}
                <span
                  className="absolute top-5 right-6 font-black select-none"
                  style={{ fontSize: 48, color: 'rgba(26,58,204,.18)', lineHeight: 1 }}
                >
                  {step.num}
                </span>

                {/* Icon */}
                <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(77,128,255,.1)', boxShadow: '0 0 20px rgba(77,128,255,.12)' }}>
                  <step.icon className="w-6 h-6" style={{ color: '#4d80ff' }} />
                </div>

                <div>
                  <h3 className="text-[17px] font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#7788bb' }}>{step.body}</p>
                </div>

                {step.pills && (
                  <div className="flex flex-wrap gap-1.5 mt-auto">
                    {step.pills.map(p => (
                      <span key={p} className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          background: 'rgba(77,128,255,.08)',
                          border: '1px solid rgba(77,128,255,.2)',
                          color: '#4d80ff',
                        }}>
                        {p}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Connecting dashed line (desktop only) */}
        <div className="hidden md:block relative -mt-[calc(50%+40px)] pointer-events-none" style={{ zIndex: 0 }} />
      </div>
    </section>
  );
}
