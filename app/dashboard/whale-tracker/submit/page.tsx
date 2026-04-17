"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

const ENTITY_TYPES = ["vc", "trader", "fund", "exchange", "dev", "influencer", "institutional"];

export default function SubmitWhalePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    address: "",
    chain: "ethereum",
    proposed_label: "",
    proposed_entity_type: "trader",
    reason: "",
    evidence_urls: "",
  });
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.address.trim() || !form.proposed_label.trim() || !form.reason.trim()) {
      toast.error("Address, label and reason are required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/whales/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: form.address.trim(),
          chain: form.chain,
          proposed_label: form.proposed_label.trim(),
          proposed_entity_type: form.proposed_entity_type,
          reason: form.reason.trim(),
          evidence_urls: form.evidence_urls
            .split(/\s+/)
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error ?? "Submission failed");
        return;
      }
      toast.success("Submission received. An admin will review shortly.");
      router.push("/dashboard/whale-tracker");
    } finally {
      setSubmitting(false);
    }
  }

  const input =
    "w-full px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-800 text-sm focus:outline-none focus:border-blue-500/40";

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      <div className="max-w-xl mx-auto px-4 py-6">
        <Link href="/dashboard/whale-tracker" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition mb-4">
          <ArrowLeft size={12} /> Whale tracker
        </Link>
        <h1 className="text-2xl font-bold mb-1">Submit a whale</h1>
        <p className="text-xs text-slate-500 mb-6">
          Propose a public wallet for inclusion in the Naka Labs whale directory. An admin reviews every submission before it goes live.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Wallet address">
            <input
              className={input}
              placeholder="0x… or Solana base58"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </Field>
          <Field label="Chain">
            <select value={form.chain} onChange={(e) => setForm({ ...form, chain: e.target.value })} className={input}>
              {["ethereum", "base", "arbitrum", "polygon", "bsc", "solana", "avalanche", "optimism"].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Proposed label">
            <input
              className={input}
              placeholder="e.g. Jane Doe (a16z Partner)"
              value={form.proposed_label}
              onChange={(e) => setForm({ ...form, proposed_label: e.target.value })}
            />
          </Field>
          <Field label="Entity type">
            <select
              value={form.proposed_entity_type}
              onChange={(e) => setForm({ ...form, proposed_entity_type: e.target.value })}
              className={input}
            >
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Why is this a whale?">
            <textarea
              className={input}
              rows={4}
              placeholder="Provide context: how you verified this wallet, public disclosures, notable trades…"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </Field>
          <Field label="Evidence URLs" hint="whitespace-separated">
            <textarea
              className={input}
              rows={2}
              placeholder="https://twitter.com/… https://etherscan.io/… "
              value={form.evidence_urls}
              onChange={(e) => setForm({ ...form, evidence_urls: e.target.value })}
            />
          </Field>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-sm font-semibold transition flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 size={13} className="animate-spin" />}
            Submit for review
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</span>
        {hint && <span className="text-[10px] text-slate-600">{hint}</span>}
      </div>
      {children}
    </label>
  );
}
