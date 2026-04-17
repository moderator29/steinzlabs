"use client";
import { useState } from "react";
import bs58 from "bs58";

type Chain = "evm" | "solana";

interface EvmProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}
interface SolanaProvider {
  isPhantom?: boolean;
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  signMessage: (msg: Uint8Array, encoding: string) => Promise<{ signature: Uint8Array }>;
}
function getEvm(): EvmProvider | undefined {
  return (window as unknown as { ethereum?: EvmProvider }).ethereum;
}
function getSolana(): SolanaProvider | undefined {
  return (window as unknown as { solana?: SolanaProvider }).solana;
}

export function SignInWithWallet() {
  const [loading, setLoading] = useState<Chain | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function finishFlow(address: string, chain: Chain, signature: string, nonce: string) {
    const verifyRes = await fetch("/api/auth/wallet-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, signature, nonce, chain }),
    });
    const verifyJson = await verifyRes.json();
    if (!verifyRes.ok || verifyJson.error) {
      throw new Error(verifyJson.error || "Verification failed");
    }
    window.location.href = verifyJson.actionLink as string;
  }

  async function handleEvm() {
    setLoading("evm");
    setError(null);
    try {
      const evm = getEvm();
      if (!evm) throw new Error("No EVM wallet detected. Install MetaMask.");
      const accounts = (await evm.request({ method: "eth_requestAccounts" })) as string[];
      const address = accounts[0];
      if (!address) throw new Error("No account returned");

      const nonceRes = await fetch("/api/auth/wallet-nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, chain: "evm" }),
      });
      const { nonce, message, error: nErr } = await nonceRes.json();
      if (nErr) throw new Error(nErr);

      const signature = (await evm.request({
        method: "personal_sign",
        params: [message, address],
      })) as string;

      await finishFlow(address, "evm", signature, nonce);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet sign-in failed");
      setLoading(null);
    }
  }

  async function handleSolana() {
    setLoading("solana");
    setError(null);
    try {
      const sol = getSolana();
      if (!sol?.isPhantom) throw new Error("Phantom wallet not detected");
      const resp = await sol.connect();
      const address = resp.publicKey.toString();

      const nonceRes = await fetch("/api/auth/wallet-nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, chain: "solana" }),
      });
      const { nonce, message, error: nErr } = await nonceRes.json();
      if (nErr) throw new Error(nErr);

      const encoded = new TextEncoder().encode(message);
      const signed = await sol.signMessage(encoded, "utf8");
      const signature = bs58.encode(signed.signature);

      await finishFlow(address, "solana", signature, nonce);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet sign-in failed");
      setLoading(null);
    }
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={handleEvm}
          disabled={!!loading}
          className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 font-medium transition-colors disabled:opacity-50"
        >
          {loading === "evm" ? "Signing..." : "EVM Wallet"}
        </button>
        <button
          type="button"
          onClick={handleSolana}
          disabled={!!loading}
          className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-400 font-medium transition-colors disabled:opacity-50"
        >
          {loading === "solana" ? "Signing..." : "Solana Wallet"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}

export default SignInWithWallet;
