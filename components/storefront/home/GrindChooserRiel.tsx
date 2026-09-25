"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { fadeUp } from "@/lib/animation";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { tarjetasDePresentaciones } from "@/lib/storefront/presentaciones";
import { fontSizeDisplay } from "@/lib/config/escala-display";
import { resolverCtaSeccion } from "@/lib/config/site-content-defaults";

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
// `resolverCtaSeccion` — vacío = sin botón, byte-idéntico. El CTA es SIEMPRE VISIBLE (a diferencia de
// los controles de avance, que sólo aparecen desde `sm`), agrupado con ellos a la derecha de la
// cabecera. La canónica `GrindChooserMosaico` sigue sin CTA propio (esa banda no lo lleva, § site-
// content-defaults.ts, "LA PÁGINA /nosotros" y su nota sobre el anzuelo de la home) — no es un hueco,
// es que nadie lo pidió ahí.
//
// LO QUE EL PROTOTIPO TIENE Y ESTA VARIANTE SIMPLIFICA A PROPÓSITO (medido, no un descuido):
//   1. `quick-acts` (ojo/carrito sobre cada tarjeta, `js/home.js:99-102`): son acciones de FICHA DE
//      PRODUCTO (vista rápida, agregar al carrito de UNA variante concreta). Las tarjetas de esta
//      sección son enlaces a CATEGORÍA (`TarjetaPresentacion.href`, vía `hrefCategoria`), no a un
//      producto puntual — no hay "esa" variante que agregar. Se omiten.
//   2. El resaltado de la tarjeta CENTRADA (`.pres-card.is-active`, opacidad/escala vía
//      `centreIndex`/`markActive` en `js/home.js:113-125`): exige rastrear qué tarjeta está al medio
//      del viewport en cada frame de scroll. No es necesario para que el riel sea usable ni para que
//      se lea como riel (la cabecera partida + el desplazamiento + los controles ya lo hacen); se deja
//      fuera para no sumar una segunda fuente de estado sobre el mismo scroll. Todas las tarjetas se
//      muestran a opacidad/escala plena.
//   3. El arrastre con el mouse (`pointerdown`/`pointermove`, `js/home.js:150-175`): el `overflow-x-
//      auto` nativo ya da drag por touch/trackpad y una barra de scroll utilizable; emular arrastre de
//      mouse es una capa de JS que el desplazamiento nativo no necesita para ser usable.
//
// LA TARJETA NO LLEVA "Ver café {label}" — a DIFERENCIA del mosaico, A PROPÓSITO. El mosaico repite
// ese texto (§ CLAUDE.md, "COPY café-shape del storefront", Backlog #63: "Ver café {label}" es una
// FAMILIA de copy café-shape, no un literal suelto) porque su tarjeta es una tile grande con una sola
// línea de acción; acá el `<h3>`+párrafo ya ocupan ese rol y el CARD ENTERO es el `<Link>` — sumar la
// misma frase habría sido una TERCERA copia del mismo café-shape sin necesidad (el índice tampoco la
// lleva). No agranda la deuda ya anotada; la deja del tamaño que tenía.
//
// El gate de visibilidad (`seccionEsVisible`) vive en el DISPATCHER (`GrindChooser.tsx`), no acá.
//
// EL `negocio` DEL ALT LLEGA POR PROP, no por `useSiteSettings()` — mismo motivo que el mosaico y el
// índice (§ GrindChooserMosaico): se monta también en la vista previa del panel, sin el
// `SiteSettingsProvider` del storefront.
export default function GrindChooserRiel({ negocio, style }: { negocio?: string; style?: React.CSSProperties }) {
  const { presentaciones, tema, paginas } = useSiteContent();
  const preview = useIsPreview();
  const trackRef = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState({ puedeAtras: false, puedeAdelante: false });

  const tarjetas = tarjetasDePresentaciones(presentaciones);
  const ctaHref = resolverCtaSeccion(presentaciones.ctaLabel, presentaciones.ctaDestino, paginas);
  // ESCALA DE DISPLAY (§ TEMAS-ESCALA-DISPLAY-1) — MEDIDO EXACTAMENTE ACÁ: CORTE (`presentaciones:
  // 'riel'`) es el ÚNICO preset que usa esta variante y el ÚNICO que declara `escalaDisplay:
  // 'amplia'`. `undefined` sin escala declarada → NO se toca el `style`, que sigue rindiendo
  // `text-3xl sm:text-4xl` (1.875rem/2.25rem, medido) — byte-idéntico.
  const displayL = fontSizeDisplay(tema.escalaDisplay, 'l');

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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* La cabecera partida (§ arriba): título de un lado, controles del otro. En columna en móvil
            —como el prototipo (`.pres-head{flex-direction:column}` bajo 640px)—, porque ahí los
            controles se ocultan y el título no necesita compartir la fila con nada. */}
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
          {/* El CTA (§ MUESTRARIO-SECCION-CTA-1) + los controles de avance, agrupados a la derecha de
              la cabecera. El CTA es visible en TODO ancho —a diferencia de los controles, ocultos en
              móvil como `.car-nav` del prototipo bajo 640px, donde el touch-scroll ya cubre ese caso—. */}
          <div className="flex shrink-0 items-center gap-3">
            {ctaHref && (
              <Link
                href={ctaHref}
                className="inline-flex shrink-0 items-center gap-2 sf-pildora bg-[var(--sf-accion,var(--sf-tostado))] px-6 py-3 text-sm font-semibold text-[var(--sf-tinta)] transition-all hover:-translate-y-0.5 hover:bg-[var(--sf-tostado-4)]"
              >
                {presentaciones.ctaLabel}
              </Link>
            )}
            <div className="hidden shrink-0 gap-2 sm:flex">
              <button
                type="button"
                onClick={() => desplazar(-1)}
                disabled={!estado.puedeAtras}
                aria-label="Presentación anterior"
                className="grid h-11 w-11 place-items-center border border-[var(--sf-linea)] text-[var(--sf-sobre-banda,var(--sf-tinta))] transition-colors hover:bg-[var(--sf-linea)] disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => desplazar(1)}
                disabled={!estado.puedeAdelante}
                aria-label="Presentación siguiente"
                className="grid h-11 w-11 place-items-center border border-[var(--sf-linea)] text-[var(--sf-sobre-banda,var(--sf-tinta))] transition-colors hover:bg-[var(--sf-linea)] disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* El track: `overflow-x-auto` nativo con snap, sin scrollbar de WebKit a la vista (el
            `<style>` de abajo, scoped a la clase, es el único CSS que este componente necesita fuera
            de Tailwind — no toca `app/globals.css`, fuera de `touches`). `tabIndex` para que un
            usuario de teclado pueda enfocar el riel y desplazarlo con las flechas nativas del
            navegador sobre un contenedor con overflow, sin pasar por los botones. */}
        <style>{".grind-riel-track::-webkit-scrollbar{display:none}"}</style>
        <div
          ref={trackRef}
          role="group"
          aria-label="Presentaciones disponibles"
          tabIndex={0}
          className="grind-riel-track flex gap-6 overflow-x-auto snap-x snap-mandatory pb-2"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {tarjetas.map((op, i) => (
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
              <Link href={op.href} data-sf-tarjeta={preview ? op.slot : undefined} className="group block">
                <div className="relative aspect-[3/4] overflow-hidden rounded-3xl bg-[var(--sf-linea)]">
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
                <div className="pt-4">
                  <h3 className="text-xl font-playfair text-[var(--sf-sobre-banda,var(--sf-tinta))] mb-1 group-hover:underline">{op.label}</h3>
                  <p className="text-sm text-[var(--sf-sobre-banda-suave,var(--sf-texto))]">{op.copy}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
