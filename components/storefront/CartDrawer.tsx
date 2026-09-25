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

export function CartTitulo() {
  return (
    <h2 className="font-playfair font-semibold text-[var(--sf-tinta)]">
      Tu Carrito
    </h2>
  );
}

export function CartCTA({ onClick }: { onClick: () => void }) {
  return (
    <Link
      href="/checkout"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--sf-accion,var(--sf-tostado))] py-3.5 text-sm font-semibold text-[var(--sf-tinta)] transition-colors hover:bg-[var(--sf-tostado-4)]"
    >
      Ir al Checkout

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
  const { carritoEnvio } = useSiteContent();

  // El costo de envío depende de la dirección; se calcula en el checkout. Aquí
  // solo mostramos el subtotal (el total real lo recalcula el servidor).
  const belowFreeShipping =
    freeShippingThreshold !== null && subtotal < freeShippingThreshold;

  const totalItems = items.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

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
            className="fixed top-0 right-0 z-50 flex h-full w-full max-w-sm flex-col bg-[var(--sf-tarjeta)] shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between sf-divisor-b border-[var(--sf-linea)] px-5 py-4">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-[var(--sf-acento-texto)]" />

                <CartTitulo />

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
              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--sf-superficie)]">
                    <ShoppingBag aria-hidden="true" className="h-7 w-7 text-[var(--sf-tostado)]" />
                  </div>

                  <p className="mb-1 font-medium text-[var(--sf-tinta)]">
                    Tu carrito está vacío
                  </p>

                  <p className="mb-6 text-sm text-[var(--sf-texto-suave)]">
                    Explora nuestros productos y agrega tu café favorito.
                  </p>

                  <button
                    onClick={closeCart}
                    className="text-sm font-medium text-[var(--sf-acento-texto)] underline underline-offset-2 crusor-pointer"
                  >
                    Seguir comprando
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => (
                    <div
                      key={item.key}
                      className="flex gap-3"
                    >
                      {/* Image */}
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[var(--sf-superficie)]">
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
                        <p className="line-clamp-2 text-sm font-medium leading-tight text-[var(--sf-tinta)]">
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
                          <div className="flex items-center gap-1 sf-radio-lg bg-[var(--sf-superficie)]">
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

                  {carritoEnvio.visible ? (
                    <BarraEnvioGratis subtotal={subtotal} threshold={freeShippingThreshold} />
                  ) : (
                    <FraseEnvioGratis belowFreeShipping={belowFreeShipping} threshold={freeShippingThreshold} />
                  )}

                  <div className="flex justify-between sf-divisor-t border-[var(--sf-linea)] pt-1 text-base font-bold text-[var(--sf-tinta)]">
                    <span>Subtotal</span>

                    <span>{formatCOP(subtotal)}</span>
                  </div>
                </div>

                <CartCTA onClick={closeCart} />

                <button
                  onClick={closeCart}
                  className="w-full text-center text-sm text-[var(--sf-texto-suave)] transition-colors hover:text-[var(--sf-texto)] cursor-pointer"
                >
                  Seguir comprando
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}