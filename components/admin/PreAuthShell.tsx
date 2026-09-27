import type { ReactNode } from "react";
import { DunaPie } from "@/components/admin/DunaPie";
import { HORIZONTE_BANDA_FRACCION } from "@/lib/duna-horizonte";

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

// PANEL-LOGIN-HORIZONTE-ONDULANTE-1: la banda inferior se RE-DERIVA de la
// geometría del horizonte (antes, de la cresta única que reemplaza). El SVG
// escala `width:100%, height:auto`, así que la altura ocupada por el dibujo es
// proporcional al ANCHO del contenedor — la fracción relevante es la distancia
// entre el punto MÁS ALTO que cualquier línea del horizonte puede alcanzar y el
// borde inferior del viewBox, medida en unidades de ancho.
//
// `HORIZONTE_BANDA_FRACCION` (§ lib/duna-horizonte.ts) YA es esa cuenta —una
// sola fuente, no dos números que puedan divergir—; acá sólo se REDONDEA hacia
// ARRIBA (nunca hacia abajo: cruzar contenido es peor que sobrar aire) para
// obtener el porcentaje de `vw`. Va por `style`, no por una clase Tailwind
// `pb-[...]`: una arbitrary-value class necesita ser un LITERAL estático para
// que el escaneo de Tailwind la vea, y ésta depende de una constante calculada.
const BANDA_VW = Math.ceil(HORIZONTE_BANDA_FRACCION * 100);

// El PISO también sube, de 3.5rem a 4rem: el horizonte de varias líneas ocupa
// más espacio vertical que la cresta única que reemplaza (~10.9% del ancho
// contra los ~8.9% de antes, medido en `lib/duna-horizonte.test.ts`).
const PISO_BANDA_REM = 4;

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
    // El padding-BOTTOM reserva la banda del horizonte, para que el contenido centrado (la card y
    // el pie) quede POR ENCIMA de sus líneas y éstas ondulen sobre fondo vacío, no sobre el texto.
    // Se ancla el contenido en vez de capar el SVG: capar el alto lo letterboxearía (dejaría de
    // cruzar toda la pantalla). `BANDA_VW`/`PISO_BANDA_REM`, arriba, son la derivación.
    <div
      className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 pt-10"
      style={{ paddingBottom: `max(${PISO_BANDA_REM}rem, ${BANDA_VW}vw)` }}
    >
      {/* Profundidad sutil: UN tinte radial del primario a muy baja opacidad,
          para que el fondo no sea un plano muerto. Sale de tokens, así que se
          adapta a claro y oscuro, y se queda muy por debajo de la card — el
          contraste de la página lo sigue haciendo la card, no el fondo. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(48rem_32rem_at_50%_0%,hsl(var(--primary)/0.07),transparent_70%)]"
      />

      {/* El horizonte ondulante, al fondo — identidad de la puerta. Detrás de la card
          (la card es `relative`, con su fondo `bg-card` que la separa del trazo). */}
      <DunaPie />

      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm sm:p-10">
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
          literal no le dice nada a quien entra. `relative z-10` para quedar por encima de la duna. */}
      <p className="relative z-10 mt-9 text-center text-xs text-muted-foreground/70">
        El sistema operativo de tu negocio.
      </p>
    </div>
  );
}
