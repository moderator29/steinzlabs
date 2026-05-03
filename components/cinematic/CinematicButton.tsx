'use client';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';
import { soundManager, type SoundName } from '@/lib/cinematic/sound';

type Variant = 'primary' | 'cult';

export interface CinematicButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Sound to play on click. Defaults to 'click-soft'. Pass null to disable. */
  clickSound?: SoundName | null;
  /** Sound to play on hover. Reserved for major CTAs only. */
  hoverSound?: SoundName | null;
}

/**
 * Cinematic button. Animated light-sweep, lift, press, optional sound.
 * Use for primary CTAs and Vault interactions. For Naka brand buttons,
 * keep the existing `.naka-button-primary`.
 */
export const CinematicButton = forwardRef<HTMLButtonElement, CinematicButtonProps>(
  function CinematicButton({
    variant = 'primary',
    clickSound = 'click-soft',
    hoverSound = null,
    className,
    onClick,
    onMouseEnter,
    children,
    ...rest
  }, ref) {
    return (
      <button
        ref={ref}
        className={clsx(
          variant === 'cult' ? 'btn-cult' : 'btn-cinematic',
          'cinematic-press',
          className,
        )}
        onClick={(e) => { if (clickSound) soundManager().play(clickSound); onClick?.(e); }}
        onMouseEnter={(e) => { if (hoverSound) soundManager().play(hoverSound); onMouseEnter?.(e); }}
        {...rest}
      >
        {children}
      </button>
    );
  }
);
