'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { smartBack } from '@/lib/navigation/smartBack';

interface PageHeaderProps {
  title: string;
  description?: string;
  showBack?: boolean;
  /** Fallback route when there is no in-app history (deep link / new tab) —
   *  real in-app history always wins, so Back returns to the page the user
   *  actually came from instead of dumping them on the dashboard. */
  backTo?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, showBack = false, backTo, actions }: PageHeaderProps) {
  const router = useRouter();

  return (
    <div className="mb-6">
      {showBack && (
        <button
          onClick={() => smartBack(router, backTo || '/dashboard')}
          className="group inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
        >
          <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg nl-glass border border-white/10 group-hover:border-[#0066FF]/40 transition-colors">
            <ArrowLeft size={16} className="text-slate-400 group-hover:text-[#0066FF] transition-colors" />
          </span>
          <span>Back</span>
        </button>
      )}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">{title}</h1>
          {description && <p className="text-gray-400">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}
