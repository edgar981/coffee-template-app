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
//   <Logo nombre={settings.nombre} subtitle={settings.tagline} conMark={…} />          — nav con
//     sub-encabezado (§ CROMO-NAV-FOOTER-TEMATIZABLE-1, opt-in por `content.cromo.navSubtitulo`,
//     lo decide el CONSUMIDOR — Logo no gatea nada, sólo pinta si `subtitle` llega)
//   <Logo nombre={…} subtitle={…} wordmarkTratado={content.navWordmark.activo} />      — nav con el
//     ESTILO del `.wordmark`/`.wordmark small` del prototipo (§ CORTE-LOGO-APILADO-1, opt-in por
//     `content.navWordmark.activo` — sólo ajusta la rama `subtitle`, ya apilada; NO toca `stacked`
//     (el footer), que sigue exactamente igual)

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
  /** ¿El wordmark apilado (rama `subtitle`, abajo) calza el `.wordmark`/`.wordmark small` del
      prototipo? OPT-IN por preset (§ CORTE-LOGO-APILADO-1): DEFAULT false = el ESTILO de HOY, byte a
      byte. Los consumidores pasan `content.navWordmark.activo`. Sólo afecta la rama `subtitle`; NO
      toca `stacked` (el footer). */
  wordmarkTratado?: boolean;
};

export function Logo({ className, variant = "light", stacked = false, subtitle, nombre, conMark = false, wordmarkTratado = false }: LogoProps) {
  // variant="dark" (el footer, sobre `--sf-tinta`): el wordmark/cherry leían `--sf-fondo` CRUDO
  // como texto — sin garantía de contraste contra `tinta` (§ TEMAS-P6-FAMILIAS-2, medido 1,085:1
  // en VETA). `--sf-sobre-tinta` GANA PISO contra `tinta`; SIN default en `globals.css`, así que
  // el fallback a `--sf-fondo` es el que Nayoli sigue resolviendo (raíces null → sin inyección).
  const wordmark = variant === "light" ? "text-[var(--sf-tinta)]" : "text-[var(--sf-sobre-tinta,var(--sf-fondo))]";
  const cherry = variant === "light" ? "var(--sf-tinta)" : "var(--sf-sobre-tinta,var(--sf-fondo))";

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

  // El sub-encabezado (§ CROMO-NAV-FOOTER-TEMATIZABLE-1) reusa el MISMO `subtitle` prop que ya
  // exhibe el footer en `stacked` — sólo agrega DÓNDE se puede ver, no un mecanismo nuevo. AUSENTE
  // (todo tenant salvo el que declare el eje, § StoreNav) → la rama de abajo es BYTE-IDÉNTICA al
  // `<span>` único de siempre, sin el `<span>` envolvente extra.
  //
  // `wordmarkTratado` (§ CORTE-LOGO-APILADO-1) calza el `.wordmark`/`.wordmark small` del prototipo:
  // el NOMBRE gana mayúscula + tracking `.01em` + 30px (el tamaño medido del prototipo, en vez del
  // `text-[22px]` de HOY); el SUB pasa de `font-display` itálico `--sf-tostado-5` a la sans del
  // cuerpo (`.font-inter` = `--font-ui`), tracking `.11em` (`--tracking-eyebrow`), `mt-1` (4px,
  // antes `mt-0.5`), peso regular, SIN itálica. El color del sub reusa el MISMO token ya resuelto
  // para el nombre (`wordmark`, arriba — ya garantiza el contraste correcto por `variant`) atenuado
  // al 60%: el "muted" del `.wordmark small` (`--text-on-inverse-muted`) sin inventar un token
  // nuevo. `false` (todo tenant salvo CORTE) → la rama de abajo es BYTE-IDÉNTICA a la de siempre.
  if (subtitle) {
    return (
      <div className={cn("flex items-center gap-2.5", className)}>
        {conMark && <LogoMark className="h-7 w-7" cherry={cherry} />}
        <span className="flex flex-col leading-none">
          <span className={cn(
            wordmarkTratado
              ? "font-display uppercase tracking-[0.01em] text-[30px] leading-none"
              : "font-display text-[22px] leading-none",
            wordmark,
          )}>{nombre}</span>
          <span className={
            wordmarkTratado
              ? cn("mt-1 font-inter font-normal tracking-[0.11em] text-[11px]", `${wordmark}/60`)
              : "mt-0.5 font-display text-[11px] italic text-[var(--sf-tostado-5)]"
          }>{subtitle}</span>
        </span>
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
