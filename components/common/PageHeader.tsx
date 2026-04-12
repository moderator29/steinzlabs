'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  showBack?: boolean;
  backTo?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, showBack = false, backTo, actions }: PageHeaderProps) {
  const router = useRouter();

  return (
    <div className="mb-6">
      {showBack && (
        <button
          onClick={() => backTo ? router.push(backTo) : router.back()}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft size={20} />
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
