"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { fadeUp, useIndiceCentrado } from "@/lib/animation";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { tarjetasDePresentaciones, precioMinimoCategoria } from "@/lib/storefront/presentaciones";
import { fontSizeDisplay } from "@/lib/config/escala-display";
import { resolverCtaSeccion } from "@/lib/config/site-content-defaults";
import { getCatalog } from "@/lib/api/products";
import type { Product } from "@/types/product";
import { formatCOP } from "@duna/core/utils";
import { contenedorAnchoClase } from "@/lib/config/themes";

// LA VARIANTE "RIEL" (§ CORTE-PRESENTACIONES-RIEL-1, MEDIDA contra
// `docs/prototipos/cafeone/index.html:225-247` + `css/app.css:508-559` + `js/home.js:90-190`). Mosaico
// apila en un grid y índice enumera en una lista vertical; el riel pone las tarjetas en una fila que
// SE DESPLAZA horizontalmente, con controles de avance — la composición que el prototipo llama
// "carousel" (`.pres-rail`).
//
// EL DESPLAZAMIENTO ES NATIVO, NO UN ESTADO PARALELO (§ el estándar del owner): el track es un
// `overflow-x-auto` normal con `scroll-snap`; los botones de avance/retroceso llaman `scrollBy` sobre
// ESE MISMO elemento — no mueven un índice que después se traduce a un `transform`. Así el riel queda
// usable con el dedo, la rueda del mouse (shift+scroll) o el teclado (`tabIndex` + las flechas nativas
// del navegador sobre un contenedor con overflow) SIN que un solo botón se toque — los botones son un
// atajo sobre el mismo scroll, no el único camino. Respeta `prefers-reduced-motion`
// (`window.matchMedia`, el mismo patrón que ya usa `app/(storefront)/checkout/page.tsx` para su propio
// `window.scrollTo`): con la preferencia activa, el salto es instantáneo en vez de `smooth`. El
// `<MotionConfig reducedMotion="user">` del layout (§ `lib/animation.ts`) cubre las animaciones de
// entrada de `framer-motion`, pero NO un `Element.scrollBy` nativo — por eso este componente lee la
// media query por su cuenta, igual que el checkout.
//
// EL ESTADO `puedeAtras`/`puedeAdelante` SÓLO DESHABILITA LOS BOTONES; NUNCA OCULTA TARJETAS NI
// BLOQUEA EL SCROLL NATIVO. Con la cardinalidad MÍNIMA de esta sección (2 tarjetas, las dos
// requeridas — § `tarjetasDePresentaciones`) es común que las dos quepan sin nada que desplazar: ahí
// los dos botones nacen deshabilitados, y el riel se ve como una fila corta y quieta — no como un
// carrusel roto. Se mide con el propio `scrollWidth`/`clientWidth` del track, recalculado en cada
// scroll y en cada resize; en SSR (sin `useEffect`) los dos botones parten deshabilitados, que es el
// estado seguro (nunca prometen un desplazamiento que todavía no se pudo medir).
//
// LA CABECERA PARTE EN DOS, COMO EL PROTOTIPO (`.pres-head`): antetítulo+título de un lado, el CTA
// "Comprar" de `.pres-head` (`index.html:233`) del otro — un ATAJO SOBRE EL PROPIO SCROLL, no
// fabricado. `presentaciones.ctaLabel`/`.ctaDestino` (§ MUESTRARIO-SECCION-CTA-1, la capacidad
// GENERAL: cualquier sección puede declarar su propio botón opcional) resuelven el href con
// `resolverCtaSeccion` — vacío = sin botón, byte-idéntico. La canónica `GrindChooserMosaico` sigue
// sin CTA propio (esa banda no lo lleva, § site-content-defaults.ts, "LA PÁGINA /nosotros" y su nota
// sobre el anzuelo de la home) — no es un hueco, es que nadie lo pidió ahí.
//
// LOS CONTROLES DE AVANCE VIVEN DEBAJO DEL TRACK, NO EN LA CABECERA (§ PARIDAD-RIEL-TARJETAS-1,
// MEDIDO contra `riel-antes-1440`/`riel-antes-390`, DECISIONS.md, y `.car-nav` del prototipo,
// `index.html:241-246` + `css/app.css:553-559`). Antes vivían agrupados con el CTA en la cabecera
// —una posición que el prototipo NUNCA usa: `.car-nav` es un bloque APARTE, DESPUÉS de `.pres-rail`,
// alineado a la derecha—. Siguen ocultos bajo `sm` (`.car-nav{display:none}` bajo 640px,
// `css/app.css:1008` — el touch-scroll ya cubre ese caso ahí) y siguen llamando al MISMO `desplazar`
// sobre el MISMO `trackRef`; sólo cambió DÓNDE se pintan, no la mecánica de scroll.
//
// LO QUE EL PROTOTIPO TIENE Y ESTA VARIANTE SIMPLIFICA A PROPÓSITO (medido, no un descuido):
//   1. `quick-acts` (ojo/carrito sobre cada tarjeta, `js/home.js:99-102`): son acciones de FICHA DE
//      PRODUCTO (vista rápida, agregar al carrito de UNA variante concreta). Las tarjetas de esta
//      sección son enlaces a CATEGORÍA (`TarjetaPresentacion.href`, vía `hrefCategoria`), no a un
//      producto puntual — no hay "esa" variante que agregar. Se omiten.
//   2. El arrastre con el mouse (`pointerdown`/`pointermove`, `js/home.js:150-175`): el `overflow-x-
//      auto` nativo ya da drag por touch/trackpad y una barra de scroll utilizable; emular arrastre de
//      mouse es una capa de JS que el desplazamiento nativo no necesita para ser usable.
//
// EL RESALTADO DE LA TARJETA CENTRADA (`.pres-card.is-active`, § MUESTRARIO-RIEL-ACTIVO-1) YA NO
// ESTÁ FUERA — el comentario de este archivo lo descartaba porque construirlo habría exigido "una
// segunda fuente de estado sobre el mismo scroll" y esa capacidad no existía en `lib/animation.ts`.
// Ahora existe (`useIndiceCentrado`, abajo): DERIVA el índice centrado del scroll REAL del propio
// `trackRef` — el mismo elemento que ya desplazan los botones y el `overflow-x-auto` nativo —, así
// que sigue sin haber un índice paralelo que sincronizar. La tarjeta activa gana la
// opacidad/escala de `.pres-card.is-active` (`css/app.css:520-525`); las demás quedan dimmed, igual
// que el prototipo. Bajo 640px el prototipo APAGA el resaltado (`css/app.css:1010`,
// `.pres-card,.pres-card.is-active{opacity:1;transform:none}`) — acá se reproduce dejando el
// resaltado detrás de `sm:`, la MISMA cabecera de breakpoint que ya oculta los controles de avance.
// LA TARJETA NO LLEVA "Ver café {label}" — a DIFERENCIA del mosaico, A PROPÓSITO. El mosaico repite
// ese texto (§ CLAUDE.md, "COPY café-shape del storefront", Backlog #63: "Ver café {label}" es una
// FAMILIA de copy café-shape, no un literal suelto) porque su tarjeta es una tile grande con una sola
// línea de acción; acá el `<h3>`+párrafo ya ocupan ese rol y el CARD ENTERO es el `<Link>` — sumar la
// misma frase habría sido una TERCERA copia del mismo café-shape sin necesidad (el índice tampoco la
// lleva). No agranda la deuda ya anotada; la deja del tamaño que tenía.
//
// EL TILE Y EL PRECIO (§ PARIDAD-RIEL-TARJETAS-1) — el segundo hallazgo medido contra
// `riel-antes-1440`/`riel-antes-390` (DECISIONS.md), junto a la posición de los controles (arriba):
//   1. El tile pasó de `rounded-3xl` (var(--radius-3xl), CERO bajo CORTE 'recta' — la tarjeta salía
//      CUADRADA) a `sf-radio-tile` (§ formas.ts, `Forma.radioTile`/`--sf-radio-tile`): el ROL propio
//      de tile grande, 20px medido bajo 'recta' (`--radius-tile`, tokens.css:169), separado del
//      escalón de control chico (`sf-radio-lg`, 2px).
//   2. NOMBRE Y PRECIO EN UNA LÍNEA (`.pres-meta{display:flex;justify-content:space-between}`,
//      `css/app.css:549-552`): el precio es `precioMinimoCategoria(catalog, op.cat)` (§
//      lib/storefront/presentaciones.ts) — el MENOR precio real entre los productos ACTIVOS de la
//      categoría de destino de la tarjeta, NUNCA un literal. El catálogo llega por
//      `getCatalog()` (el MISMO fetch memoizado que ya usa Spotlight/Marquesina, § su propio
//      docstring), en un `useEffect` — así que en SSR (sin efectos) el catálogo queda `[]` y ninguna
//      tarjeta muestra precio hasta que el navegador lo resuelve; es el mismo límite ya documentado
//      para Spotlight en `admin-tienda-preset.test.ts` (el catálogo interno nunca sale de `[]` bajo
//      `renderToStaticMarkup`), y por lo mismo es SEGURO montar este componente en la vista previa
//      del panel (`VistaTiendaEnVivo`) sin CartProvider ni ningún provider nuevo: no hay hook que
//      dependa de uno — `getCatalog` es un `fetch` liso, no `useCartStore`. Categoría SIN productos
//      (destino rancio) → `precioMinimoCategoria` da `null` → el componente OMITE el precio, nunca
//      inventa "$0".
//
// El gate de visibilidad (`seccionEsVisible`) vive en el DISPATCHER (`GrindChooser.tsx`), no acá.
//
// EL `negocio` DEL ALT LLEGA POR PROP, no por `useSiteSettings()` — mismo motivo que el mosaico y el
// índice (§ GrindChooserMosaico): se monta también en la vista previa del panel, sin el
// `SiteSettingsProvider` del storefront.
export default function GrindChooserRiel({ negocio, style }: { negocio?: string; style?: React.CSSProperties }) {
  const { presentaciones, tema, paginas, navTratamiento } = useSiteContent();
  const preview = useIsPreview();
  const trackRef = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState({ puedeAtras: false, puedeAdelante: false });

  const tarjetas = tarjetasDePresentaciones(presentaciones);
  const indiceActivo = useIndiceCentrado(trackRef, tarjetas.length);
  const ctaHref = resolverCtaSeccion(presentaciones.ctaLabel, presentaciones.ctaDestino, paginas);

  // EL PRECIO "DESDE" (§ PARIDAD-RIEL-TARJETAS-1, el docstring de cabecera). `getCatalog()` es el
  // MISMO fetch memoizado que Spotlight/Marquesina — no una segunda implementación—; en SSR el
  // `useEffect` nunca corre, así que `catalog` queda `[]` y `precioMinimoCategoria` da `null` para
  // toda tarjeta (ninguna muestra precio), sin lanzar.
  const [catalog, setCatalog] = useState<Product[]>([]);
  useEffect(() => {
    getCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);
  // ESCALA DE DISPLAY (§ TEMAS-ESCALA-DISPLAY-1) — MEDIDO EXACTAMENTE ACÁ: CORTE (`presentaciones:
  // 'riel'`) es el ÚNICO preset que usa esta variante y el ÚNICO que declara `escalaDisplay:
  // 'amplia'`. `undefined` sin escala declarada → NO se toca el `style`, que sigue rindiendo
  // `text-3xl sm:text-4xl` (1.875rem/2.25rem, medido) — byte-idéntico.
  const displayL = fontSizeDisplay(tema.escalaDisplay, 'l');
  // EL CONTENEDOR (§ PARIDAD-ANCHO-CONTENIDO-1) — ver el docstring de `contenedorAnchoClase`
  // (`lib/config/themes.ts`) para el porqué de reusar `navTratamiento.posicion` acá. `false`
  // (todo tenant salvo CORTE) = el literal de HOY, byte a byte. El ANCHO de cada tile
  // (`w-[78vw] sm:w-[clamp(260px,26vw,360px)]`, más abajo) es relativo al VIEWPORT, no a este
  // contenedor, así que no cambia — sólo cambia cuánto track queda visible antes de scrollear.
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    function medir() {
      if (!track) return;
      setEstado({
        puedeAtras: track.scrollLeft > 4,
        puedeAdelante: track.scrollLeft + track.clientWidth < track.scrollWidth - 4,
      });
    }
    medir();
    track.addEventListener("scroll", medir, { passive: true });
    window.addEventListener("resize", medir);
    return () => {
      track.removeEventListener("scroll", medir);
      window.removeEventListener("resize", medir);
    };
    // Recalcula si cambia el número de tarjetas (borrador del editor agregando/quitando una) — el
    // ancho del track puede cambiar sin que el usuario haya scrolleado todavía.
  }, [tarjetas.length]);

  function desplazar(direccion: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    track.scrollBy({ left: direccion * track.clientWidth * 0.9, behavior: reduce ? "auto" : "smooth" });
  }

  return (
    <section className="py-20 bg-[var(--sf-banda,var(--sf-fondo))] overflow-hidden" style={style}>
      <div className={`${contenedorClase} mx-auto`}>
        {/* La cabecera partida (§ arriba): título de un lado, el CTA del otro — SIN los controles de
            avance, que ahora viven DEBAJO del track (§ el docstring de cabecera). En columna en
            móvil, como el prototipo (`.pres-head{flex-direction:column}` bajo 640px). */}
        <div className="flex flex-col items-start gap-5 mb-10 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <motion.div
            initial={preview ? false : "hidden"}
            animate={preview ? "visible" : undefined}
            whileInView={preview ? undefined : "visible"}
            viewport={preview ? undefined : { once: true }}
            variants={fadeUp}
          >
            {presentaciones.eyebrow && (
              <p className="text-[var(--sf-sobre-banda,var(--sf-acento-texto))] text-xs font-medium tracking-[0.2em] uppercase mb-2">{presentaciones.eyebrow}</p>
            )}
            <h2 className="text-3xl sm:text-4xl font-playfair text-[var(--sf-sobre-banda,var(--sf-tinta))] whitespace-pre-line" style={displayL ? { fontSize: displayL } : undefined}>{presentaciones.titulo}</h2>
          </motion.div>
          {/* El CTA (§ MUESTRARIO-SECCION-CTA-1), SOLO — `.pres-head` del prototipo no lleva nada
              más a la derecha (`index.html:228-234`: título de un lado, `.btn--primary` del otro). */}
          {ctaHref && (
            <Link
              href={ctaHref}
              className="inline-flex shrink-0 items-center gap-2 sf-pildora bg-[var(--sf-accion,var(--sf-tostado))] px-6 py-3 text-sm font-semibold text-[var(--sf-accion-txt,var(--sf-tinta))] transition-all hover:-translate-y-0.5 hover:bg-[var(--sf-accion-hover,var(--sf-tostado-4))]"
            >
              {presentaciones.ctaLabel}
            </Link>
          )}
        </div>

        {/* El track: `overflow-x-auto` nativo con snap, sin scrollbar de WebKit a la vista (el
            `<style>` de abajo, scoped a la clase, es el único CSS que este componente necesita fuera
            de Tailwind — no toca `app/globals.css`, fuera de `touches`). `tabIndex` para que un
            usuario de teclado pueda enfocar el riel y desplazarlo con las flechas nativas del
            navegador sobre un contenedor con overflow, sin pasar por los botones.

            `sm:py-6` — EL FIX de RIEL-SCROLL-Y-BADGE-DORADO-1 (MEDIDO, no supuesto). `overflow-x-
            auto` fuerza, por regla de la especificación CSS (si un eje se declara distinto de
            `visible`, el otro eje — si es `visible` — se COMPUTA como `auto`; no hay forma de
            declarar `overflow-y: visible` que sobreviva esa regla), que este track sea también
            contenedor de scroll VERTICAL — algo que nadie pidió. Sin overflow vertical real eso es
            inerte (0 rango, nada que capturar); pero la tarjeta RESALTADA (`sm:scale-[1.06]`, arriba)
            desborda su caja de layout ~6% por los cuatro lados vía `transform` — un desborde de
            PINTADO, no de layout, que SÍ cuenta para el `scrollHeight` del contenedor con overflow no-
            visible. Medido contra una reproducción fiel de esta tarjeta (peor caso: card de 360px de
            ancho, imagen 3/4 + texto ≈ 548px de alto): antes del fix, `scrollHeight` (518) > `client-
            Height` (511) — 7px de rango vertical real, aunque chico; el track pasa a ser un scroll
            vertical con algo que recorrer, que es la condición que un scroll-chaining real (rueda o
            trackpad, con la semántica de "fase"/momentum que un evento sintético no siempre replica)
            puede latchear y sentir "pegado". El fix RESERVA ese espacio en vez de recortarlo:
            `sm:py-6` (24px arriba y abajo, ≥ el peor caso medido de ~16.44px por lado) sube el propio
            `clientHeight` del track para que la tarjeta escalada NUNCA lo exceda —
            `scrollHeight === clientHeight`, medido 560/560 tras el fix, en la misma reproducción—: el
            track deja de tener NADA que desplazar en vertical, sin depender de qué motor de scroll-
            chaining lo interprete. Sólo desde `sm:` porque el resaltado se apaga bajo 640px (§ arriba,
            "Bajo 640px el prototipo APAGA el resaltado") — bajo ese ancho no hay escala que reservar,
            y `pb-2` (el gap visual sobre el scrollbar oculto) se queda para ese caso. El desplaza-
            miento horizontal, el snap, los botones, el arrastre y el índice centrado no cambian. */}
        <style>{".grind-riel-track::-webkit-scrollbar{display:none}"}</style>
        <div
          ref={trackRef}
          role="group"
          aria-label="Presentaciones disponibles"
          tabIndex={0}
          className="grind-riel-track flex gap-6 overflow-x-auto snap-x snap-mandatory pb-2 sm:py-6"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {tarjetas.map((op, i) => {
            // El resaltado (§ MUESTRARIO-RIEL-ACTIVO-1) va en el `<Link>`, no en el `motion.div` —
            // framer-motion escribe `opacity`/`transform` INLINE sobre el `motion.div` al resolver
            // `fadeUp` (mayor especificidad que cualquier clase), así que una clase de opacidad/
            // escala puesta ahí quedaría pisada por esa animación de entrada. El `<Link>` es un
            // elemento distinto: su propio `transform`/`opacity` compone con el del padre sin
            // pelear por la misma propiedad inline.
            //
            // `indiceActivo === null` (sin medir todavía, SSR/primer render) es el estado SEGURO
            // —igual que `puedeAtras`/`puedeAdelante` arrancan deshabilitados—: ninguna tarjeta se
            // marca ni resaltada ni dimmed hasta saber cuál está centrada de verdad.
            const resaltada = indiceActivo !== null && indiceActivo === i;
            const dimmed = indiceActivo !== null && indiceActivo !== i;
            return (
            <motion.div
              key={i}
              initial={preview ? false : "hidden"}
              animate={preview ? "visible" : undefined}
              whileInView={preview ? undefined : "visible"}
              viewport={preview ? undefined : { once: true }}
              variants={fadeUp}
              transition={{ delay: i * 0.08 }}
              className="w-[78vw] shrink-0 snap-center sm:w-[clamp(260px,26vw,360px)]"
            >
              {/* `data-sf-tarjeta`: marcador INERTE del slot (1-4) para el puente vista→formulario del
                  editor (§ Backlog #46), gemelo del mosaico y el índice. Sólo en preview. */}
              <Link
                href={op.href}
                data-sf-tarjeta={preview ? op.slot : undefined}
                className={`group block opacity-100 scale-100 transition-[opacity,transform] duration-500 ease-out ${
                  resaltada ? "sm:scale-[1.06]" : dimmed ? "sm:opacity-[.62] sm:scale-[.96]" : ""
                }`}
              >
                {/* El tile: `sf-radio-tile` (§ el docstring de cabecera) — el rol PROPIO de forma
                    para media grande, 20px bajo CORTE 'recta' (`--radius-tile`, MEDIDO), no
                    `rounded-3xl` (var(--radius-3xl), CERO bajo 'recta' — la tarjeta salía cuadrada). */}
                <div className="relative aspect-[3/4] overflow-hidden sf-radio-tile bg-[var(--sf-linea)]">
                  {/* Imagen condicional (criterio OR, § tarjetasDePresentaciones): sin foto se ve el
                      hueco de marca `--sf-linea`, nunca un `<img src="">` roto. */}
                  {op.img && (
                    <Image
                      src={op.img}
                      alt={negocio ? `${negocio} ${op.label}` : op.label}
                      fill
                      sizes="(max-width: 640px) 78vw, 360px"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                </div>
                {/* NOMBRE Y PRECIO EN UNA LÍNEA (`.pres-meta{display:flex;justify-content:space-
                    between}`, § el docstring de cabecera) — el precio se OMITE (no "$0") si el
                    catálogo aún no cargó o el destino es una categoría rancia sin productos. */}
                <div className="pt-4">
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="text-xl font-playfair text-[var(--sf-sobre-banda,var(--sf-tinta))] group-hover:underline">{op.label}</h3>
                    {(() => {
                      const precio = precioMinimoCategoria(catalog, op.cat);
                      return precio != null ? (
                        <span className="shrink-0 text-base text-[var(--sf-sobre-banda-suave,var(--sf-texto-suave))]">
                          Desde {formatCOP(precio)}
                        </span>
                      ) : null;
                    })()}
                  </div>
                  <p className="mt-1 text-sm text-[var(--sf-sobre-banda-suave,var(--sf-texto))]">{op.copy}</p>
                </div>
              </Link>
            </motion.div>
            );
          })}
        </div>

        {/* Los controles de avance, DEBAJO del track (§ el docstring de cabecera — `.car-nav` del
            prototipo). Ocultos bajo `sm` (el touch-scroll ya cubre ese caso en móvil). */}
        <div className="hidden justify-end gap-2 sm:flex">
          <button
            type="button"
            onClick={() => desplazar(-1)}
            disabled={!estado.puedeAtras}
            aria-label="Presentación anterior"
            className="grid h-12 w-12 place-items-center border border-[var(--sf-linea)] text-[var(--sf-sobre-banda,var(--sf-tinta))] transition-colors hover:bg-[var(--sf-linea)] disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => desplazar(1)}
            disabled={!estado.puedeAdelante}
            aria-label="Presentación siguiente"
            className="grid h-12 w-12 place-items-center border border-[var(--sf-linea)] text-[var(--sf-sobre-banda,var(--sf-tinta))] transition-colors hover:bg-[var(--sf-linea)] disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
