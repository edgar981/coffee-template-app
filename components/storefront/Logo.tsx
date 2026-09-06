// El lockup de marca del STOREFRONT: mark (ícono) + wordmark (el nombre del negocio).
//
// EL WORDMARK ES `nombre`, de SiteSetting — lo pasa el CONSUMIDOR (StoreNav/StoreFooter,
// que lo leen del provider), para que Logo siga siendo PRESENTACIONAL: un componente que
// lee el contexto sólo puede vivir dentro de él, y Logo no tiene por qué. Antes el wordmark
// decía "Café Nayoli" hardcoded.
//
// EL MARK (la flor geométrica) es hoy la marca de Nayoli, y NO es portable: es un ASSET
// POR-DESPLIEGUE, como el favicon. Es OPT-IN: `conMark` lo controla, y su DEFAULT es FALSE
// —WORDMARK-SOLO—, así que un despliegue nuevo NO muestra la flor de Nayoli ni ninguna ajena (§ #2).
// El flag por-despliegue vive en `STOREFRONT_TIENE_MARK` (env `NEXT_PUBLIC_STOREFRONT_MARK`, §
// storefront-marca); los consumidores lo pasan. El SVG de la flor (abajo) es el PUNTO DE SWAP: un
// segundo cliente con mark propio lo reemplaza. La identidad portable es el WORDMARK (`nombre`); el
// logo subido, cuando exista, se RESPETA nunca se tiñe. Doctrina: § El WORDMARK carga la identidad.
//
// Usage:
//   <LogoMark className="h-7 w-7" />                                                 — sólo el ícono
//   <Logo nombre={settings.nombre} conMark={STOREFRONT_TIENE_MARK} />                — lockup del nav
//   <Logo nombre={settings.nombre} variant="dark" conMark={…} />                     — sobre fondo espresso
//   <Logo nombre={settings.nombre} stacked subtitle={settings.tagline} conMark={…} /> — footer

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
  /** Mostrar el MARK (la flor). OPT-IN por despliegue (§ #2): DEFAULT false = wordmark-solo. Los
      consumidores pasan `STOREFRONT_TIENE_MARK`. Sin mark, el lockup es sólo el wordmark, sin hueco
      (el `gap` de flex sólo separa ENTRE hijos → con un solo hijo no deja espacio de sobra). */
  conMark?: boolean;
};

export function Logo({ className, variant = "light", stacked = false, subtitle, nombre, conMark = false }: LogoProps) {
  const wordmark = variant === "light" ? "text-[var(--sf-tinta)]" : "text-[var(--sf-fondo)]";
  const cherry = variant === "light" ? "var(--sf-tinta)" : "var(--sf-fondo)";

  if (stacked) {
    return (
      <div className={cn("flex flex-col items-center gap-3", className)}>
        {conMark && <LogoMark className="h-12 w-12" cherry={cherry} />}
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
      {conMark && <LogoMark className="h-7 w-7" cherry={cherry} />}
      <span className={cn("font-display text-[22px] leading-none", wordmark)}>
        {nombre}
      </span>
    </div>
  );
}
