'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink, Globe, MessageCircle, Twitter, Copy, CheckCircle, Clock, Shield } from 'lucide-react';

interface TokenListing {
  id: string;
  tokenName: string;
  symbol: string;
  contractAddress: string;
  chain: string;
  website: string;
  telegram: string;
  twitter: string;
  description: string;
  logoUrl: string;
  email: string;
  status: string;
  submittedAt: string;
  previewUrl: string;
}

const CHAIN_COLORS: Record<string, string> = {
  ethereum: 'from-blue-500/20 to-blue-600/20 text-blue-400 border-blue-500/30',
  solana: 'from-green-500/20 to-green-600/20 text-green-400 border-green-500/30',
  bsc: 'from-yellow-500/20 to-yellow-600/20 text-yellow-400 border-yellow-500/30',
  base: 'from-blue-400/20 to-blue-500/20 text-blue-300 border-blue-400/30',
  polygon: 'from-purple-500/20 to-purple-600/20 text-purple-400 border-purple-500/30',
  avalanche: 'from-red-500/20 to-red-600/20 text-red-400 border-red-500/30',
  arbitrum: 'from-blue-600/20 to-blue-700/20 text-blue-300 border-blue-600/30',
};

export default function TokenPreviewPage() {
  const params = useParams();
  const router = useRouter();
  const [listing, setListing] = useState<TokenListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchListing = async () => {
      try {
        const res = await fetch(`/api/project-listing?preview=${params.id}`);
        if (res.ok) {
          const data = await res.json();
          setListing(data.listing);
        }
      } catch (e) {
        console.error('Failed to fetch listing:', e);
      }
      setLoading(false);
    };
    fetchListing();
  }, [params.id]);

  const copyAddress = () => {
    if (listing?.contractAddress) {
      navigator.clipboard.writeText(listing.contractAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const statusInfo: Record<string, { label: string; color: string; desc: string }> = {
    pending: { label: 'Under Review', color: 'bg-[#F59E0B]/20 text-[#F59E0B]', desc: 'Our team is reviewing your submission. You will be notified once a decision is made.' },
    approved_pending_payment: { label: 'Approved - Awaiting Payment', color: 'bg-[#10B981]/20 text-[#10B981]', desc: 'Your token has been approved! Please check your email for payment instructions to complete the listing.' },
    payment_sent: { label: 'Payment Email Sent', color: 'bg-[#00D4AA]/20 text-[#00D4AA]', desc: 'Payment instructions have been sent to your email. Complete payment to get listed.' },
    paid: { label: 'Payment Confirmed', color: 'bg-[#10B981]/20 text-[#10B981]', desc: 'Payment confirmed! Your token will be listed on Project Discovery shortly.' },
    listed: { label: 'Listed', color: 'bg-[#10B981]/20 text-[#10B981]', desc: 'Your token is now live on NAKA Project Discovery!' },
    rejected: { label: 'Rejected', color: 'bg-[#EF4444]/20 text-[#EF4444]', desc: 'Unfortunately, your token listing was not approved at this time.' },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0D14] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#00D4AA] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-[#0B0D14] flex flex-col items-center justify-center text-white p-4">
        <div className="text-xl font-bold mb-2">Token Not Found</div>
        <p className="text-gray-400 text-sm mb-4">This preview link may have expired or the token was not submitted.</p>
        <button onClick={() => router.push('/dashboard/project-discovery')} className="bg-gradient-to-r from-[#00D4AA] to-[#6366F1] px-6 py-2 rounded-lg text-sm font-semibold">
          Go to Project Discovery
        </button>
      </div>
    );
  }

  const status = statusInfo[listing.status] || statusInfo.pending;
  const chainStyle = CHAIN_COLORS[listing.chain] || 'from-gray-500/20 to-gray-600/20 text-gray-400 border-gray-500/30';

  return (
    <div className="min-h-screen bg-[#0B0D14] text-white">
      <div className="max-w-2xl mx-auto p-4 pt-8">
        <button
          onClick={() => router.push('/dashboard/project-discovery')}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Discovery
        </button>

        <div className="glass rounded-2xl border border-white/10 overflow-hidden">
          <div className="bg-gradient-to-r from-[#00D4AA]/10 to-[#6366F1]/10 px-6 py-4 border-b border-white/5">
            <div className="flex items-center gap-2 text-[10px] text-gray-400 mb-1">
              <Shield className="w-3 h-3" />
              TOKEN LISTING PREVIEW
            </div>
            <div className="text-xs text-gray-500">This is how your token will appear on NAKA Project Discovery once listed.</div>
          </div>

          <div className="p-6">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-semibold mb-4 ${status.color}`}>
              {listing.status === 'pending' && <Clock className="w-3 h-3" />}
              {listing.status === 'listed' && <CheckCircle className="w-3 h-3" />}
              {status.label}
            </div>

            <div className="glass rounded-xl p-5 border border-white/10 mb-4">
              <div className="flex items-start gap-4">
                {listing.logoUrl ? (
                  <img src={listing.logoUrl} alt={listing.tokenName} className="w-14 h-14 rounded-xl object-cover border border-white/10" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#00D4AA]/20 to-[#6366F1]/20 flex items-center justify-center text-lg font-bold border border-white/10">
                    {listing.symbol?.slice(0, 2)}
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-bold">{listing.tokenName}</h2>
                    <span className="text-sm text-gray-400 font-mono">${listing.symbol}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-r border ${chainStyle}`}>
                      {listing.chain.charAt(0).toUpperCase() + listing.chain.slice(1)}
                    </span>
                    {listing.status === 'listed' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30">
                        Verified
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {listing.description && (
                <p className="text-sm text-gray-300 mt-4 leading-relaxed">{listing.description}</p>
              )}

              <div className="mt-4 flex items-center gap-2">
                <div className="flex-1 bg-[#1A2235] rounded-lg px-3 py-2 text-xs font-mono text-gray-400 truncate">
                  {listing.contractAddress}
                </div>
                <button onClick={copyAddress} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                  {copied ? <CheckCircle className="w-4 h-4 text-[#10B981]" /> : <Copy className="w-4 h-4 text-gray-400" />}
                </button>
              </div>

              <div className="flex items-center gap-3 mt-4">
                {listing.website && (
                  <a href={listing.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#00D4AA] transition-colors">
                    <Globe className="w-3.5 h-3.5" /> Website
                  </a>
                )}
                {listing.telegram && (
                  <a href={listing.telegram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#00D4AA] transition-colors">
                    <MessageCircle className="w-3.5 h-3.5" /> Telegram
                  </a>
                )}
                {listing.twitter && (
                  <a href={listing.twitter} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#00D4AA] transition-colors">
                    <Twitter className="w-3.5 h-3.5" /> Twitter
                  </a>
                )}
              </div>
            </div>

            <div className={`rounded-xl p-4 border ${listing.status === 'rejected' ? 'border-[#EF4444]/20 bg-[#EF4444]/5' : 'border-[#00D4AA]/20 bg-[#00D4AA]/5'}`}>
              <div className="text-xs font-bold mb-1">Status Update</div>
              <p className="text-[11px] text-gray-400 leading-relaxed">{status.desc}</p>
            </div>

            <div className="mt-4 text-[10px] text-gray-600 text-center">
              Submitted {new Date(listing.submittedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              {' · '}Listing ID: {listing.id}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
