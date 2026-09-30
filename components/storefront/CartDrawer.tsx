"use client";

import Image from "next/image";
import Link from "next/link";
import { imagenPortada } from "@/lib/producto-imagen";

import { motion, AnimatePresence } from "framer-motion";

import {
  X,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  ArrowRight,
} from "lucide-react";

import { useCartStore } from "@/lib/cartStore";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { formatCOP } from "@duna/core/utils";
import { freeShippingThreshold } from "@duna/core/shipping-config";
import { composicionCarrito } from "@/lib/storefront/carrito-drawer";

// CartTitulo y CartCTA no dependen de useCartStore (el título es fijo; el CTA recibe su onClick por
// prop) a propósito: § CROMO-CARRITO-TEMATIZADO-1 -- useCartStore es un CONTEXT que revienta sin
// CartProvider, así que el carril (sin jsdom, sin árbol de Next real) no puede montar <CartDrawer />
// entero. Extraídos, el carril afirma por RENDER que el título usa la fuente de TÍTULO
// (`font-playfair` -> `--sf-fuente-titulo`) y el CTA el token de ACCIÓN (`--sf-accion`), sin mockear
// nada.
//
// FraseEnvioGratis/progresoEnvioGratis/BarraEnvioGratis (§ MUESTRARIO-CARRITO-BARRA-ENVIO-1) son la
// MISMA extracción por la MISMA razón: ninguna depende de useCartStore/useSiteContent -- reciben
// `subtotal`/`threshold`/`belowFreeShipping` por prop -- así que el carril las afirma por
// renderToStaticMarkup sin montar <CartDrawer/> entero. Gemelas de `.ship-prog`/`.ship-bar` del
// muestrario (`docs/prototipos/cafeone/index.html:409-411`, `css/app.css:731-736`,
// `js/app.js:398-405`), gateadas por `content.carritoEnvio.visible` -- AUSENTE/`false` = HOY
// (`FraseEnvioGratis`, byte-idéntica a la frase condicional de siempre); sólo CORTE la enciende
// (`themes.ts`).
//
// § CARRITO-BARRA-POSICION-1 -- LA POSICIÓN de `BarraEnvioGratis` se movió al TOPE del cuerpo del
// drawer, ANTES del listado (o del estado vacío), medida contra `.ship-prog` del muestrario
// (`index.html:408-411`, dentro de `drawer-body`, ANTES de `data-lines`). `js/app.js:398-405`
// (`renderCart`) actualiza `data-ship-msg`/`data-ship-bar` SIEMPRE, sin condicionar a
// `cart.length` -- el prototipo muestra la barra con el carrito VACÍO (mensaje "Te faltan
// $<threshold> para envío gratis", 4% de piso). Por eso acá también se rinde independiente de
// `items.length`, gateada SÓLO por `carritoEnvio.visible`. Con el gate APAGADO nada cambia:
// `FraseEnvioGratis` sigue en el FOOTER, dentro de `items.length > 0`, byte-idéntica a como
// siempre estuvo -- esta tanda es POSICIÓN de la barra, no una capacidad nueva ni un cambio al
// estado vacío (que se queda intacto).
//
// § MUESTRARIO-CARRITO-COMPOSICION-1 -- el CAJÓN ENTERO gana una VARIANTE de composición
// (`content.carrito.variante`, § `CarritoContent` en site-content-defaults.ts), MISMO patrón que ya
// tienen el footer (`footer.variante`) y el drawer móvil del nav (`navDrawerMovil.variante`):
// canónica = el panel de HOY verbatim (`'anclado'`, pegado al borde derecho); la del muestrario
// (`'flotante'`) separa el panel de los tres bordes libres, lo redondea del lado que mira a la
// pantalla, cambia su fondo a la superficie de PÁGINA (`--sf-fondo`, no `--sf-tarjeta`) y agranda +
// aliviana la tipografía de la cabecera. MEDIDO contra `.drawer`/`.drawer-head h2`
// (`docs/prototipos/cafeone/css/app.css:708-724`) -- el detalle completo, con el mapeo a nuestros
// tokens y lo que NO se tocó (el ancho), vive en el docstring de `CarritoContent`. `CartTitulo` gana
// el prop `variante` para poder cambiar tamaño/peso sin filtrar la traducción string↔UI al resto del
// componente (mismo mecanismo que `DetallesSitioSeccion.tsx` usa en el borde del panel); llamado SIN
// props (como en `cromo-carrito.test.ts`) sigue rindiendo byte-idéntico a como siempre estuvo.
//
// § CARRITO-Y-MENU-MOVIL-CAFEONE-1 -- completa el RESTO de la composición 'flotante' que
// MUESTRARIO-CARRITO-COMPOSICION-1 dejó pendiente (esa tanda sólo movió posición/color/radio del
// cajón y el tamaño del título): el estado VACÍO (ícono/título/botón), la caja de CANTIDAD, y el
// CTA del pie. Las clases puras viven en `lib/storefront/carrito-drawer.ts`
// (`composicionCarrito`) -- MISMO patrón que `clasesBotonesCompra` (`lib/storefront/
// pdp-botones.ts`): un eje de tema de 2 valores, un bundle de clases, sin JSX. AUSENTE/'anclado'
// es byte-idéntico a lo que este archivo ya traía. La fila Nota|Descuento y la nota de impuestos
// SIGUEN fuera -- pedido explícito del owner, reafirmado en este slice.
//
// EL CONTADOR DEL CARRITO EN EL NAV (el badge de la bolsa en `StoreNav.tsx`) se corrige en ESE
// archivo, no acá: reusa el MISMO `navTratamiento.badgeColor` (§ RIEL-SCROLL-Y-BADGE-DORADO-1) que
// ya pinta el badge del ítem de menú/producto/spotlight -- ver el docstring de `themes.ts` junto a
// ese campo. El badge de conteo DENTRO de este cajón (`{totalItems}`, junto al título) no tiene
// equivalente en el prototipo (`.drawer-head` sólo lleva `<h2>` + cerrar) y el spec de este slice
// no lo señaló como "crema" -- se deja sin tocar.

export interface ProgresoEnvioGratis {
  pct: number;
  mensaje: string;
}

// Puro: el porcentaje de avance y el mensaje que muestra la barra. `threshold === null` (el umbral
// sin configurar) es el MISMO criterio que ya gobierna la frase de HOY (`belowFreeShipping` nace
// `false` en ese caso) -- no se muestra nada. `Math.max(4, …)` es del muestrario (`js/app.js:404`):
// un progreso real pero bajo (p.ej. 2%) sería invisible como barra sin un piso.
export function progresoEnvioGratis(subtotal: number, threshold: number | null): ProgresoEnvioGratis | null {
  if (threshold === null) return null;
  if (subtotal >= threshold) return { pct: 100, mensaje: "Tienes envío gratis" };
  return {
    pct: Math.max(4, (subtotal / threshold) * 100),
    mensaje: `Te faltan ${formatCOP(threshold - subtotal)} para envío gratis`,
  };
}

// LA FRASE DE HOY, byte-idéntica -- extraída tal cual del footer de abajo para que las dos ramas
// (frase | barra) sean intercambiables por prop y cada una se afirme por separado en el carril.
export function FraseEnvioGratis({ belowFreeShipping, threshold }: { belowFreeShipping: boolean; threshold: number | null }) {
  if (!belowFreeShipping) return null;
  return (
    <p className="text-xs text-[var(--sf-texto-suave)]">
      Envío gratis en pedidos mayores a{" "}
      {formatCOP(threshold!)}
    </p>
  );
}

// LA PIEZA VISUAL del muestrario: mensaje + barra que se llena. El relleno usa `--sf-accion` (con
// fallback a `--sf-tostado`, byte-idéntico para Nayoli) -- el MISMO token que ya pinta el botón
// "volver arriba" (`BackToTop.tsx`) y el CTA de este mismo carrito (arriba, `CartCTA`) -- NUNCA un
// literal (§ la lección de `CORTE-MARQUESINA-VELO-1`: un color que duplica un token diverge solo).
export function BarraEnvioGratis({ subtotal, threshold }: { subtotal: number; threshold: number | null }) {
  const progreso = progresoEnvioGratis(subtotal, threshold);
  if (!progreso) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-[var(--sf-texto-suave)]">{progreso.mensaje}</p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--sf-superficie)]">
        <div
          className="h-full rounded-full bg-[var(--sf-accion,var(--sf-tostado))] transition-all duration-500"
          style={{ width: `${progreso.pct}%` }}
        />
      </div>
    </div>
  );
}

// `variante` traduce `content.carrito.variante` (§ MUESTRARIO-CARRITO-COMPOSICION-1). AUSENTE (o
// llamado sin props, como en `cromo-carrito.test.ts`) -> 'anclado' -> el MISMO markup byte a byte
// que rendía antes de esta tanda -- `font-playfair font-semibold text-[var(--sf-tinta)]`, sin
// tamaño declarado.
//
// § CARRITO-CABECERA-Y-COLORES-NAV-1 (2026-09-30) -- 'flotante' BAJA de `text-3xl` (30px, medido
// contra el `--text-h1`/38px del PROTOTIPO LOCAL en MUESTRARIO-CARRITO-COMPOSICION-1) a `text-2xl`
// (24px), tamaño de SUBTÍTULO -- owner, gate contra Cafeone REAL (capturas en `.scratch/refs/
// cafeone-carrito-*-movil.png`): "el título es más chico, sin ícono". MEDIDO contra el sitio real
// (`x-cafeone.myshopify.com`, fetch directo con `node`+`fetch`, no el prototipo estático de
// `docs/prototipos/cafeone/`): el `<h3 class="xo-modal-content__title … fz:h5 fw:400">Your cart
// </h3>` real lee `--font-heading-5-size: clamp(2.0rem, …, 2.6rem)` con `html{font-size:62.5%}`
// (1rem=10px ahí) -> 20px a 26px según viewport; interpolando la fórmula a un viewport de laptop
// (~1280px) da ~24.4px -- `text-2xl` (24px, escala Tailwind de ESTE repo, root 16px) es la
// aproximación más cercana. `font-normal` (400) no cambia -- ya coincidía con el `fw:400` real.
export function CartTitulo({ variante }: { variante?: "anclado" | "flotante" } = {}) {
  const flotante = variante === "flotante";
  return (
    <h2
      className={
        flotante
          ? "font-playfair text-2xl font-normal text-[var(--sf-tinta)]"
          : "font-playfair font-semibold text-[var(--sf-tinta)]"
      }
    >
      Tu Carrito
    </h2>
  );
}

// COLOR (§ CTA-PRIMARIO-COLOR-Y-HOVER-1): texto `--sf-accion-txt` (no `--sf-tinta` fijo) y hover
// `--sf-accion-hover` (no `--sf-tostado-4` fijo) — MISMOS dos tokens derivados que el resto de la
// familia (`BackToTop.tsx` y hermanos). AUSENTE/`origenAccion:'tostado'` = byte-idéntico al par de
// antes de este slice.
//
// `label` (§ CARRITO-Y-MENU-MOVIL-CAFEONE-1, OPCIONAL): el texto del botón. AUSENTE = "Ir al
// Checkout" -- byte-idéntico al `cromo-carrito.test.ts` existente, que lo llama sin props. El
// cajón 'flotante' (CORTE) pasa "Pagar" (§ `composicionCarrito`, `lib/storefront/
// carrito-drawer.ts`) -- el texto que el owner pidió explícito, distinto del "Finalizar compra"
// del prototipo local.
export function CartCTA({ onClick, label = "Ir al Checkout" }: { onClick: () => void; label?: string }) {
  return (
    <Link
      href="/checkout"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--sf-accion,var(--sf-tostado))] py-3.5 text-sm font-semibold text-[var(--sf-accion-txt,var(--sf-tinta))] transition-colors hover:bg-[var(--sf-accion-hover,var(--sf-tostado-4))]"
    >
      {label}

      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

export default function CartDrawer() {
  const {
    items,
    isOpen,
    closeCart,
    removeItem,
    updateQuantity,
    subtotal,
  } = useCartStore();
  const { carritoEnvio, carrito } = useSiteContent();

  // El costo de envío depende de la dirección; se calcula en el checkout. Aquí
  // solo mostramos el subtotal (el total real lo recalcula el servidor).
  const belowFreeShipping =
    freeShippingThreshold !== null && subtotal < freeShippingThreshold;

  const totalItems = items.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  // § CARRITO-Y-MENU-MOVIL-CAFEONE-1 -- `paginaCarritoExiste=false`: `app/(storefront)/` no
  // declara `/carrito` hoy, así que ninguna variante muestra el botón secundario. Cambia acá el
  // día que esa página exista (§ el docstring de `composicionCarrito`).
  const flotante = carrito.variante === 'flotante';
  const composicion = composicionCarrito(carrito.variante, false);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40"
            onClick={closeCart}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{
              type: "spring",
              damping: 30,
              stiffness: 300,
            }}
            className={
              // § CARRITO-CABECERA-Y-COLORES-NAV-1 -- 'flotante' pasa su `max-w-sm` (384px) a
              // `max-w-[530px]`, MEDIDO contra el cajón REAL de Cafeone (`x-cafeone.myshopify.com`,
              // no el prototipo local): `<div class="xo-modal-content … w:100vw@+md" style="--width:
              // 53rem">` -- 53rem a `html{font-size:62.5%}` (1rem=10px en ESE sitio) = 530px exactos.
              // `.xo-modal-content__inner{width:var(--width)}` sólo aplica `@media(min-width:768px)`
              // -- bajo eso el 100vw manda, que es lo que ya cubre `w-full` en la rama de abajo (el
              // teléfono sigue a pantalla completa, sin cambio). `max-w-sm` de 'anclado' NO se toca.
              carrito.variante === 'flotante'
                ? "fixed top-0 right-0 bottom-0 z-50 flex w-full max-w-[530px] flex-col bg-[var(--sf-fondo)] text-[var(--sf-texto)] shadow-2xl"
                : "fixed top-0 right-0 z-50 flex h-full w-full max-w-sm flex-col bg-[var(--sf-tarjeta)] shadow-2xl"
            }
          >
            {/* Header */}
            <div className="flex items-center justify-between sf-divisor-b border-[var(--sf-linea)] px-5 py-4">
              <div className="flex items-center gap-2">
                {/* § CARRITO-CABECERA-Y-COLORES-NAV-1 -- 'flotante' pierde el ícono de bolsa: la
                    cabecera REAL de Cafeone (`xo-modal-content__header`, fetch directo) es sólo
                    título + botón de cerrar, sin ícono -- las capturas de móvil (`.scratch/refs/
                    cafeone-carrito-*-movil.png`) lo confirman. 'anclado' (Nayoli) lo conserva
                    byte-idéntico: el ícono sigue siendo del rol de hoy. */}
                {!flotante && <ShoppingBag className="h-5 w-5 text-[var(--sf-acento-texto)]" />}

                <CartTitulo variante={carrito.variante} />

                {items.length > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--sf-acento)] text-xs text-[var(--sf-acento-txt)]">
                    {totalItems}
                  </span>
                )}
              </div>

              <button
                onClick={closeCart}
                className="sf-radio-lg p-1.5 transition-colors hover:bg-[var(--sf-superficie)]"
              >
                <X className="h-5 w-5 text-[var(--sf-texto)]" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {carritoEnvio.visible && (
                <div className="mb-4">
                  <BarraEnvioGratis subtotal={subtotal} threshold={freeShippingThreshold} />
                </div>
              )}

              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--sf-superficie)]">
                    <ShoppingBag aria-hidden="true" className={`h-7 w-7 ${composicion.claseIconoVacio}`} />
                  </div>

                  <p className={`mb-1 text-[var(--sf-tinta)] ${composicion.claseTituloVacio}`}>
                    Tu carrito está vacío
                  </p>

                  <p className="mb-6 text-sm text-[var(--sf-texto-suave)]">
                    Explora nuestros productos y agrega tu café favorito.
                  </p>

                  {flotante ? (
                    <button
                      onClick={closeCart}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--sf-accion,var(--sf-tostado))] px-6 py-3 text-sm font-semibold text-[var(--sf-accion-txt,var(--sf-tinta))] transition-colors hover:bg-[var(--sf-accion-hover,var(--sf-tostado-4))] cursor-pointer"
                    >
                      Seguir comprando
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      onClick={closeCart}
                      className="text-sm font-medium text-[var(--sf-acento-texto)] underline underline-offset-2 crusor-pointer"
                    >
                      Seguir comprando
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => (
                    <div
                      key={item.key}
                      className="flex gap-3"
                    >
                      {/* Image -- § CARRITO-Y-MENU-MOVIL-CAFEONE-1: `sf-radio-lg` bajo 'flotante'
                          (2px en 'recta', "tile suavizado") en vez de `rounded-xl` (`--radius-xl`,
                          0 bajo 'recta' -- fully square, no "suavizado"). AUSENTE/'anclado' queda
                          `rounded-xl`, byte-idéntico. */}
                      <div className={`relative h-16 w-16 shrink-0 overflow-hidden bg-[var(--sf-superficie)] ${flotante ? 'sf-radio-lg' : 'rounded-xl'}`}>
                        <Image
                          src={imagenPortada(item.imagen)}
                          alt={item.nombre}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <p className={`line-clamp-2 text-sm leading-tight text-[var(--sf-tinta)] ${flotante ? 'font-playfair font-normal' : 'font-medium'}`}>
                          {item.nombre}
                        </p>

                        {typeof item.options?.molienda === "string" && (
                          <p className="mt-0.5 text-xs text-[var(--sf-tostado-3)]">
                            Molienda: {item.options.molienda}
                          </p>
                        )}

                        <p className="mt-0.5 text-xs text-[var(--sf-texto-suave)]">
                          {formatCOP(item.precio)}
                        </p>

                        {/* Quantity Controls */}
                        <div className="mt-2 flex items-center gap-3">
                          <div className={`flex items-center gap-1 sf-radio-lg ${composicion.claseCajaCantidad}`}>
                            <button
                              onClick={() =>
                                updateQuantity(
                                  item.key,
                                  item.quantity - 1
                                )
                              }
                              className="flex h-7 w-7 items-center justify-center sf-radio-lg transition-colors hover:bg-[var(--sf-linea)] cursor-pointer"
                            >
                              <Minus className="h-3 w-3" />
                            </button>

                            <span className="w-6 text-center text-sm font-medium">
                              {item.quantity}
                            </span>

                            <button
                              onClick={() =>
                                updateQuantity(
                                  item.key,
                                  item.quantity + 1
                                )
                              }
                              className="flex h-7 w-7 items-center justify-center sf-radio-lg transition-colors hover:bg-[var(--sf-linea)] cursor-pointer"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>

                          <button
                            onClick={() => removeItem(item.key)}
                            className="text-[var(--sf-tostado-2)] transition-colors hover:text-red-500 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Price */}
                      <p className="shrink-0 text-sm font-bold text-[var(--sf-tinta)]">
                        {formatCOP(
                          item.precio * item.quantity
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="space-y-3 sf-divisor-t border-[var(--sf-linea)] px-5 py-4">
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-[var(--sf-texto)]">
                    <span>Envío</span>

                    <span className="text-[var(--sf-texto-suave)]">
                      Se calcula en el checkout
                    </span>
                  </div>

                  {!carritoEnvio.visible && (
                    <FraseEnvioGratis belowFreeShipping={belowFreeShipping} threshold={freeShippingThreshold} />
                  )}

                  {/* § CARRITO-Y-MENU-MOVIL-CAFEONE-1 -- "Total estimado" con la cifra en la
                      fuente de TÍTULO, medido contra `.totals`/`.totals b` del prototipo
                      (`docs/prototipos/cafeone/css/app.css:794-800`). AUSENTE/'anclado' queda
                      "Subtotal" en negrita de cuerpo, byte-idéntico. */}
                  {flotante ? (
                    <div className="flex items-baseline justify-between pt-1">
                      <span className="text-[var(--sf-texto)]">Total estimado</span>

                      <span className="font-playfair text-2xl font-normal text-[var(--sf-tinta)]">
                        {formatCOP(subtotal)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex justify-between sf-divisor-t border-[var(--sf-linea)] pt-1 text-base font-bold text-[var(--sf-tinta)]">
                      <span>Subtotal</span>

                      <span>{formatCOP(subtotal)}</span>
                    </div>
                  )}
                </div>

                <CartCTA onClick={closeCart} label={composicion.ctaLabel} />

                {/* El secundario "Ver carrito" sólo existiría si `/carrito` existiera
                    (`composicion.mostrarBotonSecundario`, hoy siempre `false` -- § el docstring de
                    `composicionCarrito`). Bajo 'flotante' el pie del prototipo no lleva un TERCER
                    link de texto (§ `.drawer-foot`, `docs/prototipos/cafeone/index.html:416-444`:
                    totales + `.drawer-cta` nada más), así que ese link se omite; 'anclado' lo
                    conserva byte-idéntico. */}
                {!flotante && (
                  <button
                    onClick={closeCart}
                    className="w-full text-center text-sm text-[var(--sf-texto-suave)] transition-colors hover:text-[var(--sf-texto)] cursor-pointer"
                  >
                    Seguir comprando
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}