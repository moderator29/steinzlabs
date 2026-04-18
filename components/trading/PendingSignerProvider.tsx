"use client";

import { useEffect } from "react";
import {
  signPendingTradeInline,
  type PendingTradeForSigning,
  type InlineSignResult,
} from "@/lib/wallet/pendingSigner";

type GlobalSigner = (trade: PendingTradeForSigning) => Promise<InlineSignResult>;

/**
 * Mounts the inline pending-trade signer as a global function on `window`.
 * PendingTradesBanner looks up `window.__nakaSignPendingTrade` to sign
 * without a page navigation. Separating this as a tiny client provider
 * keeps the banner component wallet-agnostic and avoids bundling signer
 * code for users who never see a pending trade.
 */
export default function PendingSignerProvider() {
  useEffect(() => {
    const w = window as typeof window & { __nakaSignPendingTrade?: GlobalSigner };
    w.__nakaSignPendingTrade = signPendingTradeInline;
    return () => {
      delete w.__nakaSignPendingTrade;
    };
  }, []);
  return null;
}
