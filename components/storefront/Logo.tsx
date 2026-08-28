// El lockup de marca del STOREFRONT: mark (ícono) + wordmark (el nombre del negocio).
//
// EL WORDMARK ES `nombre`, de SiteSetting — lo pasa el CONSUMIDOR (StoreNav/StoreFooter,
// que lo leen del provider), para que Logo siga siendo PRESENTACIONAL: un componente que
// lee el contexto sólo puede vivir dentro de él, y Logo no tiene por qué. Antes el wordmark
// decía "Café Nayoli" hardcoded.
//
// EL MARK (la flor geométrica) es hoy la marca de Nayoli, y NO es portable: es un ASSET
// POR-DESPLIEGUE, como el favicon. Un segundo cliente reemplaza el SVG por el suyo, o ship
// wordmark-solo. La identidad portable es el WORDMARK (arriba); el logo subido, cuando exista,
// se RESPETA nunca se tiñe. Doctrina: § El WORDMARK carga la identidad; el MARK es asset
// por-despliegue (CLAUDE.md).
//
// Usage:
//   <LogoMark className="h-7 w-7" />                                      — sólo el ícono
//   <Logo nombre={settings.nombre} />                                     — lockup del nav
//   <Logo nombre={settings.nombre} variant="dark" />                      — sobre fondo espresso
//   <Logo nombre={settings.nombre} stacked subtitle={settings.tagline} /> — footer

import { cn } from "@duna/core/utils";

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
  stroke = "var(--sf-tostado-5)",
  cherry = "var(--sf-tinta)",
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
  /** El wordmark: el nombre del negocio (SiteSetting). Lo pasa el consumidor —requerido,
      para que el compilador señale a cualquiera que lo olvide. */
  nombre: string;
};

export function Logo({ className, variant = "light", stacked = false, subtitle, nombre }: LogoProps) {
  const wordmark = variant === "light" ? "text-[var(--sf-tinta)]" : "text-[var(--sf-fondo)]";
  const cherry = variant === "light" ? "var(--sf-tinta)" : "var(--sf-fondo)";

  if (stacked) {
    return (
      <div className={cn("flex flex-col items-center gap-3", className)}>
        <LogoMark className="h-12 w-12" cherry={cherry} />
        <div className="flex flex-col items-center gap-0.5">
          <span className={cn("font-display text-2xl", wordmark)}>{nombre}</span>
          {subtitle && (
            <span className="font-display text-[13px] italic text-[var(--sf-tostado-5)]">{subtitle}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className="h-7 w-7" cherry={cherry} />
      <span className={cn("font-display text-[22px] leading-none", wordmark)}>
        {nombre}
      </span>
    </div>
  );
}
