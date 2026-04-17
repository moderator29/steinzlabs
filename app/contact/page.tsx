import { Mail, Twitter, MessageCircle, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Contact — Steinz Labs',
  description: 'Get in touch with the Steinz Labs team.',
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#07090f] text-white flex flex-col items-center justify-center px-5 py-24">
      <div className="max-w-lg w-full">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">Contact Us</h1>
          <p className="text-gray-400">Have a question or feedback? Reach out through any of the channels below.</p>
        </div>

        <div className="space-y-3">
          <a
            href="mailto:support@steinzlabs.com"
            className="flex items-center gap-4 bg-[#111827] border border-white/[0.08] rounded-xl px-5 py-4 hover:border-[#0A1EFF]/40 transition-colors group"
          >
            <div className="w-10 h-10 bg-[#0A1EFF]/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-[#0A1EFF]/20 transition-colors">
              <Mail className="w-5 h-5 text-[#0A1EFF]" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Email Support</div>
              <div className="text-xs text-gray-400">support@steinzlabs.com</div>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-600 ml-auto" />
          </a>

          <a
            href="https://twitter.com/steinzlabs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 bg-[#111827] border border-white/[0.08] rounded-xl px-5 py-4 hover:border-[#1DA1F2]/40 transition-colors group"
          >
            <div className="w-10 h-10 bg-[#1DA1F2]/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-[#1DA1F2]/20 transition-colors">
              <Twitter className="w-5 h-5 text-[#1DA1F2]" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Twitter / X</div>
              <div className="text-xs text-gray-400">@steinzlabs</div>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-600 ml-auto" />
          </a>

          <a
            href="https://discord.gg/steinzlabs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 bg-[#111827] border border-white/[0.08] rounded-xl px-5 py-4 hover:border-[#5865F2]/40 transition-colors group"
          >
            <div className="w-10 h-10 bg-[#5865F2]/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-[#5865F2]/20 transition-colors">
              <MessageCircle className="w-5 h-5 text-[#5865F2]" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Discord Community</div>
              <div className="text-xs text-gray-400">discord.gg/steinzlabs</div>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-600 ml-auto" />
          </a>
        </div>

        <p className="text-center text-xs text-gray-600 mt-8">
          For bug reports, please include your browser version and a description of what you were doing.
        </p>

        <div className="mt-6 text-center">
          <Link href="/" className="text-xs text-[#0A1EFF] hover:underline">← Back to home</Link>
        </div>
      </div>
    </div>
  );
}
