import type { ReactNode } from "react";
import { DuneLines } from "@/components/admin/DuneLines";

// ─── Chasis de las pantallas PRE-AUTH ────────────────────────────────────────
// Las TRES son /login, /aceptar-invitacion y /recuperar-clave (+ su
// /recuperar-clave/nueva). Comparten chasis acá y no por copia porque son la
// PUERTA del producto Duna: puertas con marcas distintas —o una con la N del
// cliente y otra con el logo— es exactamente el desorden que veníamos a arreglar.
//
// El admin es producto Duna; el storefront es la marca del cliente. Por eso acá
// la marca primaria es Duna y la tienda es una línea de CONTEXTO. El nombre del
// negocio llega por PROP (`nombre`) y no se lee acá: este chasis lo montan
// componentes CLIENTE (login, aceptar-invitación, recuperar-clave), y
// `SiteSetting` es server-only.
// Cada página es ahora un shell SERVER que lee `getSiteSettings()` y lo pasa —así
// la línea de contexto refleja el nombre editable, con una sola fuente.

/** Input de las pantallas pre-auth: alto cómodo, focus ring del sistema. */
export const PREAUTH_INPUT =
  "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm " +
  "transition-colors placeholder:text-muted-foreground/60 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring";

/** Botón primario de las pantallas pre-auth. */
export const PREAUTH_BOTON =
  "w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground " +
  "transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card " +
  "disabled:cursor-not-allowed disabled:opacity-60";

/**
 * Error INLINE. En pre-auth el toast aparece lejos del formulario y se va solo,
 * justo cuando el operador está mirando los campos para corregir. Destructive en
 * TINTE, nunca relleno sólido; `role="alert"` para que se anuncie al aparecer.
 */
export function AvisoError({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
    >
      {children}
    </p>
  );
}

// PANEL-LOGIN-CENTRADO-Y-CLARO-1 — LA CAUSA DEL DESCENTRADO, MEDIDA.
//
// La tanda anterior (PANEL-LOGIN-DUNELINES-OWNER-1) reservaba, con
// `paddingBottom: 235px` (el alto FIJO que `DuneLines` — componente del owner,
// § components/admin/DuneLines.tsx, NO se toca — declara para sí mismo como
// `HEIGHT`), la banda entera para que el contenido centrado quedara SIEMPRE por
// encima de las líneas. El costo: con `justify-content:center` sobre un flex de
// alto `min-h-screen` + `pt-10` arriba + `pb-235px` abajo, el CENTRO del bloque
// centrado queda en `padTop + (H - padTop - padBottom)/2` — para H=800 eso da
// `40 + (800-40-235)/2 ≈ 302`, **~98px arriba del centro real de la pantalla**
// (400). Ese desplazamiento — igual a la mitad de la asimetría entre el padding
// de arriba y el de abajo — es la causa exacta del reclamo del owner.
//
// EL FIX: la banda deja de reservarse para el cálculo de centrado. El owner
// aceptó explícitamente que, en pantallas bajas, la banda pase POR DETRÁS de la
// card (tiene fondo propio, § `bg-card` abajo) — así que ya no hace falta
// mantener el contenido íntegro por encima de sus 235px. Lo único que se
// preserva es que el PIE (el único texto sin fondo propio) no quede ilegible.
//
// `py-10` (arriba Y abajo, SIMÉTRICO — antes sólo `pt-10`) es la pieza que hace
// el centrado exacto: con padding-top == padding-bottom, el bloque flex se
// centra en el punto medio real de `H` sin importar cuánto valgan (¡es
// aritmética: `padTop + (H-2*padTop)/2 = H/2` para cualquier `padTop`!), algo
// que un `paddingBottom` desigual —el bug de arriba— rompe por construcción.
//
// EL PIE: se queda EN FLUJO, pegado a la card con el mismo `mt-9` de siempre —
// no se lo desacopla a `position:absolute` porque eso arriesgaría que quedara
// SUPERPUESTO a la card en pantallas muy bajas (dos elementos independientes
// sin relación de spacing entre sí). Medido con la geometría real de
// `DuneLines` (§ ese archivo: `LINES=15`, línea `i` nace en
// `y_local = 60 + i*11` dentro de la banda de 235px, con amplitud de onda de
// `18 + i*1.5` para la primera onda): cuanto MÁS BAJA es la pantalla, más
// profundo entra el bloque (card+pie) en la banda — pero el pie, al ser lo
// ÚLTIMO del bloque, entra por el extremo que corresponde a los índices `i`
// MÁS ALTOS (los MENOS visibles: opacidad ~0.10-0.15, contra 0.5 de las 4
// líneas de acento). El caso límite es cuando el bloque entero mide lo mismo
// que la pantalla (`H ≈ altura del bloque`): ahí el pie llega, como mucho, al
// fondo mismo de la banda (`y_local = 235`, la línea MÁS tenue, `i=14`,
// opacidad ≈0.097) — nunca a la zona ámbar de acento (`y_local ≤ ~84`, sólo
// alcanzable si el bloque completo mide ~150px menos que la pantalla, un caso
// que no ocurre con el alto real de estas cards). Es un argumento geométrico,
// no una medición en navegador — **el gate real de esto son los ojos del
// owner** (no hay Playwright/jsdom en este repo para confirmarlo por
// ejecución), así que el asiento en DECISIONS.md lo deja explícito como punto
// a confirmar en el gate visual.

export function PreAuthShell({
  titulo,
  nombre,
  children,
}: {
  titulo: string;
  /** Nombre del negocio para la línea de contexto ("Panel de …"). Lo pasa el
      shell server de cada página desde `SiteSetting`. */
  nombre: string;
  children: ReactNode;
}) {
  return (
    // `py-10` SIMÉTRICO (arriba Y abajo, § el comentario grande de arriba) es lo que centra el
    // bloque en el punto medio real de la pantalla. Ya NO hay `paddingBottom` atado al alto de
    // `DuneLines` — esa reserva era la causa del descentrado.
    //
    // Fondo: `bg-background` (TOKEN — `--duna-bg`, § tokens.css) en CLARO; el literal `#1B1712`
    // del owner SÓLO en OSCURO (`dark:bg-[#1B1712]`, PANEL-LOGIN-CENTRADO-Y-CLARO-1). Antes el
    // literal se aplicaba SIEMPRE (instrucción original de PANEL-LOGIN-DUNELINES-OWNER-1, cuando
    // la pantalla no distinguía tema): en modo claro se veía oscura, que es el segundo reclamo del
    // owner. `DuneLines` sigue trayendo sus propios colores fijos (`#F59E0B`/`#A69D8E`) sin leer
    // tokens — el fondo puede conmutar sin que el componente lo sepa. `overflow-hidden` es del
    // pedido original del owner ("position: relative; overflow: hidden wrapper"), sin cambio.
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-10 dark:bg-[#1B1712]">
      {/* El tinte radial de `--primary` que vivía acá se RETIRÓ (PANEL-LOGIN-DUNELINES-OWNER-1):
          leía un token que sigue el tema claro/oscuro del panel, y el fondo ya no lo hace — sobre
          `#1B1712` fijo, ese token puede resolver a un valor pensado para un fondo claro y no
          adaptarse. `DuneLines` ya aporta su propio acento cálido (las líneas en `#F59E0B`), así
          que el tinte no sumaba algo que no estuviera ahí y arriesgaba desentonar. Sigue retirado
          en esta tanda: el fondo vuelve a conmutar por tema, pero el tinte era del fondo VIEJO
          (antes de DuneLines), y reintroducirlo no lo pidió nadie — scope creep. */}

      {/* `DuneLines`, el componente del owner (copiado tal cual, § components/admin/DuneLines.tsx),
          al fondo — identidad de la puerta. `z-0` explícito para que quede detrás del formulario,
          aunque el orden del DOM ya lo garantizaría (es el primer hijo, sin z-index propio).
          `admin-preauth-lineas` es el gancho del recoloreo en modo CLARO (§ app/(admin)/duna.css,
          PANEL-LOGIN-CENTRADO-Y-CLARO-1): SIN esa clase, el selector de la regla CSS tendría que
          ser `svg path` a secas y alcanzaría cualquier OTRO ícono del admin con 5+ `<path>`. */}
      <DuneLines className="z-0 admin-preauth-lineas" />

      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm sm:p-10">
        <div className="mb-9 flex flex-col items-center text-center">
          {/* Logo de Duna. Dos archivos, uno por fondo: el negativo (claro) va
              sobre oscuro y el normal sobre claro. Se conmuta con `dark:` y no
              con JS para que no haya un parpadeo del logo equivocado antes de
              hidratar. Los assets de public/ son inmutables: se usan los que ya
              existen, no se sobrescribe ninguno. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/duna-logo-horizontal-v1.svg"
            alt="Duna"
            className="h-7 w-auto object-contain dark:hidden"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/duna-logo-horizontal-negative-v1.svg"
            alt="Duna"
            className="hidden h-7 w-auto object-contain dark:block"
          />

          {/* El logo respira: el título arranca bien abajo, no pegado. */}
          <h1 className="mt-8 text-[22px] font-semibold leading-tight tracking-tight text-foreground">
            {titulo}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Panel de {nombre}
          </p>
        </div>

        {children}
      </div>

      {/* Pie de marca. AFIRMA LA CATEGORÍA —qué ES Duna, el sistema operativo de un negocio— en vez
          de CONTAR sus piezas. El tagline anterior ("Un negocio. Dos puertas…") enumeraba admin +
          storefront, pero "dos puertas" se lee como canales y con WhatsApp serían tres: un recuento
          envejece con cada canal que se agrega. La afirmación de categoría no. Sin versión: un
          literal no le dice nada a quien entra. `relative z-10` para quedar por encima de la duna.

          COLOR POR TEMA (PANEL-LOGIN-CENTRADO-Y-CLARO-1): el fondo vuelve a conmutar
          (`bg-background dark:bg-[#1B1712]`, arriba), así que el texto tiene que conmutar CON él —
          `text-white/70` sólido (heredado de la tanda anterior, cuando el fondo era SIEMPRE oscuro)
          quedaría casi invisible sobre el fondo claro de hoy. Este párrafo vive FUERA de la card, así
          que no hereda el `bg-card` que sí sigue el tema por sí solo.

          `text-foreground/70 dark:text-white/70` — NO `text-muted-foreground` (ni con `/70`):
          medido con `contraste()` (`lib/config/palette-derive.ts`) contra los tokens que esta
          página REALMENTE resuelve (`--duna-bg`/`--duna-muted`/`--duna-ink`, que ganan sobre el
          fallback `hsl(var(--background))` porque `duna.css` los define siempre en el grupo admin,
          § app/globals.css:155,170,171) —
            · `text-muted-foreground/70` (el reflejo obvio del `/70` de oscuro) → 2.67:1 — FALLA AA.
            · `text-muted-foreground` a secas (100%) → 4.62:1 — pasa, pero raspando el piso 4.5:1.
            · `text-foreground/70` (`--duna-ink` al 70%) → 6.67:1 — cómodo, y espejea el `/70` de
              oscuro (9.12:1) en vez de introducir una tercera convención de opacidad.
          Los cuatro números viven en el asiento de DECISIONS.md. */}
      <p className="relative z-10 mt-9 text-center text-xs text-foreground/70 dark:text-white/70">
        El sistema operativo de tu negocio.
      </p>
    </div>
  );
}
