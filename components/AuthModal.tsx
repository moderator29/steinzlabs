'use client';

import { useState, useEffect } from 'react';
import { X, Shield, Wallet, ArrowRight, Check } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';

interface AuthModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type WelcomeStep = 'welcome' | 'wallet' | 'ready';

export default function AuthModal({ onClose, onSuccess }: AuthModalProps) {
  const { login, authenticated, user, ready } = usePrivy();
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeStep, setWelcomeStep] = useState<WelcomeStep>('welcome');
  const [sessionCreated, setSessionCreated] = useState(false);

  useEffect(() => {
    if (authenticated && user && !sessionCreated) {
      createServerSession();
    }
  }, [authenticated, user, sessionCreated]);

  const createServerSession = async () => {
    if (!user) return;

    try {
      const privyToken = localStorage.getItem('privy:token') || '';
      const res = await fetch('/api/auth/privy-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ privyToken }),
      });

      if (!res.ok) {
        console.error('Session creation failed');
        return;
      }

      setSessionCreated(true);

      const isNewUser = user.createdAt && (Date.now() - new Date(user.createdAt).getTime()) < 60000;
      if (isNewUser) {
        setShowWelcome(true);
      } else {
        onSuccess();
      }
    } catch (err) {
      console.error('Auth callback error:', err);
    }
  };

  const handleLogin = () => {
    login();
  };

  const handleWelcomeNext = () => {
    if (welcomeStep === 'welcome') {
      setWelcomeStep('wallet');
    } else if (welcomeStep === 'wallet') {
      setWelcomeStep('ready');
    } else {
      onSuccess();
    }
  };

  if (showWelcome) {
    return (
      <div
        className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="bg-[#0A0E1A] border border-white/10 rounded-2xl max-w-md w-full p-8"
          onClick={(e) => e.stopPropagation()}
        >
          {welcomeStep === 'welcome' && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 mx-auto bg-[#0A1EFF]/20 rounded-full flex items-center justify-center">
                <Check className="w-8 h-8 text-[#0A1EFF]" />
              </div>
              <h2 className="text-2xl font-bold">Welcome to Steinz Labs!</h2>
              <p className="text-gray-400">
                Your account has been created. Let&apos;s get you set up with everything you need to start trading.
              </p>
              <button
                onClick={handleWelcomeNext}
                className="w-full bg-[#0A1EFF] px-6 py-3 rounded-lg font-semibold hover:bg-[#0A1EFF]/80 transition-colors flex items-center justify-center gap-2"
              >
                Continue <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {welcomeStep === 'wallet' && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 mx-auto bg-[#0A1EFF]/20 rounded-full flex items-center justify-center">
                <Wallet className="w-8 h-8 text-[#0A1EFF]" />
              </div>
              <h2 className="text-2xl font-bold">Your Embedded Wallet</h2>
              <p className="text-gray-400">
                We&apos;ve created a secure embedded wallet for you. Back it up to ensure you never lose access.
              </p>
              {user?.wallet?.address && (
                <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Wallet Address</p>
                  <p className="text-sm font-mono text-white/80 break-all">
                    {user.wallet.address}
                  </p>
                </div>
              )}
              <button
                onClick={handleWelcomeNext}
                className="w-full bg-[#0A1EFF] px-6 py-3 rounded-lg font-semibold hover:bg-[#0A1EFF]/80 transition-colors flex items-center justify-center gap-2"
              >
                Continue <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {welcomeStep === 'ready' && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 mx-auto bg-green-500/20 rounded-full flex items-center justify-center">
                <Shield className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold">You&apos;re All Set!</h2>
              <p className="text-gray-400">
                Your account is ready. Start exploring on-chain intelligence, trading tools, and more.
              </p>
              <button
                onClick={handleWelcomeNext}
                className="w-full bg-[#0A1EFF] px-6 py-3 rounded-lg font-semibold hover:bg-[#0A1EFF]/80 transition-colors flex items-center justify-center gap-2"
              >
                Start Trading <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0A0E1A] border border-white/10 rounded-2xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Sign In to Steinz Labs</h2>
          <button onClick={onClose} className="hover:bg-white/10 p-2 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-gray-400 mb-6">
          Access on-chain intelligence, trading tools, and portfolio analytics.
        </p>

        <div className="space-y-4">
          <button
            onClick={handleLogin}
            disabled={!ready}
            className="w-full bg-[#0A1EFF] px-6 py-4 rounded-lg font-semibold hover:bg-[#0A1EFF]/80 transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <Shield className="w-5 h-5" />
            {!ready ? 'Loading...' : 'Sign In / Sign Up'}
          </button>

          <p className="text-center text-xs text-gray-500">
            Sign in with email, Google, Twitter, or connect your wallet
          </p>
        </div>

        <div className="mt-6 pt-4 border-t border-white/10">
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <Shield className="w-4 h-4 text-[#0A1EFF]" />
            <span>Secured by Privy. Your keys, your crypto.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
