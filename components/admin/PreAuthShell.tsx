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

// PANEL-LOGIN-DUNELINES-OWNER-1: la banda inferior se RE-DERIVA del alto FIJO
// que `DuneLines` (componente del owner, copiado tal cual — § components/admin/
// DuneLines.tsx) declara para sí mismo: `HEIGHT = 235` dentro de ese archivo. No
// se toca el componente para exportar esa constante (la instrucción del owner es
// "ni una coma"), así que acá se re-espeja el MISMO literal, con el comentario
// como único puente entre los dos archivos.
//
// A diferencia del horizonte viejo (`lib/duna-horizonte.ts`, retirado de este
// chasis), que escalaba `width:100%, height:auto` — proporcional al ANCHO del
// contenedor, de ahí la reserva en `vw` —, `DuneLines` fija su alto en PÍXELES
// (`height: HEIGHT` inline, sin importar el ancho). La reserva por tanto deja de
// ser una fracción de `vw`: es ese mismo número fijo de píxeles, siempre.
const DUNE_LINES_ALTO_PX = 235;

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
    // El padding-BOTTOM reserva la banda de `DuneLines`, para que el contenido centrado (la card y
    // el pie) quede POR ENCIMA de sus líneas. `DUNE_LINES_ALTO_PX`, arriba, es la derivación.
    //
    // Fondo `#1B1712` LITERAL (no un token): instrucción textual del owner (§ DECISIONS.md,
    // PANEL-LOGIN-DUNELINES-OWNER-1) — la pantalla de login deja de seguir el tema claro/oscuro del
    // panel en su fondo, para que `DuneLines` (que trae sus propios colores fijos, `#F59E0B`/
    // `#A69D8E`, sin leer tokens) tenga siempre el mismo fondo contra el que fue diseñado.
    // `overflow-hidden` también es del pedido del owner ("position: relative; overflow: hidden
    // wrapper"), sobre el contenedor raíz.
    <div
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#1B1712] px-4 pt-10"
      style={{ paddingBottom: `${DUNE_LINES_ALTO_PX}px` }}
    >
      {/* El tinte radial de `--primary` que vivía acá se RETIRÓ (PANEL-LOGIN-DUNELINES-OWNER-1):
          leía un token que sigue el tema claro/oscuro del panel, y el fondo ya no lo hace — sobre
          `#1B1712` fijo, ese token puede resolver a un valor pensado para un fondo claro y no
          adaptarse. `DuneLines` ya aporta su propio acento cálido (las líneas en `#F59E0B`), así
          que el tinte no sumaba algo que no estuviera ahí y arriesgaba desentonar. */}

      {/* `DuneLines`, el componente del owner (copiado tal cual, § components/admin/DuneLines.tsx),
          al fondo — identidad de la puerta. `z-0` explícito para que quede detrás del formulario,
          aunque el orden del DOM ya lo garantizaría (es el primer hijo, sin z-index propio). */}
      <DuneLines className="z-0" />

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
          `text-white/70` LITERAL, no `text-muted-foreground/70` (PANEL-LOGIN-DUNELINES-OWNER-1):
          ese token sigue el tema claro/oscuro del panel y en tema CLARO resuelve a un gris OSCURO,
          ilegible sobre el `#1B1712` fijo del fondo — este párrafo vive FUERA de la card, así que no
          hereda el fondo claro de `bg-card` que sí sigue el tema. Medido: blanco al 70% sobre
          `#1B1712` da 9.12:1 (AA exige 4.5:1 para texto normal) — ver el asiento en DECISIONS.md
          para el cálculo. */}
      <p className="relative z-10 mt-9 text-center text-xs text-white/70">
        El sistema operativo de tu negocio.
      </p>
    </div>
  );
}
