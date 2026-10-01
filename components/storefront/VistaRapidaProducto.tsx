"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";

import type { Product } from "@/types/product";
import { useCartStore } from "@/lib/cartStore";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { esClickAfuera } from "@/lib/cierre-afuera";
import { clasesBotonesCompra } from "@/lib/storefront/pdp-botones";
import GaleriaProducto from "@/components/storefront/pdp/GaleriaProducto";
import {
  galeriaVistaRapida,
  moliendaInicialVistaRapida,
  clampCantidadVistaRapida,
  accionVistaRapida,
} from "@/lib/storefront/vista-rapida";
import { motion, AnimatePresence } from "framer-motion";
import { formatCOP } from "@duna/core/utils";

// components/storefront/VistaRapidaProducto.tsx — § RIEL-PRODUCTOS-Y-VISTA-RAPIDA-1
//
// El modal del "ojo" de cada tarjeta del riel de Presentaciones (§ GrindChooserRiel.tsx): galería
// con flechas, nombre, precio, descripción, selector de molienda (si el producto declara opciones,
// § abajo — la MISMA condición que /tienda/[slug]), selector de cantidad, "Agregar al carrito"
// (secundario) y "Comprar ahora" (primario) con el MISMO tratamiento de la ficha
// (`clasesBotonesCompra`, § lib/storefront/pdp-botones.ts), y cerrar.
//
// LA REFERENCIA es la vista rápida del TEMA REAL (captura del owner, "Guji Coba Pack"), no la del
// prototipo local (`docs/prototipos/cafeone/js/home.js`, su modal es más simple: una sola foto,
// sin galería con flechas ni selector de molienda) — el owner lo pidió explícito sobre esa captura:
// "debería abrirse un modal como el adjunto de cafeone (Guji Coba Pack)".
//
// SIN NOTA DE IMPUESTOS (a diferencia de `Spotlight.tsx`, que sí lleva `notaPrecio`): no hay un
// campo de `SiteContent` que la respalde para esta sección, y un texto fijo sería un dato inventado
// (§ CLAUDE.md, "El rating fabricado se BORRÓ" — la misma familia: no se hornea un dato de tienda
// que nadie configuró).
//
// CIERRA con la X, Escape y clic afuera — reusa `lib/cierre-afuera.ts` (`esClickAfuera`), el MISMO
// mecanismo que ya usan el mega-menú y el buscador del nav (`StoreNav.tsx`/`NavSearch.tsx`,
// § NAV-CIERRE-CLICK-AFUERA-1): un `pointerdown` en CAPTURA sobre `document`, que decide por
// CONTENCIÓN DE ÁRBOL (`Node.contains`), no por dónde pintó el navegador el fondo. El foco vuelve al
// DISPARADOR (el botón "ojo" que abrió el modal, recibido por prop) con el mismo `.focus()` diferido
// a un macrotask que ya documenta `NavSearch.tsx` — gana la carrera contra el foco-por-defecto del
// navegador tras un click-afuera.
//
// FOCO ATRAPADO: un `Tab`/`Shift+Tab` que saldría del panel (último/primer foco enfocable) vuelve a
// entrar por el otro extremo, en vez de escapar al resto de la página detrás del velo — el panel
// mismo, no el navegador, decide dónde da la vuelta.
//
// SCROLL DE LA PÁGINA BLOQUEADO mientras está abierto (`document.body.style.overflow`), restaurado
// al cerrar/desmontar — no hay una primitiva compartida de scroll-lock en el storefront (censo:
// `CartDrawer.tsx`/`NavSearch.tsx` no lo bloquean), así que este modal lo hace por su cuenta, como
// cualquier diálogo que cubre la pantalla.
//
// SIN PORTAL (`createPortal`): ningún componente del storefront usa uno (censo:
// `grep -rln createPortal` da cero en todo el repo) — el patrón establecido es `position:fixed`
// dentro del propio árbol, como `CartDrawer.tsx`. Un portal a `document.body` escaparía además del
// `transform:scale` de la vista previa en vivo del panel (`EscalaDesktop`), que es justo lo que un
// `position:fixed` normal NO hace (un ancestro con `transform` es su containing block) — mantiene el
// modal consistente entre el storefront real y la vista previa del panel.
//
// SÓLO EL RIEL LO USA HOY — componente reutilizable, sin conocimiento de quién lo monta: recibe el
// producto y el disparador por prop, nada de `useSiteContent()` fuera de lo que ya necesita
// (`tema.origenAccion`, compartido con la ficha).
//
// LA GALERÍA ES LA MISMA QUE LA FICHA (§ DESTACADO-PANEL-COMPLETO-Y-BOTONES-PDP-1, cierra
// `VISTA-RAPIDA-MISMO-BORDE-1` y `GALERIA-VISTA-RAPIDA-SIN-FLECHAS-1`): este modal montaba su PROPIA
// foto (`object-contain p-6`, dejando ver el fondo de estudio de la imagen como un borde — el MISMO
// defecto que `FOTOS-SIN-BORDE-LINEA-NAV-FLECHAS-PDP-1` ya cerró en `Spotlight.tsx`/`TarjetaRiel`) y
// un PAR de flechas manuales, sin teclado ni swipe. En vez de duplicar esa lógica una tercera vez, se
// monta `GaleriaProducto` (`components/storefront/pdp/GaleriaProducto.tsx`) TAL CUAL — las mismas
// flechas/teclado/deslizar/miniaturas que `/tienda/[slug]`, sin una segunda implementación. Se le da
// `key={productoMostrado.slug}` para que REMONTE (y resetee su índice) cada vez que el producto
// mostrado cambia — el mismo efecto que antes lograba el `useEffect` de abajo con `setImgIdx(0)`,
// necesario porque el modal puede pasar DIRECTO de un producto a otro sin que `abierto` pase por
// `false` (dos "ojos" distintos clickeados mientras el modal ya estaba abierto).

//
// CURSOR: pointer explícito en cerrar/flechas de galería/cantidad (§ RIEL-SUBRAYADO-CURSOR-
// NITIDEZ-1) — MEDIDO, no supuesto: Tailwind v4 no agrega `cursor:pointer` a `<button>` (a
// diferencia de Tailwind v3, que sí lo hacía en Preflight), y el UA no lo pone solo, así que sin la
// clase estos controles se ven clickeables pero el cursor no lo confirma. Los botones de
// "Agregar/Comprar" NO lo necesitan acá: ya lo llevan desde `PRIMARIO_CORTE`/`SECUNDARIO_CORTE`
// (`lib/storefront/pdp-botones.ts`) — este modal sólo monta bajo `origenAccion:'acento'` (CORTE),
// así que nunca cae en el branch `_DEFECTO` (Nayoli) que carece de `cursor-pointer`. Los botones de
// molienda, más abajo, YA lo tenían (`cursor-pointer`/`cursor-not-allowed` explícitos) — no se
// tocan.
//
// EL MODAL ENTERO ABRÍA/CERRABA DE GOLPE — § MENU-MOVIL-MARGEN-Y-CENSO-TRANSICIONES-1 (censo de
// transiciones, 2026-09-30). El `<motion.div key={imgIdx}>` de la galería (entonces propia de este
// archivo; hoy vive DENTRO de `GaleriaProducto`, § DESTACADO-PANEL-COMPLETO-Y-BOTONES-PDP-1) SÍ
// crossfadeaba al cambiar de foto, pero el CONTENEDOR del modal (velo + panel) era un `<div>` plano: con
// `if (!producto) return null` como única puerta, React lo desmonta/monta en el MISMO tick que
// cambia `producto` — sin `AnimatePresence` de por medio no hay exit que animar, así que aparecía y
// desaparecía en un frame. Es la MISMA familia de defecto que el drawer móvil de `StoreNav.tsx`
// (§ ese archivo) pero en su forma MÁS aguda: ahí el `exit` SÍ estaba declarado (medido con
// Playwright: opacity 1→0 en ~220ms) y sólo faltaba Escape; acá no había ni motion ni exit en el
// contenedor — medido por lectura del código (sin `motion.*` en la fila de arriba de este comentario
// hasta el `<div className="fixed inset-0…">` de abajo), no por ejecución (no hace falta correr un
// navegador para confirmar la AUSENCIA de un import/uso).
//
// EL FIX: `AnimatePresence` + `motion.div` en el velo Y en el panel (opacity, panel con `y` además),
// gateado por `abierto` (no por `producto` directo). Como los EFECTOS (Escape/Tab/click-afuera/
// scroll-lock, arriba) y el resto de la lógica de render leen `producto`/`producto.campo` en varios
// puntos, y `producto` se vuelve `null` en el MISMO instante en que arranca la salida, se agrega
// `productoMostrado` — un snapshot del ÚLTIMO producto no-nulo — para que el panel tenga qué
// mostrar mientras se desvanece (200ms) en vez de crashear leyendo `null.nombre`. `abierto` sigue
// derivándose de `producto` (la fuente de verdad de "¿está abierto?"), nunca de `productoMostrado`
// (que por diseño SOBREVIVE un tic más que `producto`, y usarlo para "abierto" nunca cerraría el
// panel).
export interface VistaRapidaProductoProps {
  /** El producto a mostrar. `null` = el modal está CERRADO. */
  producto: Product | null;
  /** El botón "ojo" que abrió el modal — recibe el foco de vuelta al cerrar. `null` cuando no hay
   *  disparador que recordar (p. ej. en un test o un cierre sin puntero de por medio). */
  disparador: HTMLElement | null;
  onClose: () => void;
}

export default function VistaRapidaProducto({ producto, disparador, onClose }: VistaRapidaProductoProps) {
  const { addItem } = useCartStore();
  const { tema } = useSiteContent();
  const { primario: claseBotonComprar, secundario: claseBotonAgregar } = clasesBotonesCompra(tema.origenAccion);

  const panelRef = useRef<HTMLDivElement>(null);
  const cerrarBtnRef = useRef<HTMLButtonElement>(null);

  const abierto = producto !== null;

  const [cantidad, setCantidad] = useState(1);
  const [molienda, setMolienda] = useState<string | null>(null);
  // El SNAPSHOT del último producto no-nulo (§ el docstring de cabecera) — sobrevive el tic en que
  // `producto` se vuelve `null` para que el panel tenga qué renderizar mientras `exit` se reproduce.
  const [productoMostrado, setProductoMostrado] = useState<Product | null>(null);
  useEffect(() => {
    if (producto) setProductoMostrado(producto);
  }, [producto]);

  function cerrarYDevolverFoco() {
    onClose();
    // Diferido a un macrotask (§ el docstring de cabecera): un `pointerdown` de click-afuera deja
    // que el navegador resuelva PRIMERO su propio foco-por-defecto; un `.focus()` síncrono acá
    // quedaría pisado.
    setTimeout(() => disparador?.focus(), 0);
  }

  // Reinicia el estado interno CADA VEZ que se abre un producto — el mismo producto reabierto (o
  // otro distinto) no debe heredar la cantidad/molienda que había dejado el anterior. La FOTO ya no
  // vive acá: `GaleriaProducto` se remonta sola por su `key={productoMostrado.slug}` (§ el docstring
  // de cabecera).
  useEffect(() => {
    if (!producto) return;
    setCantidad(1);
    setMolienda(moliendaInicialVistaRapida(producto.moliendasOpciones));
  }, [producto]);

  useEffect(() => {
    if (!abierto) return;
    const t = setTimeout(() => cerrarBtnRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        cerrarYDevolverFoco();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const nodos = Array.from(
        panel.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      ).filter((n) => !n.hasAttribute("disabled"));
      if (nodos.length === 0) return;
      const primero = nodos[0];
      const ultimo = nodos[nodos.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    function handlePointerDown(e: PointerEvent) {
      if (esClickAfuera(e.target, [panelRef.current])) cerrarYDevolverFoco();
    }
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, [abierto]);

  // `productoMostrado`, no `producto`: nunca se abrió (siempre `null`) o ya terminó de cerrarse
  // (AnimatePresence retiró el nodo, no hay nada que animar). Mientras `abierto` es `true` los dos
  // valen lo mismo; en el tramo de salida `producto` ya es `null` y `productoMostrado` sostiene el
  // panel para que el `exit` tenga contenido real que desvanecer.
  if (!productoMostrado) return null;

  const galeria = galeriaVistaRapida(productoMostrado);
  const maxCompra = productoMostrado.maxCompra ?? 1;
  const accion = accionVistaRapida(productoMostrado.moliendasOpciones, molienda);

  function confirmar() {
    if (!accion.puede) {
      toast.error(accion.mensajeError ?? "Selecciona una molienda disponible");
      return;
    }
    // `productoMostrado` ya se verificó no-null arriba, pero TS no propaga esa narrowing dentro de
    // una función declarada más abajo en el mismo cuerpo — el mismo patrón que ya acepta
    // /tienda/[slug] con `product.moliendasOpciones!`.
    addItem(productoMostrado!, cantidad, molienda ? { molienda } : {});
    toast.success(`${productoMostrado!.nombre} agregado al carrito`);
    cerrarYDevolverFoco();
  }

  return (
    <AnimatePresence>
      {abierto && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          role="presentation"
        >
          <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-modal="true"
            aria-label={`Vista rápida de ${productoMostrado.nombre}`}
            className="relative grid max-h-[90vh] w-full max-w-3xl grid-cols-1 gap-6 overflow-y-auto rounded-3xl bg-[var(--sf-tarjeta)] p-6 shadow-2xl sm:grid-cols-2 sm:p-8"
          >
        <button
          ref={cerrarBtnRef}
          type="button"
          onClick={cerrarYDevolverFoco}
          aria-label="Cerrar"
          className="absolute right-4 top-4 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-[var(--sf-texto)] transition-colors hover:bg-[var(--sf-superficie)]"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Galería — la MISMA que la ficha (§ el docstring de cabecera): llena su marco
            (`object-cover`, sin el relleno que dejaba ver el fondo de estudio como un borde) y
            comparte flechas/teclado/deslizar vía `GaleriaProducto`, sin una segunda
            implementación. `key` por slug: remonta (y resetea su índice) con cada producto. */}
        <GaleriaProducto key={productoMostrado.slug} galeria={galeria} nombre={productoMostrado.nombre} />

        {/* Info */}
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="font-playfair text-2xl text-[var(--sf-tinta)]">{productoMostrado.nombre}</h2>
            <p className="mt-1 text-2xl font-bold text-[var(--sf-tinta)]">{formatCOP(productoMostrado.precio)}</p>
          </div>

          {productoMostrado.descripcion && (
            <p className="text-sm leading-relaxed text-[var(--sf-texto)]">{productoMostrado.descripcion}</p>
          )}

          {/* Molienda — la MISMA condición y lógica que /tienda/[slug] (length>0, no sólo >1): el
              producto con una sola opción también la muestra, ya elegida. */}
          {(productoMostrado.moliendasOpciones?.length ?? 0) > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--sf-texto)]">Tipo de molienda</p>
              <div className="flex flex-wrap gap-2">
                {productoMostrado.moliendasOpciones!.map((o) => {
                  const selected = molienda === o.nombre;
                  return (
                    <button
                      key={o.nombre}
                      type="button"
                      disabled={!o.disponible}
                      onClick={() => o.disponible && setMolienda(o.nombre)}
                      title={o.disponible ? undefined : "Próximamente"}
                      className={`sf-radio-lg border px-3 py-2 text-left text-xs transition-all ${
                        selected
                          ? "border-[var(--sf-acento)] bg-[var(--sf-acento)]/5"
                          : o.disponible
                            ? "border-[var(--sf-linea)] hover:border-[var(--sf-acento)]/40 cursor-pointer"
                            : "border-[var(--sf-linea)] opacity-40 cursor-not-allowed"
                      }`}
                    >
                      <span className={`block font-medium ${selected ? "text-[var(--sf-acento-texto)]" : "text-[var(--sf-tinta)]"}`}>{o.nombre}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {productoMostrado.disponible ? (
            <div className="mt-auto flex flex-col gap-3">
              <div className="flex items-center gap-2 self-start rounded-xl bg-[var(--sf-superficie)] px-1">
                <button
                  type="button"
                  onClick={() => setCantidad((c) => clampCantidadVistaRapida(c - 1, maxCompra))}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-[var(--sf-linea)]"
                  aria-label="Quitar una unidad"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center font-semibold text-[var(--sf-tinta)]">{cantidad}</span>
                <button
                  type="button"
                  onClick={() =>
                    setCantidad((c) => {
                      if (c >= maxCompra) {
                        toast.error("Cantidad no disponible");
                        return c;
                      }
                      return clampCantidadVistaRapida(c + 1, maxCompra);
                    })
                  }
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-[var(--sf-linea)]"
                  aria-label="Agregar una unidad"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={confirmar} className={claseBotonAgregar}>
                  Agregar al carrito
                </button>
              </div>
              <button type="button" onClick={confirmar} className={claseBotonComprar}>
                Comprar ahora
              </button>
            </div>
          ) : (
            <p className="mt-auto text-sm font-semibold text-[var(--sf-neutro)]">Producto agotado</p>
          )}
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
