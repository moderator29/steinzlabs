'use client';

import { Component, ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';
import { AlertOctagon, RefreshCw } from 'lucide-react';

/**
 * React error boundary — catches render-phase exceptions in the
 * subtree, captures to Sentry with the boundary scope, and renders
 * a recoverable fallback instead of a blank screen. Mount around
 * each major dashboard route so a crashed VTX panel doesn't take
 * out the rest of the dashboard.
 *
 * Use the `scope` prop to namespace the Sentry capture so we can
 * filter alerts by which surface crashed (portfolio / sniper /
 * whale / etc).
 *
 * Audit §B.13 observability.
 */

export interface ErrorBoundaryProps {
  children: ReactNode;
  scope?: string;
  /** Optional custom fallback. Receives the error + a reset fn. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    Sentry.captureException(error, {
      tags: { area: 'error-boundary', scope: this.props.scope ?? 'unknown' },
      contexts: { react: { componentStack: info.componentStack } },
    });
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div
        role="alert"
        className="rounded-2xl border border-red-500/30 bg-red-500/[0.05] p-6 max-w-lg mx-auto mt-12 text-center"
      >
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-red-500/15 border border-red-500/40 mb-4">
          <AlertOctagon className="w-6 h-6 text-red-400" />
        </div>
        <h2 className="text-base font-bold text-white mb-1">Something went sideways</h2>
        <p className="text-xs text-slate-400 leading-relaxed mb-5">
          We&apos;ve already pinged engineering. You can try reloading this section without losing
          the rest of your dashboard state.
        </p>
        <button
          onClick={this.reset}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] text-sm font-bold text-white"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reload this panel
        </button>
        {process.env.NODE_ENV !== 'production' ? (
          <pre className="mt-4 text-[10px] text-left text-slate-500 whitespace-pre-wrap break-all">
            {error.message}
          </pre>
        ) : null}
      </div>
    );
  }
}
