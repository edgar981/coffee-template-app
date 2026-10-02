'use client';

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
// EL LOGO SUBIDO (§ MARCA-LOGO-IMAGEN-1, prop `logo`) es una TERCERA identidad, distinta del mark
// (asset por-despliegue) y del wordmark de texto: una imagen que el DUEÑO sube desde el panel
// (`content.logo`, § site-content-defaults.ts), con una versión OSCURA (para fondo claro) y una
// CLARA (para fondo oscuro/tinta). `logoParaVariante` (lib/config/marca-logo.ts) elige cuál mostrar
// según `variant`, con fallback a la otra si falta una. CON logo subido, la imagen REEMPLAZA el
// mark + el wordmark de texto ENTEROS por default — nunca conviven con el mark (§ CLAUDE.md, "El
// logo subido se RESPETA, nunca se tiñe"). SIN logo (`logo` ausente o sin ninguna versión subida),
// `Logo` renderiza EXACTAMENTE como hoy — mark + wordmark de texto, byte a byte. Se sirve como
// `<img src>` SIEMPRE, incluido el SVG — nunca inyectado inline como HTML.
//
// EL MODO (§ NAV-LOGO-Y-NOMBRE-1, `logo.modo`, vía `modoLogoResuelto`) decide si el logo subido
// CONVIVE con el nombre: `'soloNombre'`/`'soloLogo'` son las dos ramas de arriba (texto solo / logo
// solo, en TODOS los anchos — el comportamiento de HOY, según haya o no imagen); `'logoYNombre'`
// es la TERCERA rama, NUEVA: logo solo en el ancho de teléfono (`<lg`), logo + nombre desde
// escritorio (`lg:`). SÓLO se interpreta FUERA de `stacked` —el footer ignora `modo` a propósito,
// § el comentario de `logoSrcCrudo` más abajo—, así que esta tercera rama es exclusiva del NAV
// (los dos `<Logo>` que monta `StoreNav.tsx`: el header y el drawer móvil).
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
//   <Logo nombre={…} logo={content.logo} conMark={…} />                               — con logo
//     subido (§ MARCA-LOGO-IMAGEN-1): la imagen reemplaza mark+wordmark (o convive con el nombre en
//     escritorio, § NAV-LOGO-Y-NOMBRE-1, según `logo.modo`); sin ninguna versión subida, cae a la
//     rama de siempre con el resto de las props intactas.

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@duna/core/utils";
import type { LogoContent } from "@/lib/config/site-content-defaults";
import {
  logoParaVariante, altDeLogo, modoLogoResuelto,
  altoLogoNavMovilClase, altoLogoNavEscritorioClase,
} from "@/lib/config/marca-logo";

// EL NOMBRE EN TEXTO NUNCA SE PARTE EN DOS LÍNEAS (§ MARCA-LOGO-IMAGEN-1) — un nombre de negocio
// largo ("Café Las Chamisas") envolvía a dos líneas en el ancho de un teléfono, defecto que esta
// tanda destapó capturando el caso SIN logo (el nombre en texto es justo lo que queda cuando no
// hay imagen subida). El fix es CONTENT-AWARE (mide el ancho real), NO un breakpoint de CSS: un
// breakpoint (`text-[Npx] sm:text-[22px]`) encogería el wordmark de TODO tenant en móvil, incluida
// Nayoli ("Café Nayoli", corto) — violando la vara de esta tanda.
//
// MÉTODO: un MEDIDOR invisible (`visibility:hidden`, fuera de flujo) renderiza el MISMO texto, con
// las MISMAS clases, pero SIEMPRE en una sola línea y SIN que su propio `fontSize` cambie nunca —
// su `scrollWidth` es entonces el ancho NATURAL del nombre al tamaño BASE, sin importar qué haga
// el `<span>` visible. El `<span>` visible aporta `clientWidth`, el espacio REAL que el layout de
// flexbox le asignó. Si el natural excede el disponible (con tolerancia de redondeo), se guarda en
// estado un `fontSize` reducido en la proporción exacta que hace falta — nunca trunca con "…",
// conserva el nombre COMPLETO, sólo más chico (§ el spec: "ajuste de tamaño… en esa anchura").
//
// EL MEDIDOR AISLADO (en vez de medir sobre el MISMO nodo que se encoge) es lo que evita una
// OSCILACIÓN: medir contra un nodo cuyo tamaño el propio ajuste ya cambió hace que la SIGUIENTE
// medición (disparada por el `ResizeObserver` al cambiar ese tamaño) vea "ya cabe" al tamaño
// REDUCIDO, concluya que no hace falta ajuste, y lo devuelva al tamaño COMPLETO — que vuelve a no
// caber, dispara otra medición, se encoge de nuevo… alternando sin parar (medido: el nombre largo
// alternaba entre una línea encogida y dos líneas sin encoger según el instante de la captura). El
// medidor nunca se toca, así que siempre reporta el mismo ancho natural.
//
// Un `ResizeObserver` sobre el `<span>` visible re-mide al cambiar el ancho disponible (achicar la
// ventana, rotar el teléfono); `document.fonts.ready` re-mide una vez más por si la fuente real
// (Playfair/Inter, `@import`) no había cargado en el primer layout.
//
// EL AJUSTE ES CONDICIONAL POR ESTADO, NO UNA CLASE ESTÁTICA — medido con `guarda:color`: agregar
// `block`/`overflow-hidden`/`whitespace-nowrap` SIEMPRE (aunque el nombre corto de Nayoli nunca
// necesite encogerse) cambiaba el render de texto en Chromium por una fracción de píxel —14-15 px
// de diff en la zona del wordmark, sobre millones—, porque `display:block` en un `<span>` que
// antes era inline (aunque "blockificado" igual por ser hijo flex) no es un no-op bit a bit en el
// motor de texto. Con el ajuste detrás de un `useState` que arranca en `null`, el `<span>` de
// Nayoli renderiza EXACTAMENTE las mismas clases de HOY —cero diferencia, medida— y sólo gana las
// clases de recorte + el `fontSize` reducido cuando la medición confirma que hacen falta.
function NombreEncogible({ nombre, className }: { nombre: string; className: string }) {
  const medidorRef = useRef<HTMLSpanElement>(null);
  const visibleRef = useRef<HTMLSpanElement>(null);
  const [ajuste, setAjuste] = useState<{ fontSizePx: number } | null>(null);
  useLayoutEffect(() => {
    const medidor = medidorRef.current;
    const visible = visibleRef.current;
    if (!medidor || !visible) return;
    const medir = () => {
      const disponible = visible.clientWidth;
      const natural = medidor.scrollWidth;
      // TOLERANCIA de 2px: `clientWidth`/`scrollWidth` redondean a entero, y el redondeo por sí
      // solo puede reportar `natural` 1px por encima de `disponible` con el texto cabiendo exacto.
      if (disponible > 0 && natural > disponible + 2) {
        const base = parseFloat(getComputedStyle(medidor).fontSize);
        setAjuste({ fontSizePx: (base * disponible) / natural });
      } else {
        setAjuste(null);
      }
    };
    medir();
    document.fonts?.ready?.then(medir).catch(() => {});
    const ro = new ResizeObserver(medir);
    ro.observe(visible);
    return () => ro.disconnect();
  }, [nombre]);
  return (
    <>
      {/* MEDIDOR invisible: SIEMPRE una sola línea, al tamaño BASE, nunca mutado por el ajuste —
          es lo que hace posible medir sin oscilar (§ el comentario de arriba). `aria-hidden`
          porque el nombre YA está en el árbol de accesibilidad vía el `<span>` visible de abajo. */}
      <span
        ref={medidorRef}
        aria-hidden="true"
        className={cn(className, "pointer-events-none invisible absolute whitespace-nowrap")}
      >
        {nombre}
      </span>
      <span
        ref={visibleRef}
        className={cn(className, ajuste && "block min-w-0 overflow-hidden whitespace-nowrap")}
        style={ajuste ? { fontSize: `${ajuste.fontSizePx}px` } : undefined}
      >
        {nombre}
      </span>
    </>
  );
}

// EL BLOQUE nombre+tagline (§ NAV-LOGO-Y-NOMBRE-AJUSTE-1) — extraído para que la rama `subtitle`
// (de siempre) y la rama `logoYNombre` (§ NAV-LOGO-Y-NOMBRE-1, logo+nombre en escritorio) rendericen
// el MISMO componente, no dos versiones que puedan divergir. Antes de este slice, `logoYNombre`
// tenía su PROPIA copia inline del bloque que ignoraba `wordmarkTratado` por completo —siempre
// "font-display text-[22px] leading-none" + tagline itálico `--sf-tostado-5`, el estilo de SIN
// tratar—, así que un tenant con `navWordmark.activo` (CORTE-LOGO-APILADO-1) perdía su tratamiento
// apilado apenas convivía con un logo subido. Esta extracción lo hace IMPOSIBLE de volver a divergir.
//
// `wordmarkTratado` SÓLO afecta la rama CON tagline (`tratado = wordmarkTratado && !!subtitle`): sin
// tagline el nombre renderiza SIEMPRE a `text-[22px]` —la MISMA talla que la rama sin `subtitle` más
// abajo—, porque el tratamiento apilado (mayúscula+tracking+30px) sólo tiene sentido junto a una
// segunda línea. Con `subtitle` SIEMPRE presente (como en la rama de abajo, guardada por `if
// (subtitle)`), `tratado === wordmarkTratado` — BYTE-IDÉNTICO a lo que esa rama ya hacía.
function BloqueNombreTagline({ nombre, subtitle, wordmarkTratado, wordmark, transicionClase }: {
  nombre: string;
  subtitle?: string;
  wordmarkTratado: boolean;
  wordmark: string;
  transicionClase: string;
}) {
  const tratado = wordmarkTratado && !!subtitle;
  return (
    <>
      <NombreEncogible nombre={nombre} className={cn(
        tratado
          ? "font-display uppercase tracking-[0.01em] text-[30px] leading-none"
          : "font-display text-[22px] leading-none",
        wordmark,
        transicionClase,
      )} />
      {subtitle && (
        <span className={
          tratado
            ? cn("mt-1 font-inter font-normal tracking-[0.11em] text-[11px]", `${wordmark}/60`)
            : "mt-0.5 font-display text-[11px] italic text-[var(--sf-tostado-5)]"
        }>{subtitle}</span>
      )}
    </>
  );
}

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
  /** ¿El wordmark TRANSICIONA de color, en vez de saltar de golpe? (§ BADGES-ACCIONES-Y-LOGO-CORTE-1,
      cierra LOGO-WORDMARK-SIN-TRANSICION-1, asiento de TRANSICION-ENTRE-PAGINAS-1). Ese slice le dio
      al FILETE del nav (`navFileteClase`, `StoreNav.tsx`) una transición de color al alternar
      `navClaro` (flotando↔sólido, home↔interna) pero no al WORDMARK, porque `Logo.tsx` no estaba en
      su `touches:`. DEFAULT false = el salto de HOY, byte a byte — sólo el ÚNICO consumidor que
      alterna `variant` dinámicamente (`StoreNav.tsx`, vía `navClaro`) lo activa, gateado por
      `navTratamiento.posicion` (el MISMO booleano que gatea `navFilaTransicionClase`, para que las
      dos transiciones — filete y wordmark — enciendan y apaguen JUNTAS, nunca una sin la otra). El
      footer (`stacked`) y el preview del panel (`PaletaSeccion.tsx`) montan `variant` FIJO — nunca lo
      alternan — así que no lo necesitan y no lo pasan. `transition-colors duration-300`: MISMA
      duración que `navFilaTransicionClase` (`' transition-colors duration-300'`, `StoreNav.tsx`);
      Tailwind no declara curva propia en ninguna de las dos, así que las dos comparten también la
      curva default del navegador — no hay una segunda curva que igualar. */
  transicionColor?: boolean;
  /** El logo SUBIDO del tenant (§ MARCA-LOGO-IMAGEN-1, `content.logo`). AUSENTE o sin ninguna
      versión subida (`oscuro`/`claro` ambos vacíos) → Logo renderiza EXACTAMENTE la rama de abajo
      (mark + wordmark de texto), byte a byte. Con al menos una subida, `logo.modo` (§
      NAV-LOGO-Y-NOMBRE-1, vía `modoLogoResuelto`) decide si la imagen REEMPLAZA el lockup entero
      ('soloLogo', el default de HOY) o CONVIVE con el nombre en escritorio ('logoYNombre', nuevo) —
      nunca conviven con el MARK, en ninguno de los dos casos. */
  logo?: LogoContent;
  /** El alto DISPONIBLE de la barra que monta este lockup, SÓLO para `logo.modo==='logoYNombre'`
      (§ NAV-LOGO-Y-NOMBRE-AJUSTE-1 — `altoLogoNavMovilClase`, `marca-logo.ts`). AUSENTE (todo
      consumidor que no lo pase, p.ej. el drawer móvil de pantalla completa) → el logo de ESE modo
      sigue a `h-7` (28px), el tamaño de HOY, sin cambio — así que el ajuste de este slice queda
      acotado al ÚNICO mount que la evidencia midió (el `<header>`, vía `StoreNav.tsx`), sin tocar
      la fila propia del drawer (otra geometría: `px-6 py-5`, no un alto fijo). CON el prop, el logo
      LLENA esa barra en el teléfono y, en escritorio (`lg:`), pasa a igualar (o superar un poco) el
      alto del bloque nombre+tagline (`altoLogoNavEscritorioClase`) — nunca el alto de la barra. */
  altoBarraClase?: string;
};

export function Logo({ className, variant = "light", stacked = false, subtitle, nombre, conMark = false, wordmarkTratado = false, transicionColor = false, logo, altoBarraClase }: LogoProps) {
  // variant="dark" (el footer, sobre `--sf-tinta`): el wordmark/cherry leían `--sf-fondo` CRUDO
  // como texto — sin garantía de contraste contra `tinta` (§ TEMAS-P6-FAMILIAS-2, medido 1,085:1
  // en VETA). `--sf-sobre-tinta` GANA PISO contra `tinta`; SIN default en `globals.css`, así que
  // el fallback a `--sf-fondo` es el que Nayoli sigue resolviendo (raíces null → sin inyección).
  //
  // `wordmark` SE QUEDA de UNA sola clase a propósito (§ BADGES-ACCIONES-Y-LOGO-CORTE-1): más abajo
  // (rama `subtitle` + `wordmarkTratado`) se le concatena `/60` en un TEMPLATE LITERAL crudo
  // (`` `${wordmark}/60` ``, el modificador de opacidad de Tailwind, que sólo es válido pegado a UNA
  // utilidad) — mezclar `transition-colors duration-300` acá adentro habría roto esa concatenación
  // (`…duration-300/60` en vez de `…tinta)]/60`). La transición vive aparte, en `transicionClase`.
  //
  // Se computan ACÁ ARRIBA, antes de cualquier `return` — § NAV-LOGO-Y-NOMBRE-1 las necesita
  // también la rama `logoYNombre` (logo + nombre en escritorio, abajo), que antes de este slice no
  // existía: ningún camino con logo subido llegaba a necesitar el color del NOMBRE.
  const wordmark = variant === "light" ? "text-[var(--sf-tinta)]" : "text-[var(--sf-sobre-tinta,var(--sf-fondo))]";
  const cherry = variant === "light" ? "var(--sf-tinta)" : "var(--sf-sobre-tinta,var(--sf-fondo))";
  // Sólo el NOMBRE (no el `subtitle`/tagline, que ya es un color fijo `--sf-tostado-5` en la rama sin
  // tratar, y que el gate del owner no nombró): "el wordmark cambia de color de golpe" es del nombre.
  const transicionClase = transicionColor ? "transition-colors duration-300" : "";

  // `logoSrcCrudo` es la URL cruda del logo subido para esta variante — SIN mirar `logo.modo`
  // todavía. La rama STACKED (sólo el footer, § Logo.tsx, "Usage") la usa TAL CUAL: el ajuste de
  // este slice (§ NAV-LOGO-Y-NOMBRE-1) es del NAV — "cada tienda puede elegir que el NAV
  // muestre…" —, y el pie de página no está en su alcance. Con logo subido, el pie sigue
  // reemplazando mark+wordmark por la imagen, byte a byte, sin importar qué eligió el dueño en
  // `logo.modo`.
  const logoSrcCrudo = logo ? logoParaVariante(logo, variant) : "";

  if (stacked) {
    if (logoSrcCrudo) {
      const alt = altDeLogo(logo as LogoContent, nombre);
      return (
        <div className={cn("flex flex-col items-center gap-0.5", className)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- aspecto desconocido (SVG/PNG subido), ancho auto sobre alto fijo */}
          <img src={logoSrcCrudo} alt={alt} className="h-12 w-auto" />
          {subtitle && (
            <span className="font-display text-[13px] italic text-[var(--sf-tostado-5)]">{subtitle}</span>
          )}
        </div>
      );
    }
    return (
      <div className={cn("flex min-w-0 flex-col items-center gap-3", className)}>
        {conMark && <LogoMark className="h-12 w-12 shrink-0" cherry={cherry} />}
        <div className="flex min-w-0 max-w-full flex-col items-center gap-0.5">
          <NombreEncogible nombre={nombre} className={cn("font-display text-2xl", wordmark, transicionClase)} />
          {subtitle && (
            <span className="font-display text-[13px] italic text-[var(--sf-tostado-5)]">{subtitle}</span>
          )}
        </div>
      </div>
    );
  }

  // EL MODO (§ NAV-LOGO-Y-NOMBRE-1) — sólo se interpreta ACÁ, FUERA de `stacked` (arriba). `''`,
  // ausente o basura → el default CONDICIONAL de `modoLogoResuelto` (marca-logo.ts): 'soloLogo' con
  // imagen subida, 'soloNombre' sin ella — el comportamiento de HOY. `'soloNombre'` EXPLÍCITO
  // ignora cualquier imagen subida —`logoSrc` queda '' aunque `logoSrcCrudo` no lo esté—, así el
  // dueño puede volver al texto sin borrar lo que subió.
  const modoResuelto = logo ? modoLogoResuelto(logo) : "soloNombre";
  const logoSrc = modoResuelto === "soloNombre" ? "" : logoSrcCrudo;

  // `'logoYNombre'` (§ NAV-LOGO-Y-NOMBRE-1, Café Las Chamisas con su sello redondo): el logo SOLO
  // en el ancho de teléfono (`<lg`, el único flex item visible — igual que la rama "sólo logo" de
  // abajo), logo + nombre desde escritorio (`lg:`, el bloque de texto oculto hasta ese breakpoint
  // con `hidden … lg:flex` — `display:none` de verdad, no `invisible`: a diferencia del ícono de
  // buscar de StoreNav, § NAV-MOVIL-NOMBRE-CON-AIRE-1, acá SÍ queremos que su caja desaparezca del
  // flujo en el teléfono — "el logo SOLO", no el logo con un hueco invisible al lado). El tagline
  // (`subtitle`) sigue al nombre: oculto junto con él en el teléfono, visible bajo el nombre en
  // escritorio — no hay otra regla mejor que probar (el tagline sin el nombre encima no se lee).
  //
  // EL BLOQUE nombre+tagline ES `BloqueNombreTagline` (§ NAV-LOGO-Y-NOMBRE-AJUSTE-1) — EXACTAMENTE
  // el mismo componente que la rama `subtitle` de abajo, no una segunda copia que pudiera divergir
  // sobre `wordmarkTratado` (como ocurría antes de este slice: esta rama ignoraba la prop por
  // completo y SIEMPRE mostraba el nombre sin tratar + el tagline itálico, aun con
  // `navWordmark.activo`).
  //
  // EL ALTO DEL LOGO (`altoBarraClase`, § marca-logo.ts) — DERIVADO, nunca un número suelto: en el
  // teléfono llena la barra que lo monta (el prop AUSENTE, p.ej. el drawer móvil, conserva `h-7` —
  // el tamaño de HOY, § el docstring de la prop); en escritorio (`min-[1024px]:`, el MISMO valor que
  // `lg`, § PARIDAD-CORTENAV-CASCADA-1 — necesario para no mezclar un breakpoint `px` arbitrario con
  // uno del scale `rem` en la MISMA declaración, bajo CORTE) iguala o supera un poco el alto del
  // bloque de texto que acompaña.
  if (logoSrc && modoResuelto === "logoYNombre") {
    const alt = altDeLogo(logo as LogoContent, nombre);
    const altoLogoClase = altoBarraClase
      ? cn(altoBarraClase, altoLogoNavEscritorioClase(wordmarkTratado, !!subtitle))
      : "h-7";
    return (
      <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- aspecto desconocido (SVG/PNG subido), ancho auto sobre alto fijo */}
        <img src={logoSrc} alt={alt} className={cn(altoLogoClase, "w-auto shrink-0")} />
        <span className="hidden min-w-0 flex-col leading-none lg:flex">
          <BloqueNombreTagline nombre={nombre} subtitle={subtitle} wordmarkTratado={wordmarkTratado} wordmark={wordmark} transicionClase={transicionClase} />
        </span>
      </div>
    );
  }

  if (logoSrc) {
    const alt = altDeLogo(logo as LogoContent, nombre);
    return (
      <div className={cn("flex items-center gap-2.5", className)}>
        <span className="flex flex-col leading-none">
          {/* eslint-disable-next-line @next/next/no-img-element -- aspecto desconocido (SVG/PNG subido), ancho auto sobre alto fijo */}
          <img src={logoSrc} alt={alt} className="h-7 w-auto" />
          {subtitle && (
            <span className="mt-0.5 font-display text-[11px] italic text-[var(--sf-tostado-5)]">{subtitle}</span>
          )}
        </span>
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
      <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
        {conMark && <LogoMark className="h-7 w-7 shrink-0" cherry={cherry} />}
        <span className="flex min-w-0 flex-col leading-none">
          <BloqueNombreTagline nombre={nombre} subtitle={subtitle} wordmarkTratado={wordmarkTratado} wordmark={wordmark} transicionClase={transicionClase} />
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      {conMark && <LogoMark className="h-7 w-7 shrink-0" cherry={cherry} />}
      <NombreEncogible nombre={nombre} className={cn("font-display text-[22px] leading-none", wordmark, transicionClase)} />
    </div>
  );
}
