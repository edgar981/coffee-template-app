// components/brand/Logo.tsx
// Café Nayoli — approved mark (kit direction 2b: geometric flor, cherry center)
// Usage:
//   <LogoMark className="h-7 w-7" />                       — icon only
//   <Logo />                                               — nav lockup (tan mark + espresso wordmark)
//   <Logo variant="dark" />                                — for espresso backgrounds
//   <Logo stacked subtitle="Supatá · Cundinamarca" />      — footer / splash

import { cn } from "@/lib/utils";

const PETAL = "M50 42 C 44 33 44 20 50 13 C 56 20 56 33 50 42";
const ROTS = [0, 72, 144, 216, 288];

type MarkProps = {
  className?: string;
  /** stroke color of the petals */
  stroke?: string;
  /** fill of the center cherry */
  cherry?: string;
};

export function LogoMark({
  className,
  stroke = "#BA9C7B",
  cherry = "#1E150E",
}: MarkProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("h-8 w-8", className)}
      aria-hidden="true"
      fill="none"
      stroke={stroke}
      strokeWidth={6.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ROTS.map((r) => (
        <path key={r} d={PETAL} transform={r ? `rotate(${r} 50 50)` : undefined} />
      ))}
      <circle cx="50" cy="50" r="6" fill={cherry} stroke="none" />
    </svg>
  );
}

type LogoProps = {
  className?: string;
  /** "light" = cream page (default) · "dark" = espresso background */
  variant?: "light" | "dark";
  stacked?: boolean;
  subtitle?: string;
};

export function Logo({ className, variant = "light", stacked = false, subtitle }: LogoProps) {
  const wordmark = variant === "light" ? "text-[#1E150E]" : "text-[#F9F6F4]";
  const cherry = variant === "light" ? "#1E150E" : "#F9F6F4";

  if (stacked) {
    return (
      <div className={cn("flex flex-col items-center gap-3", className)}>
        <LogoMark className="h-12 w-12" cherry={cherry} />
        <div className="flex flex-col items-center gap-0.5">
          <span className={cn("font-display text-2xl", wordmark)}>Café Nayoli</span>
          {subtitle && (
            <span className="font-display text-[13px] italic text-[#BA9C7B]">{subtitle}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className="h-7 w-7" cherry={cherry} />
      <span className={cn("font-display text-[22px] leading-none", wordmark)}>
        Café Nayoli
      </span>
    </div>
  );
}
