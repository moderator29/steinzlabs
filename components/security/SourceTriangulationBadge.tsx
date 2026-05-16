'use client';

import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';

/**
 * Visual badge stack for source-triangulation results. Renders one
 * pill per provider that voted plus an aggregate verdict chip. Surfaces
 * the agreement state ('3 of 3 agree', 'majority', 'split') so users
 * can tell whether 'DANGER' came from one provider or all of them.
 *
 * Pairs with lib/security/triangulate.ts. The lib stays free of UI
 * concerns; this component picks colors + icons for each verdict.
 */

export type BadgeVerdict = 'safe' | 'caution' | 'danger';

export interface ProviderBadge {
  source: string;
  verdict: BadgeVerdict;
  confidence?: number;
  summary?: string;
}

export interface SourceTriangulationBadgeProps {
  overall: BadgeVerdict;
  agreement: 'unanimous' | 'majority' | 'split';
  voters: number;
  providers: ProviderBadge[];
}

const VERDICT_STYLE: Record<BadgeVerdict, { bg: string; text: string; icon: typeof ShieldCheck; label: string }> = {
  safe: {
    bg: 'bg-emerald-500/15 border-emerald-500/40',
    text: 'text-emerald-300',
    icon: ShieldCheck,
    label: 'Safe',
  },
  caution: {
    bg: 'bg-amber-500/15 border-amber-500/40',
    text: 'text-amber-300',
    icon: ShieldAlert,
    label: 'Caution',
  },
  danger: {
    bg: 'bg-red-500/15 border-red-500/40',
    text: 'text-red-300',
    icon: ShieldX,
    label: 'Danger',
  },
};

const AGREEMENT_LABEL: Record<SourceTriangulationBadgeProps['agreement'], string> = {
  unanimous: 'all sources agree',
  majority: 'majority agree',
  split: 'sources disagree',
};

export function SourceTriangulationBadge({
  overall,
  agreement,
  voters,
  providers,
}: SourceTriangulationBadgeProps) {
  const style = VERDICT_STYLE[overall];
  const Icon = style.icon;
  return (
    <div className="flex items-center flex-wrap gap-2">
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${style.bg} ${style.text} text-[11px] font-semibold`}
        title={`${voters} of ${providers.length} providers voted; ${AGREEMENT_LABEL[agreement]}`}
      >
        <Icon className="w-3 h-3" />
        {style.label}
        <span className="opacity-70">· {voters}/{providers.length}</span>
      </div>
      <div className="flex items-center gap-1">
        {providers.map((p) => {
          const s = VERDICT_STYLE[p.verdict];
          return (
            <span
              key={p.source}
              className={`inline-flex items-center px-1.5 py-0.5 rounded-md border text-[10px] font-medium ${s.bg} ${s.text}`}
              title={p.summary ? `${p.source}: ${p.summary}` : p.source}
            >
              {p.source}
            </span>
          );
        })}
      </div>
    </div>
  );
}
