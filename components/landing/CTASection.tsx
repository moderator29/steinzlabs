'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

export function CTASection() {
  return (
    <section className="max-w-7xl mx-auto px-5 py-24">
      <motion.div
        className="relative overflow-hidden rounded-3xl px-8 py-20 text-center"
        style={{ background: 'linear-gradient(135deg,#0A1EFF 0%,#050ea8 50%,#07090f 100%)' }}
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.5 }}
      >
        {/* Glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle,rgba(10,30,255,.4) 0%,transparent 70%)', filter: 'blur(60px)' }}
        />

        <div className="relative z-10">
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
            Ready to trade smarter?
          </h2>
          <p className="text-white/60 mb-10 max-w-xl mx-auto text-lg">
            Join thousands of traders using Steinz Labs to get institutional-grade intelligence on every move.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold text-base text-white transition-all hover:scale-105 active:scale-95"
              style={{
                background: 'linear-gradient(135deg,#fff 0%,#d0d8ff 100%)',
                color: '#0A1EFF',
                boxShadow: '0 0 40px rgba(10,30,255,.5)',
              }}
            >
              Get Started Free <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/docs"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold text-base text-white transition-all hover:bg-white/20"
              style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.25)' }}
            >
              Read the Docs
            </Link>
          </div>

          <p className="text-white/30 text-sm mt-8">No credit card required. Free plan available.</p>
        </div>
      </motion.div>
    </section>
  );
}
