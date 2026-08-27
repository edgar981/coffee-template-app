import type { ReactNode } from "react";
import { DunaPie } from "@/components/admin/DunaPie";

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
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      {/* Profundidad sutil: UN tinte radial del primario a muy baja opacidad,
          para que el fondo no sea un plano muerto. Sale de tokens, así que se
          adapta a claro y oscuro, y se queda muy por debajo de la card — el
          contraste de la página lo sigue haciendo la card, no el fondo. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(48rem_32rem_at_50%_0%,hsl(var(--primary)/0.07),transparent_70%)]"
      />

      {/* La duna con el sol, al fondo — identidad de la puerta. Detrás de la card
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

      {/* Pie de marca. "Dos puertas" es la METÁFORA del producto —un negocio con
          dos puertas, el admin y el storefront, sobre un mismo sistema operativo—,
          NO el número de pantallas de la puerta (que son tres). Sin versión: un
          literal envejece y no le dice nada a quien entra. `relative` para quedar
          por encima de la duna del fondo. */}
      <p className="relative z-10 mt-9 text-center text-xs text-muted-foreground/70">
        Un negocio. Dos puertas. Un sistema operativo.
      </p>
    </div>
  );
}
