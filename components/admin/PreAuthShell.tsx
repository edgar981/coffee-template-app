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
// mantener el contenido íntegro por encima de sus 235px.
//
// `py-10` (arriba Y abajo, SIMÉTRICO — antes sólo `pt-10`) es la pieza que hace
// el centrado exacto: con padding-top == padding-bottom, el bloque flex se
// centra en el punto medio real de `H` sin importar cuánto valgan (¡es
// aritmética: `padTop + (H-2*padTop)/2 = H/2` para cualquier `padTop`!), algo
// que un `paddingBottom` desigual —el bug de arriba— rompe por construcción.

// PANEL-LOGIN-PIE-FUERA-DE-LINEAS-1 — EL PIE SE MUDÓ DENTRO DE LA CARD.
//
// La tanda anterior dejó el pie EN FLUJO, sibling de la card, con el argumento
// geométrico de que "cuanto más baja la pantalla, el pie entra por el extremo
// MENOS visible de la banda (i=14, opacidad ~0.097), nunca por la zona ámbar de
// acento". El gate del owner sobre esa tanda lo contradijo: *"la frase 'El
// sistema operativo de tu negocio' queda como rara sobre las líneas"* — el
// argumento estático (posición PROMEDIO de cada línea) no capturaba lo que el
// owner vio en vivo, porque `DuneLines` ANIMA cada línea con dos senos sobre el
// tiempo (`Math.sin(u*5.2 + t*1.2 + i*0.3)*(18+i*1.5) + Math.sin(u*11 - t*0.8 +
// i*0.5)*6`, § ese archivo) — en cualquier frame, el pico de una línea puede
// acercarse mucho más al pie que su centro promedio, y el argumento del slice
// anterior nunca lo midió (lo dijo explícito: "no puede afirmar 'nunca hay un
// trazo exactamente debajo de una letra'").
//
// SE DESCARTÓ "bajar la banda" (empujar `DuneLines` hacia abajo con `bottom`
// negativo, recortando su tope contra el `overflow-hidden` del wrapper, sin
// tocar la forma de ninguna línea que sobreviva al recorte) — la primera
// opción del dispatch, y la que menos cambia la composición. NO por ser
// imposible de garantizar — SE MIDIÓ (`.scratch/medir-empuje-banda.mjs`, no
// commiteado) que SÍ hay un empuje que lo garantiza en cualquier alto: el
// wrapper reserva sólo 40px (`py-10`) bajo el bloque centrado, y la banda mide
// 235px, así que hay un déficit CONSTANTE de `235-40=195px` — cuando la card
// fuerza al wrapper a crecer más que el viewport (`min-h-screen` deja de
// imponer el alto), el borde superior de la banda queda SIEMPRE 195px por
// encima del borde inferior del bloque, sea cual sea la altura de la card. Un
// empuje de exactamente esos 195px cierra ese déficit a CERO en todos los
// altos — verificado, no asumido.
//
// SE DESCARTÓ IGUAL, porque ese mismo empuje (195px, el 83% del alto de la
// banda) dejaría visible una tira de sólo 40px en el caso NORMAL (viewport que
// SÍ alcanza para la card) — y esos primeros 40px de la banda están, medido
// contra la propia fórmula de `DuneLines.tsx`, casi vacíos: la primera línea
// (`i=0`, la de acento) sólo alcanza hasta `y_local≈36` en su punto más alto,
// así que un empuje que garantiza cero solape borra, de hecho, casi TODA la
// banda que el owner acaba de aprobar en el gate anterior — cambiaría MÁS la
// composición que mover el pie, no menos. Un empuje menor (que deje la banda
// visible) no puede garantizar cero solape en el caso que sí hay que resolver
// (una card larga —aceptar-invitación o recuperar-clave/nueva, con dos campos
// de contraseña— en una ventana baja): las cuatro pantallas comparten el mismo
// wrapper pero tienen alturas de card DISTINTAS, así que un offset fijo
// calibrado para no destruir la banda en el caso cómodo queda corto para la
// card más alta en el caso bajo.
//
// EL FIX: el pie se muda DENTRO de la card, como su último hijo, separado del
// formulario con un filete (`border-t border-border`). La card tiene
// `bg-card` — un color OPACO (sin alfa: `hsl(var(--card))`/`--duna-surface`,
// hex sólidos en `tokens.css`, § grep de esta tanda) — así que NINGUNA línea de
// `DuneLines` puede mostrarse detrás de esa región, en NINGÚN frame de la
// animación ni a NINGÚN alto de ventana: no es un argumento geométrico que
// pueda fallar según la fase del seno, es una superficie opaca que tapa
// cualquier píxel debajo. Esto es lo que "espacio reservado" no podía dar sin
// tocar la banda (ver el párrafo de arriba): la garantía no viene de dejar un
// hueco vacío entre dos elementos independientes, viene de que el propio pie
// vive sobre una superficie que ya no deja pasar nada.
//
// Efecto secundario, no buscado pero correcto: el bloque centrado (§ el
// comentario de arriba, `py-10` simétrico) ahora es SÓLO la card — ya no hay un
// segundo elemento (el pie) que desplace el centro real del bloque unos ~26px
// sobre el centro de la card sola (el matiz que dejó anotado
// PANEL-LOGIN-CENTRADO-Y-CLARO-1, §1). La card queda centrada en `H/2` sin ese
// desvío.

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

        {/* Pie de marca. AFIRMA LA CATEGORÍA —qué ES Duna, el sistema operativo de un negocio— en
            vez de CONTAR sus piezas. El tagline anterior ("Un negocio. Dos puertas…") enumeraba
            admin + storefront, pero "dos puertas" se lee como canales y con WhatsApp serían tres:
            un recuento envejece con cada canal que se agrega. La afirmación de categoría no. Sin
            versión: un literal no le dice nada a quien entra.

            PANEL-LOGIN-PIE-FUERA-DE-LINEAS-1 — MUDADO DENTRO DE LA CARD (era sibling, fuera, con
            `mt-9`; § el comentario grande de arriba, "EL PIE SE MUDÓ DENTRO DE LA CARD", trae el
            porqué completo). El filete (`border-t border-border`) separa el pie del contenido —el
            mismo patrón que `Pliegue` (`components/admin/Pliegue.tsx`) usa para separar secciones.

            COLOR: `text-muted-foreground` a secas — ya NO hace falta un literal por tema
            (`dark:text-white/70` de la tanda anterior) porque ahora el pie vive SOBRE `bg-card`,
            que conmuta solo por token en los dos temas (a diferencia del fondo del wrapper, que en
            oscuro es el literal fijo `#1B1712` del owner). `--duna-muted` YA seguía el tema por sí
            mismo, así que una sola clase alcanza para los dos. Medido con `contraste()`
            (`lib/config/palette-derive.ts`) contra `--duna-surface` (el token real de `bg-card`,
            `tokens.css`) en los dos temas —
              · claro (`--duna-muted` #746F64 vs `--duna-surface` #FFFFFF) → 5.00:1 — pasa AA.
              · oscuro (`--duna-muted` #9A958A vs `--duna-surface` #1F1E1B) → 5.59:1 — pasa AA.
            Los dos números viven en el asiento de DECISIONS.md. Coincide además con el token que ya
            usa "Panel de {nombre}" dos párrafos arriba — misma superficie, mismo rol de texto
            secundario, un solo token en vez de dos convenciones para la card. */}
        <p className="mt-8 border-t border-border pt-5 text-center text-xs text-muted-foreground">
          El sistema operativo de tu negocio.
        </p>
      </div>
    </div>
  );
}
