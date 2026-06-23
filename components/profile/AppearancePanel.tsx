'use client';

import { useAppearance } from '@/lib/theme/ThemeProvider';
import { ACCENTS, type Appearance } from '@/lib/theme/appearance';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Monitor, Moon, Sun } from 'lucide-react';

/**
 * §3.4 — Appearance settings. Drives the global AppearanceProvider; every
 * change applies live (no reload) and is persisted per-user to Supabase.
 */

type Opt<T> = { value: T; label: string };

function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: Opt<T>[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex flex-wrap gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/10"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              active
                ? 'bg-[var(--nl-blue,#0A1EFF)] text-white'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5 border-b border-white/5 last:border-0">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-white">{label}</div>
        {hint && <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function AppearancePanel() {
  const { appearance, setAppearance } = useAppearance();
  const set = <K extends keyof Appearance>(k: K, v: Appearance[K]) => setAppearance({ [k]: v });

  return (
    <GlassPanel className="px-4">
      <Row label="Theme" hint="Light, dark, or follow your device.">
        <Segmented
          ariaLabel="Theme"
          value={appearance.theme}
          onChange={(v) => set('theme', v)}
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'system', label: 'System' },
          ]}
        />
      </Row>

      <Row label="Accent" hint="Re-tints the platform live.">
        <div className="flex items-center gap-2" role="radiogroup" aria-label="Accent color">
          {(Object.keys(ACCENTS) as Array<keyof typeof ACCENTS>).map((key) => {
            const active = appearance.accent === key;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={key}
                title={key}
                onClick={() => set('accent', key)}
                className={`w-7 h-7 rounded-lg border transition-transform ${
                  active ? 'border-white scale-110' : 'border-white/20 hover:scale-105'
                }`}
                style={{ background: ACCENTS[key].base }}
              />
            );
          })}
        </div>
      </Row>

      <Row label="Glass" hint="Frosted-surface intensity.">
        <Segmented
          ariaLabel="Glass intensity"
          value={appearance.glass}
          onChange={(v) => set('glass', v)}
          options={[
            { value: 'off', label: 'Off' },
            { value: 'subtle', label: 'Subtle' },
            { value: 'full', label: 'Full' },
          ]}
        />
      </Row>

      <Row label="Density" hint="Spacing of the interface.">
        <Segmented
          ariaLabel="Density"
          value={appearance.density}
          onChange={(v) => set('density', v)}
          options={[
            { value: 'comfortable', label: 'Comfortable' },
            { value: 'compact', label: 'Compact' },
          ]}
        />
      </Row>

      <Row label="Text size" hint="Scales the interface text.">
        <Segmented
          ariaLabel="Text size"
          value={appearance.textSize}
          onChange={(v) => set('textSize', v)}
          options={[
            { value: 'small', label: 'Small' },
            { value: 'default', label: 'Default' },
            { value: 'large', label: 'Large' },
          ]}
        />
      </Row>

      <Row label="Motion" hint="Reduce animations for comfort or accessibility.">
        <Segmented
          ariaLabel="Motion"
          value={appearance.motion}
          onChange={(v) => set('motion', v)}
          options={[
            { value: 'full', label: 'Full' },
            { value: 'reduced', label: 'Reduced' },
          ]}
        />
      </Row>

      <div className="flex items-center gap-2 py-3 text-[11px] text-slate-500">
        {appearance.theme === 'light' ? <Sun size={12} /> : appearance.theme === 'system' ? <Monitor size={12} /> : <Moon size={12} />}
        Changes apply instantly and sync to your account.
      </div>
    </GlassPanel>
  );
}
