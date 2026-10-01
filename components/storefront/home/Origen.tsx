"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { fadeUp, transicionEscalonada, useContadorAnimado } from "@/lib/animation";
import TextoEnCascada from "@/components/storefront/TextoEnCascada";
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
//
// POR QUÉ NO CONTABA (§ ORIGEN-FOTOS-REVELADO-Y-CONTEO-1, medido leyendo el código, no supuesto):
// `useContadorAnimado` devuelve un `ref` que su EFECTO usa para decidir si observa el viewport
// (`const el = ref.current; if (!el || …) { setValor(destino); return; }`, `lib/animation.ts`). Este
// componente lo DESTRUCTURABA pero nunca lo ADJUNTABA a ningún nodo — el `<div>` de abajo no llevaba
// `ref={ref}` en NINGUNA versión desde ORIGEN-BANDA-1. Con `ref.current` SIEMPRE `null`, la rama
// `!el` es SIEMPRE cierta: el efecto corre `setValor(destino)` de inmediato, en el primer render, sin
// montar el `IntersectionObserver` ni el loop de `requestAnimationFrame` — el número aparece YA en su
// valor final, exactamente el defecto que el owner reportó ("deberían cargar… como si estuvieran
// aumentando"). El fix es adjuntar el ref al nodo que la animación mide — abajo, en el `motion.div`
// raíz (framer-motion reenvía su `ref` externo al nodo DOM real, así que el mismo elemento sirve para
// el fade-in Y para el IntersectionObserver del conteo, sin un envoltorio de más).
function OrigenContador({ valor, etiqueta, estatico, preview, indice }: { valor: string; etiqueta: string; estatico: boolean; preview: boolean; indice: number }) {
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
    //
    // Cada cifra escalona su ENTRADA con `indice` (§ ORIGEN-FOTOS-REVELADO-Y-CONTEO-1,
    // `transicionEscalonada`, `lib/animation.ts`) — el mismo `[data-reveal-group]` de 3 hijos que el
    // prototipo declara para `.stats` (`app.css:948-958`, nth-child 1/2/3 → 0/90/180ms). El `ref` del
    // conteo y el `whileInView` del fade-in comparten el MISMO nodo: los dos disparan al entrar en
    // viewport, por umbrales propios (0.4 el conteo, el default de framer-motion el fade), pero sobre
    // el mismo elemento — no hace falta un envoltorio extra para cada mecanismo.
    <motion.div
      ref={ref}
      initial={preview ? false : "hidden"}
      animate={preview ? "visible" : undefined}
      whileInView={preview ? undefined : "visible"}
      viewport={preview ? undefined : { once: true }}
      variants={fadeUp}
      transition={preview ? undefined : transicionEscalonada(indice)}
      className="text-left"
    >
      <b className="block font-playfair text-[40px] leading-[0.98] tracking-[-0.015em] font-normal text-[var(--sf-tinta)]">
        {numeroValido ? Math.round(valorActual).toLocaleString("es-CO") : valor}
      </b>
      <span className="block mt-2 text-base text-[var(--sf-texto-suave)]">{etiqueta}</span>
    </motion.div>
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

  // ÍNDICES DE LA CASCADA DE BLOQUES (§ ORIGEN-TEXTO-POR-BLOQUE-1): eyebrow, título y párrafo son
  // TRES `TextoEnCascada` independientes, cada uno UN bloque entero (ya no palabras, § el
  // docstring de `TextoEnCascada.tsx`), que comparten UN solo escalonado continuo — el título
  // retoma el índice siguiente al del eyebrow, y el párrafo el siguiente al del título — así la
  // cascada se LEE como una sola secuencia (eyebrow → título → párrafo), no como tres piezas que
  // entran todas a la vez. El eyebrow es OPCIONAL: si no hay fila para él, el título ocupa el
  // índice 0 (es la primera pieza en aparecer), no el 1.
  const indiceTitulo = origen.eyebrow ? 1 : 0;
  const indiceParrafo = indiceTitulo + 1;

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
          {/* `.origen-media[data-reveal-group]` del prototipo (`css/app.css:584,589,1013-1014,
              948-958`) — dos figuras, cada una un HIJO que escalona su entrada 0/90ms
              (§ ORIGEN-FOTOS-REVELADO-Y-CONTEO-1, `transicionEscalonada`). El envoltorio del grid
              deja de animarse ÉL MISMO (antes las dos fotos entraban como UN solo bloque, sin el
              escalonado del prototipo) — sigue fijando el layout (gap 20px desde 641px/`--space-5`,
              12px bajo 640/`--space-3`; el desfase del primer marco 48px desde 641px/`--space-12`,
              32px bajo 640/`--space-8`, § PARIDAD-CAFE-Y-ORIGEN-1), sólo que ahora es un `<div>`
              plano y cada figura es el `motion.div` que se revela. */}
          <div className="grid grid-cols-2 gap-3 sm:gap-5 items-start">
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
                Nayoli — byte-idéntica por construcción, no por coincidencia de valores.
                `aspect-[2/3]` (antes `aspect-[3/4]`, el prototipo): marco MÁS ALARGADO por decisión
                del orquestador sobre "más alargado" que el 3:4 medido del prototipo, § el spec de
                ORIGEN-FOTOS-REVELADO-Y-CONTEO-1 — la ÚNICA cifra de este slice que no viene del
                prototipo. */}
            <motion.div
              initial={preview ? false : "hidden"}
              animate={preview ? "visible" : undefined}
              whileInView={preview ? undefined : "visible"}
              viewport={preview ? undefined : { once: true }}
              variants={fadeUp}
              transition={preview ? undefined : transicionEscalonada(0)}
              className="relative aspect-[2/3] overflow-hidden sf-radio-imagen sf-sombra-imagen mt-8 sm:mt-12"
            >
              <Image
                src={origen.imagen1}
                alt="Cerezas de café secándose al sol"
                fill
                sizes="(max-width: 1024px) 50vw, 25vw"
                className="object-cover"
              />
            </motion.div>
            <motion.div
              initial={preview ? false : "hidden"}
              animate={preview ? "visible" : undefined}
              whileInView={preview ? undefined : "visible"}
              viewport={preview ? undefined : { once: true }}
              variants={fadeUp}
              transition={preview ? undefined : transicionEscalonada(1)}
              className="relative aspect-[2/3] overflow-hidden sf-radio-imagen sf-sombra-imagen"
            >
              <Image
                src={origen.imagen2}
                alt="Las manos de un recolector con cerezas de café maduras"
                fill
                sizes="(max-width: 1024px) 50vw, 25vw"
                className="object-cover"
              />
            </motion.div>
          </div>

          {/* La columna de copy NO envuelve eyebrow+h2+lede en un único `motion.div` de bloque —
              cada uno de los tres es un `TextoEnCascada` independiente (§ ORIGEN-TEXTO-POR-
              BLOQUE-1, el docstring de `TextoEnCascada.tsx`) que entra como UNA pieza entera,
              escalonada contra las otras dos por su propio `indice`; el `<div>` envolvente no
              anima. La LISTA DE DATOS sigue escalonando cada fila por separado (§
              `transicionEscalonada`, sin cambios en esta tanda). */}
          <div>
            <div>
              {origen.eyebrow && (
                <TextoEnCascada
                  as="p"
                  texto={origen.eyebrow}
                  className="text-[var(--sf-sobre-banda,var(--sf-acento-texto))] text-xs font-medium tracking-[0.2em] uppercase mb-4"
                  preview={preview}
                  indice={0}
                />
              )}
              <TextoEnCascada
                as="h2"
                texto={origen.titulo}
                className="text-3xl sm:text-4xl font-playfair text-[var(--sf-sobre-banda,var(--sf-tinta))] leading-tight mb-5"
                style={displayL ? { fontSize: displayL } : undefined}
                preview={preview}
                indice={indiceTitulo}
              />
              <TextoEnCascada
                as="p"
                texto={origen.lede}
                className="text-[var(--sf-texto)] leading-relaxed mb-6 text-base"
                preview={preview}
                indice={indiceParrafo}
              />
            </div>

            {datosVisibles.length > 0 && (
              // `.spec-list`/`.spec-list div`/`dt`/`dd` del prototipo (`css/app.css:591-599`) —
              // MEDIDO por computed-style (§ ORIGEN-DATOS-EXACTO-1): la fila es `py-4` (16px,
              // `--space-4`; ERA `py-3`/12px) SIN `items-center` (el prototipo no fija
              // `align-items`, y el computado da `normal` = stretch, no `center`); `dt` lleva
              // `tracking-[0.11em]` (1.32px a 12px, `--tracking-eyebrow` — ERA `tracking-wide`,
              // 0.025em, un tercio de lo medido); `dd` es `text-base` (16px, `--text-body-m` —
              // ERA `text-sm`/14px) en `var(--sf-texto)` (el rol `--text-body`, NO `--sf-tinta`:
              // ese es el rol `--text-heading` que usan el h2/los contadores, no la fila del dato).
              //
              // Cada fila es su propio `motion.div` (antes: un `<div>` plano dentro del bloque de
              // texto, sin revelado propio) — el índice recorre los mismos 4 slots que
              // `[data-reveal-group]` declara en el prototipo para su primer hijo (`nth-child(1..5)`,
              // `app.css:954-958`), § ORIGEN-FOTOS-REVELADO-Y-CONTEO-1.
              <dl className="border-t border-[var(--sf-linea)]">
                {datosVisibles.map(({ key, label, valor }, i) => (
                  <motion.div
                    key={key}
                    initial={preview ? false : "hidden"}
                    animate={preview ? "visible" : undefined}
                    whileInView={preview ? undefined : "visible"}
                    viewport={preview ? undefined : { once: true }}
                    variants={fadeUp}
                    transition={preview ? undefined : transicionEscalonada(i)}
                    className="flex justify-between gap-6 py-4 border-b border-[var(--sf-linea)]"
                  >
                    <dt className="text-[var(--sf-texto-suave)] text-xs uppercase tracking-[0.11em]">{label}</dt>
                    <dd className="text-[var(--sf-texto)] text-base text-right m-0">{valor}</dd>
                  </motion.div>
                ))}
              </dl>
            )}
          </div>
        </div>

        {statsVisibles.length > 0 && (
          // `.stats[data-reveal-group]` del prototipo (`css/app.css:600-604,948-958` + su variante
          // `max-width:640px`, `:992`) — MEDIDO por computed-style (§ ORIGEN-DATOS-EXACTO-1): gap
          // 24px bajo 640px (`--space-6`) y 32px desde 641px (`--space-8`) — ERA `gap-8` fijo
          // siempre, sin la variación por ancho (mt-16/pt-12 sí eran correctos: 64px/48px en las DOS
          // anchuras). Cada cifra escalona su entrada Y su conteo (§ el docstring de `OrigenContador`
          // para el bug del `ref` sin adjuntar, § ORIGEN-FOTOS-REVELADO-Y-CONTEO-1).
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 mt-16 pt-12 border-t border-[var(--sf-linea)]">
            {statsVisibles.map(({ key, numero, etiqueta }, i) => (
              <OrigenContador key={key} valor={numero} etiqueta={etiqueta} estatico={estatico} preview={preview} indice={i} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
