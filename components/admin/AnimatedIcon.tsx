'use client';

import { motion, useReducedMotion, type Variants } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// Subtle, one-shot hover animations for admin icons (≤300–600ms, ease-out, no
// infinite loops — they only play while actively hovered). Two trigger modes:
//   • controlled (`hovered` prop) — the WHOLE nav row drives it, not the glyph;
//   • uncontrolled (omit `hovered`) — self-hover, for standalone icon buttons.
// prefers-reduced-motion disables ALL of them (hard requirement).
const VARIANTS = {
  // Órdenes — brief roll: nudge forward with a slight rotate (cart rolling).
  cart:    { rest: { x: 0, rotate: 0 }, hover: { x: [0, 2.5, 0], rotate: [0, -7, 0], transition: { duration: 0.45, ease: 'easeOut' } } },
  // Entregas — drives forward a few px and returns.
  truck:   { rest: { x: 0 }, hover: { x: [0, 4, 0], transition: { duration: 0.45, ease: 'easeOut' } } },
  // Productos — gentle bounce/settle.
  package: { rest: { y: 0 }, hover: { y: [0, -3, 0], transition: { duration: 0.35, ease: 'easeOut' } } },
  // Clientes — slight scale-up pulse.
  users:   { rest: { scale: 1 }, hover: { scale: [1, 1.15, 1], transition: { duration: 0.3, ease: 'easeOut' } } },
  // Notificaciones — ring swing around the top anchor.
  bell:    { rest: { rotate: 0 }, hover: { rotate: [0, 13, -10, 7, -4, 0], transition: { duration: 0.6, ease: 'easeOut' } } },
  // Tema — quarter rotate on hover.
  rotate:  { rest: { rotate: 0 }, hover: { rotate: 90, transition: { duration: 0.35, ease: 'easeOut' } } },
  // Default for the remaining nav icons — a consistent, subtle lift.
  lift:    { rest: { y: 0 }, hover: { y: [0, -2.5, 0], transition: { duration: 0.3, ease: 'easeOut' } } },
} satisfies Record<string, Variants>;

export type IconAnim = keyof typeof VARIANTS;

export function AnimatedIcon({ icon: Icon, anim = 'lift', hovered, size = 18, className }: {
  icon: LucideIcon;
  anim?: IconAnim;
  /** Controlled hover (nav rows drive it). Omit for self-hover on the icon. */
  hovered?: boolean;
  size?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();

  // Reduced motion → a plain, static icon. No variants, no whileHover.
  if (reduce) {
    return (
      <span className={cn('inline-flex', className)}>
        <Icon style={{ width: size, height: size }} className="shrink-0" />
      </span>
    );
  }

  const controlled = hovered !== undefined;
  return (
    <motion.span
      className={cn('inline-flex', className)}
      variants={VARIANTS[anim]}
      initial="rest"
      animate={controlled ? (hovered ? 'hover' : 'rest') : undefined}
      whileHover={controlled ? undefined : 'hover'}
      // Bell swings from its top, not its centre.
      style={anim === 'bell' ? { transformOrigin: '50% 3px' } : undefined}
    >
      <Icon style={{ width: size, height: size }} className="shrink-0" />
    </motion.span>
  );
}
