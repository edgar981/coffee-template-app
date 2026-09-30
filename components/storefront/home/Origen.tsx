"use client";

import type { RefObject } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { fadeUp, useContadorAnimado } from "@/lib/animation";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { REGISTRY, seccionEsVisible, type OrigenContent } from "@/lib/config/site-content-defaults";
import { fontSizeDisplay } from "@/lib/config/escala-display";
import { contenedorAnchoClase } from "@/lib/config/themes";

// LA BANDA ORIGEN (§ ORIGEN-BANDA-1, medido: ORIGEN-BANDA-CENSO-1) — grid de 2 fotos + copy + una
// lista de 4 pares dato editoriales a nivel finca + 3 contadores animados. Ver el docstring de
// `OrigenContent` (site-content-defaults.ts) para el porqué mecánico de que NAZCA APAGADA
// (`visible:false`) y de que, a diferencia de `spotlight`, SÍ sea miembro de `BANDA_IDS`. El gate de
// visibilidad vive ACÁ (como brandStory/spotlight), no en `page.tsx`.
//
// `datosDeOrigen`/`statsDeOrigen` devuelven objetos `{key,label,valor}`/`{key,numero,etiqueta}` en
// vez de indexar `origen[campo]` dinámicamente: `OrigenContent` mezcla `string` con `visible:
// boolean`, así que un `keyof OrigenContent` genérico tipa el acceso como `string | boolean` y
// rompe `.trim()` — leer los ocho/seis campos por su nombre literal evita esa unión sin cast.
function datosDeOrigen(origen: OrigenContent): Array<{ key: string; label: string; valor: string }> {
  return [
    { key: "dato1", label: origen.dato1Label, valor: origen.dato1Valor },
    { key: "dato2", label: origen.dato2Label, valor: origen.dato2Valor },
    { key: "dato3", label: origen.dato3Label, valor: origen.dato3Valor },
    { key: "dato4", label: origen.dato4Label, valor: origen.dato4Valor },
  ].filter(({ valor }) => valor.trim() !== "");
}

function statsDeOrigen(origen: OrigenContent): Array<{ key: string; numero: string; etiqueta: string }> {
  return [
    { key: "stat1", numero: origen.statNumero1, etiqueta: origen.statEtiqueta1 },
    { key: "stat2", numero: origen.statNumero2, etiqueta: origen.statEtiqueta2 },
    { key: "stat3", numero: origen.statNumero3, etiqueta: origen.statEtiqueta3 },
  ].filter(({ numero }) => numero.trim() !== "");
}

// Un contador animado (§ `useContadorAnimado`, `lib/animation.ts`): cuenta de 0 a su valor final al
// entrar en vista. `valor` es TEXTO (`OrigenContent.statNumeroN`) — se parsea acá; un valor no
// numérico (o vacío) NO se anima y se muestra TAL CUAL, preferir callar/mostrar-literal a inventar
// un cero (mismo criterio que el resto del storefront con datos que no se pueden validar).
//
// `/^-?\d+$/` en vez de "despojar caracteres y parsear lo que quede": despojar "N/D" deja una
// cadena VACÍA que `Number('')` lee como 0 —un cero FABRICADO, exactamente lo que este componente
// existe para no hacer—. Exigir que el string ENTERO (recortado) sean sólo dígitos rechaza
// cualquier basura de una — no hay resto que parsear a medias.
function OrigenContador({ valor, etiqueta, estatico }: { valor: string; etiqueta: string; estatico: boolean }) {
  const limpio = valor.trim();
  const numeroValido = /^-?\d+$/.test(limpio);
  const destino = numeroValido ? Number(limpio) : 0;
  const { ref, valor: valorActual } = useContadorAnimado(destino, estatico || !numeroValido);

  return (
    // `.stat`/`.stat b`/`.stat span` del prototipo (`css/app.css:600-610`) — MEDIDO por
    // computed-style contra el prototipo real (§ ORIGEN-DATOS-EXACTO-1): text-align se queda
    // IZQUIERDA en TODO ancho (`start` a 1280px Y `left` a 390px — la regla mobile de la hoja es
    // un reset redundante, no una excepción; NUNCA centrado — `sm:text-center` era el error).
    // `.stat b`: 40px fijo (`--text-display-m`, SIN variación por breakpoint — no es
    // `--text-display-l`, que sí es un clamp), line-height 39.2px (0.98 · 40) y letter-spacing
    // -0.6px (-.015em · 40), los tres medidos en vivo, no derivados de la hoja a ojo.
    <div className="text-left">
      <b className="block font-playfair text-[40px] leading-[0.98] tracking-[-0.015em] font-normal text-[var(--sf-tinta)]">
        {numeroValido ? Math.round(valorActual).toLocaleString("es-CO") : valor}
      </b>
      <span className="block mt-2 text-base text-[var(--sf-texto-suave)]">{etiqueta}</span>
    </div>
  );
}

export default function Origen({ style }: { style?: React.CSSProperties } = {}) {
  const { origen, tema, navTratamiento } = useSiteContent();
  const preview = useIsPreview();
  // MOVIMIENTO REDUCIDO, mismo gate que `BrandStoryCentrada` (§ el docstring de `useContadorAnimado`
  // en `lib/animation.ts` para el porqué de las DOS razones que lo piden).
  const reduce = useReducedMotion();
  const estatico = preview || !!reduce;
  // ESCALA DE DISPLAY (§ TEMAS-ESCALA-DISPLAY-1): `undefined` sin escala declarada → NO se toca el
  // `style`, el h2 sigue rindiendo `text-3xl sm:text-4xl` — byte-idéntico; sólo CORTE ('amplia') lo agranda.
  const displayL = fontSizeDisplay(tema.escalaDisplay, "l");

  if (!seccionEsVisible(REGISTRY.origen, origen)) return null;

  // Cada VALOR es opcional (§ el docstring de `OrigenContent`): un par/stat sin valor se OMITE
  // entero, nunca una fila/celda vacía. Con TODOS los valores vacíos (el caso de los DEFAULTS, hoy —
  // sin panel para cargarlos, § §3 del slice) la lista y la fila de contadores no rinden nada, y el
  // `<dl>`/el grid de stats tampoco: un contenedor vacío con su borde superior se leería como un
  // elemento roto, no como "sin datos todavía" (mismo criterio que hide-on-empty de un repeater).
  const datosVisibles = datosDeOrigen(origen);
  const statsVisibles = statsDeOrigen(origen);

  // EL CONTENEDOR (§ PARIDAD-ANCHO-CONTENIDO-1): `contenedorAnchoClase` reemplaza el literal
  // `max-w-6xl px-4 sm:px-6 lg:px-8` de siempre — `false` (todo tenant salvo CORTE) devuelve ESE
  // MISMO literal, byte a byte; `true` (CORTE) da el `--content-max`/`--page-gutter` EXACTOS del
  // prototipo, el mismo par que ya alinea el encabezado (ver el docstring de la función,
  // `lib/config/themes.ts`, para el porqué de reusar `navTratamiento.posicion`).
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);

  return (
    <section id="origen" className="py-20 bg-[var(--sf-banda,var(--sf-fondo))]" style={style}>
      <div className={`${contenedorClase} mx-auto`}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div
            initial={preview ? false : "hidden"}
            animate={preview ? "visible" : undefined}
            whileInView={preview ? undefined : "visible"}
            viewport={preview ? undefined : { once: true }}
            variants={fadeUp}
            className="grid grid-cols-2 gap-3 sm:gap-5 items-start"
          >
            {/* `.origen-media` del prototipo (css/app.css:584,589,1013-1014) — gap 20px desde 641px
                (`--space-5`), 12px bajo 640 (`--space-3`); el desfase del primer marco es 48px desde
                641px (`--space-12`), 32px bajo 640 (`--space-8`). Medido contra `PARIDAD-CAFE-Y-
                ORIGEN-1`: acá vivían fijos en 16px/32px siempre, sin la variación por ancho — las
                fotos quedaban menos escalonadas que en el prototipo. */}
            {/* `.origen-media figure` del prototipo (`css/app.css:585`) — MEDIDO contra el
                muestrario desplegado (§ ORIGEN-RADIO-SOMBRA-IMAGEN-1, el mismo defecto ya cerrado
                en el collage de Historia, § HISTORIA-COLLAGE-COMO-PROTOTIPO-1): `rounded-2xl` crudo
                compila a `var(--radius-2xl)`, el MISMO token que 'recta' pisa a 0 para botones/
                tarjetas, así que bajo CORTE estas fotos salían con esquinas RECTAS y sin la sombra
                del prototipo. `sf-radio-imagen`/`sf-sombra-imagen` (`app/globals.css`, § eje 4, rol
                IMAGEN) son el mismo rol de forma que ya usa `BrandStoryCentrada.tsx` — su fallback
                para Suave es 1rem (= lo que `rounded-2xl` ya resolvía), pero la banda Origen nace
                OFF para Nayoli (`visible:false`, § el docstring de `OrigenContent`) y este componente
                retorna `null` sin fila (afirmado: "LA INVARIANTE… rinde la banda VACÍA — ni un
                nodo", `origen-banda.test.ts`), así que ni el radio ni la sombra nuevos le llegan a
                Nayoli — byte-idéntica por construcción, no por coincidencia de valores. */}
            <div className="relative aspect-[3/4] overflow-hidden sf-radio-imagen sf-sombra-imagen mt-8 sm:mt-12">
              <Image
                src={origen.imagen1}
                alt="Cerezas de café secándose al sol"
                fill
                sizes="(max-width: 1024px) 50vw, 25vw"
                className="object-cover"
              />
            </div>
            <div className="relative aspect-[3/4] overflow-hidden sf-radio-imagen sf-sombra-imagen">
              <Image
                src={origen.imagen2}
                alt="Las manos de un recolector con cerezas de café maduras"
                fill
                sizes="(max-width: 1024px) 50vw, 25vw"
                className="object-cover"
              />
            </div>
          </motion.div>

          <motion.div
            initial={preview ? false : "hidden"}
            animate={preview ? "visible" : undefined}
            whileInView={preview ? undefined : "visible"}
            viewport={preview ? undefined : { once: true }}
            variants={fadeUp}
          >
            {origen.eyebrow && (
              <p className="text-[var(--sf-sobre-banda,var(--sf-acento-texto))] text-xs font-medium tracking-[0.2em] uppercase mb-4">
                {origen.eyebrow}
              </p>
            )}
            <h2
              className="text-3xl sm:text-4xl font-playfair text-[var(--sf-sobre-banda,var(--sf-tinta))] leading-tight mb-5"
              style={displayL ? { fontSize: displayL } : undefined}
            >
              {origen.titulo}
            </h2>
            <p className="text-[var(--sf-texto)] leading-relaxed mb-6 text-base">{origen.lede}</p>

            {datosVisibles.length > 0 && (
              // `.spec-list`/`.spec-list div`/`dt`/`dd` del prototipo (`css/app.css:591-599`) —
              // MEDIDO por computed-style (§ ORIGEN-DATOS-EXACTO-1): la fila es `py-4` (16px,
              // `--space-4`; ERA `py-3`/12px) SIN `items-center` (el prototipo no fija
              // `align-items`, y el computado da `normal` = stretch, no `center`); `dt` lleva
              // `tracking-[0.11em]` (1.32px a 12px, `--tracking-eyebrow` — ERA `tracking-wide`,
              // 0.025em, un tercio de lo medido); `dd` es `text-base` (16px, `--text-body-m` —
              // ERA `text-sm`/14px) en `var(--sf-texto)` (el rol `--text-body`, NO `--sf-tinta`:
              // ese es el rol `--text-heading` que usan el h2/los contadores, no la fila del dato).
              <dl className="border-t border-[var(--sf-linea)]">
                {datosVisibles.map(({ key, label, valor }) => (
                  <div
                    key={key}
                    className="flex justify-between gap-6 py-4 border-b border-[var(--sf-linea)]"
                  >
                    <dt className="text-[var(--sf-texto-suave)] text-xs uppercase tracking-[0.11em]">{label}</dt>
                    <dd className="text-[var(--sf-texto)] text-base text-right m-0">{valor}</dd>
                  </div>
                ))}
              </dl>
            )}
          </motion.div>
        </div>

        {statsVisibles.length > 0 && (
          // `.stats` del prototipo (`css/app.css:600-604` + su variante `max-width:640px`,
          // `:992`) — MEDIDO por computed-style (§ ORIGEN-DATOS-EXACTO-1): gap 24px bajo 640px
          // (`--space-6`) y 32px desde 641px (`--space-8`) — ERA `gap-8` fijo siempre, sin la
          // variación por ancho (mt-16/pt-12 sí eran correctos: 64px/48px en las DOS anchuras).
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 mt-16 pt-12 border-t border-[var(--sf-linea)]">
            {statsVisibles.map(({ key, numero, etiqueta }) => (
              <OrigenContador key={key} valor={numero} etiqueta={etiqueta} estatico={estatico} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
