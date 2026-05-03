'use client';
import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import clsx from 'clsx';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { fadeUp } from '@/lib/cinematic/motion';

type Variant = 'default' | 'cult' | 'chosen';

export interface CinematicContainerProps extends Omit<HTMLMotionProps<'div'>, 'variants'> {
  children: ReactNode;
  variant?: Variant;
  /** Whether to fade-up on mount via Framer Motion. Defaults true. */
  animate?: boolean;
}

const variantClass: Record<Variant, string> = {
  default: '',
  cult: 'cinematic-container--cult',
  chosen: 'cinematic-container--chosen',
};

export const CinematicContainer = forwardRef<HTMLDivElement, CinematicContainerProps>(
  function CinematicContainer({ children, variant = 'default', animate = true, className, ...rest }, ref) {
    if (animate) {
      return (
        <motion.div
          ref={ref}
          className={clsx('cinematic-container', variantClass[variant], className)}
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          {...rest}
        >
          {children}
        </motion.div>
      );
    }
    return (
      <div
        ref={ref}
        className={clsx('cinematic-container', variantClass[variant], className)}
        {...(rest as HTMLAttributes<HTMLDivElement>)}
      >
        {children}
      </div>
    );
  }
);
