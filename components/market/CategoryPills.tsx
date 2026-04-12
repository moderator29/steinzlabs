'use client';

import { CATEGORIES } from '@/lib/market/constants';

type CategoryId = typeof CATEGORIES[number]['id'];

interface CategoryPillsProps {
  active: CategoryId;
  onChange: (id: CategoryId) => void;
}

export function CategoryPills({ active, onChange }: CategoryPillsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onChange(cat.id as CategoryId)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            active === cat.id
              ? 'bg-[#0A1EFF] text-white shadow-[0_0_10px_rgba(10,30,255,0.35)]'
              : 'bg-[#141824] text-gray-400 hover:text-white border border-[#1E2433]'
          }`}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}
