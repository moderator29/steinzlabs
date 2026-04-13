'use client';

import { motion } from 'framer-motion';
import { FeatureCard } from './FeatureCard';
import { FEATURE_CARDS } from './cards-data';

export function FeatureCardsSection() {
  return (
    <section id="features" className="max-w-7xl mx-auto px-5 py-24">
      <motion.div className="text-center mb-16"
        initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.5 }}>
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4 text-sm font-semibold"
          style={{ background: 'rgba(10,30,255,.1)', border: '1px solid rgba(10,30,255,.3)', color: '#6d85ff' }}
        >
          Platform Features
        </div>
        <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Everything you need to win</h2>
        <p className="text-white/50 max-w-xl mx-auto">One platform. Every on-chain intelligence tool you need.</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {FEATURE_CARDS.map((card, i) => (
          <motion.div key={card.title}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, delay: i * 0.05 }}>
            <FeatureCard {...card} />
          </motion.div>
        ))}
      </div>
    </section>
  );
}
