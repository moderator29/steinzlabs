import { forwardRef, type HTMLAttributes } from 'react';

/**
 * GlassCard — the platform glass container. Dark, near-black glass body with a
 * neon-blue edge-lit ring (bright top-left, fading to black) + a soft ambient
 * blue glow from the lit corner. Styling lives in `.nl-glass`
 * (app/globals-brand.css) so it stays consistent everywhere.
 *
 * Use this for cards/containers/panels platform-wide. Buttons are NOT glass —
 * use <Button> / `.nl-btn-neon` for those.
 */
export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  /** adds hover lift + stronger glow; use for clickable cards */
  interactive?: boolean;
  /** crimson edge variant — reserved for Vault / NakaCult surfaces */
  accent?: 'blue' | 'crimson';
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(function GlassCard(
  { interactive = false, accent = 'blue', className = '', children, ...rest },
  ref,
) {
  const cls = [
    'nl-glass',
    accent === 'crimson' ? 'nl-glass--crimson' : '',
    interactive ? 'nl-glass--interactive' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div ref={ref} className={cls} {...rest}>
      {children}
    </div>
  );
});
