"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type Tab = "market" | "limit" | "dca" | "stop";

interface OrderFormProps {
  chain: string;
  tokenAddress: string;
  tokenSymbol: string;
}

export function OrderForm({ chain, tokenAddress, tokenSymbol }: OrderFormProps) {
  const [tab, setTab] = useState<Tab>("market");

  return (
    <div className="flex flex-col h-full bg-slate-900/20">
      {/* Tab bar */}
      <div className="grid grid-cols-4 border-b border-slate-800">
        {(["market", "limit", "dca", "stop"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-2 text-[11px] uppercase tracking-wide font-semibold transition ${
              tab === t
                ? "text-blue-300 border-b-2 border-blue-500/60 bg-blue-500/5"
                : "text-slate-500 hover:text-white"
            }`}
          >
            {t === "stop" ? "Stop/TP" : t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tab === "market" && <MarketTab chain={chain} tokenAddress={tokenAddress} tokenSymbol={tokenSymbol} />}
        {tab === "limit" && <LimitTab chain={chain} tokenAddress={tokenAddress} tokenSymbol={tokenSymbol} />}
        {tab === "dca" && <DcaTab chain={chain} tokenAddress={tokenAddress} tokenSymbol={tokenSymbol} />}
        {tab === "stop" && <StopTab chain={chain} tokenAddress={tokenAddress} tokenSymbol={tokenSymbol} />}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</span>
        {hint && <span className="text-[10px] text-slate-600">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

const INPUT_CLS =
  "w-full px-3 py-2 rounded-lg bg-slate-950/50 border border-slate-800 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/40 font-mono tabular-nums";

function MarketTab({ tokenSymbol }: { chain: string; tokenAddress: string; tokenSymbol: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-3">
        Market orders route through the main swap aggregator with best-price selection.
      </p>
      <Field label="Amount in">
        <input className={INPUT_CLS} placeholder="0.0" />
      </Field>
      <Field label={`Receive ${tokenSymbol} (est.)`}>
        <input className={INPUT_CLS} placeholder="—" readOnly />
      </Field>
      <a
        href="/dashboard/swap"
        className="block w-full text-center py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition"
      >
        Open full swap →
      </a>
    </div>
  );
}

function LimitTab({ chain, tokenAddress, tokenSymbol }: { chain: string; tokenAddress: string; tokenSymbol: string }) {
  const [amount, setAmount] = useState("");
  const [triggerPrice, setTriggerPrice] = useState("");
  const [direction, setDirection] = useState<"above" | "below">("below");
  const [expires, setExpires] = useState<string>("604800");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!amount || !triggerPrice) {
      toast.error("Enter amount and trigger price");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/trading/limit-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chain,
          from_token_address: "USDC",
          to_token_address: tokenAddress,
          to_token_symbol: tokenSymbol,
          from_amount: Number(amount),
          trigger_price_usd: Number(triggerPrice),
          trigger_direction: direction,
          expires_at: expires === "never" ? null : new Date(Date.now() + Number(expires) * 1000).toISOString(),
          wallet_source: "external_evm",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      toast.success("Limit order created");
      setAmount("");
      setTriggerPrice("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Field label="Amount (USDC)">
        <input className={INPUT_CLS} placeholder="0.0" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <Field label="Trigger direction">
        <div className="grid grid-cols-2 gap-2">
          {(["below", "above"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDirection(d)}
              className={`py-1.5 text-xs rounded-lg border transition ${
                direction === d
                  ? "bg-blue-500/15 border-blue-500/40 text-blue-300"
                  : "border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              {d === "below" ? "Price ≤" : "Price ≥"}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Trigger price (USD)">
        <input className={INPUT_CLS} placeholder="0.00" value={triggerPrice} onChange={(e) => setTriggerPrice(e.target.value)} />
      </Field>
      <Field label="Expires in">
        <select value={expires} onChange={(e) => setExpires(e.target.value)} className={INPUT_CLS}>
          <option value="86400">1 day</option>
          <option value="604800">1 week</option>
          <option value="2592000">1 month</option>
          <option value="never">Never</option>
        </select>
      </Field>
      <button
        onClick={submit}
        disabled={submitting}
        className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white text-sm font-semibold transition flex items-center justify-center gap-2"
      >
        {submitting && <Loader2 size={13} className="animate-spin" />}
        Place limit order
      </button>
    </div>
  );
}

function DcaTab({ chain, tokenAddress, tokenSymbol }: { chain: string; tokenAddress: string; tokenSymbol: string }) {
  const [amount, setAmount] = useState("");
  const [interval, setInterval] = useState("86400");
  const [totalExecutions, setTotalExecutions] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!amount) {
      toast.error("Enter amount per execution");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/trading/dca-bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chain,
          from_token_address: "USDC",
          to_token_address: tokenAddress,
          to_token_symbol: tokenSymbol,
          amount_per_execution: Number(amount),
          interval_seconds: Number(interval),
          total_executions: totalExecutions ? Number(totalExecutions) : null,
          wallet_source: "external_evm",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      toast.success("DCA bot created");
      setAmount("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Field label="Amount per execution (USDC)">
        <input className={INPUT_CLS} placeholder="100" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <Field label="Interval">
        <select value={interval} onChange={(e) => setInterval(e.target.value)} className={INPUT_CLS}>
          <option value="3600">Every hour</option>
          <option value="21600">Every 6 hours</option>
          <option value="86400">Daily</option>
          <option value="604800">Weekly</option>
        </select>
      </Field>
      <Field label="Total executions (optional)" hint="leave blank for unlimited">
        <input
          className={INPUT_CLS}
          placeholder="unlimited"
          value={totalExecutions}
          onChange={(e) => setTotalExecutions(e.target.value)}
        />
      </Field>
      <button
        onClick={submit}
        disabled={submitting}
        className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white text-sm font-semibold transition flex items-center justify-center gap-2"
      >
        {submitting && <Loader2 size={13} className="animate-spin" />}
        Create DCA bot
      </button>
    </div>
  );
}

function StopTab({ chain, tokenAddress, tokenSymbol }: { chain: string; tokenAddress: string; tokenSymbol: string }) {
  const [amount, setAmount] = useState("");
  const [stopLoss, setStopLoss] = useState("-10");
  const [takeProfit, setTakeProfit] = useState("30");
  const [trailing, setTrailing] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!amount) {
      toast.error("Enter position amount");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/trading/stop-loss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chain,
          token_address: tokenAddress,
          token_symbol: tokenSymbol,
          position_amount: Number(amount),
          stop_loss_pct: stopLoss ? Number(stopLoss) : null,
          take_profit_pct: takeProfit ? Number(takeProfit) : null,
          trailing_stop_percent: trailing ? Number(trailing) : null,
          exit_to_token_address: "USDC",
          wallet_source: "external_evm",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      toast.success("Stop/TP order created");
      setAmount("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Field label={`Position amount (${tokenSymbol})`}>
        <input className={INPUT_CLS} placeholder="0.0" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <Field label="Stop loss (%)">
        <input className={INPUT_CLS} placeholder="-10" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} />
      </Field>
      <Field label="Take profit (%)">
        <input className={INPUT_CLS} placeholder="30" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} />
      </Field>
      <Field label="Trailing stop (%)" hint="overrides fixed stop loss">
        <input className={INPUT_CLS} placeholder="15" value={trailing} onChange={(e) => setTrailing(e.target.value)} />
      </Field>
      <button
        onClick={submit}
        disabled={submitting}
        className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white text-sm font-semibold transition flex items-center justify-center gap-2"
      >
        {submitting && <Loader2 size={13} className="animate-spin" />}
        Create stop/TP
      </button>
    </div>
  );
}

export default OrderForm;
