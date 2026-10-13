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
import {
  freeShippingThreshold,
  computeShippingCost,
  getShippingMethod,
} from "@duna/core/shipping-config";
import { COLOMBIA_DEPARTMENTS, isBogotaDC } from "@duna/core/colombia-departments";
import { composicionCarrito } from "@/lib/storefront/carrito-drawer";
import { vendedorEstaCompleto, lineaVendedor } from "@/lib/legal/plantillas";
import { composicionCajon } from "@/lib/checkout/composiciones-compra";
import { HEX6 } from "@/lib/tienda/laminas";
import type { VendedorContent } from "@/lib/config/site-content-defaults";

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
// `tejido` (§ COMPRA-LINEAS-ONIX-CHAMISAS-1, OPCIONAL, default `false` -- byte-idéntico sin él):
// bajo la composición «Álbum» del cajón, la barra se lee como tejido que se completa en vez de un
// relleno liso -- un patrón de rayas diagonales en el MISMO token de acento, sin color nuevo. La
// transición de ancho de hoy (`transition-all duration-500`) ya ES el "tejido avanza al subir el
// subtotal" del spec; esto sólo cambia el PATRÓN, nunca el mecanismo de movimiento.
export function BarraEnvioGratis({ subtotal, threshold, tejido = false }: { subtotal: number; threshold: number | null; tejido?: boolean }) {
  const progreso = progresoEnvioGratis(subtotal, threshold);
  if (!progreso) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-[var(--sf-texto-suave)]">{progreso.mensaje}</p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--sf-superficie)]">
        <div
          className={tejido ? 'h-full rounded-full transition-all duration-500' : 'h-full rounded-full bg-[var(--sf-accion,var(--sf-tostado))] transition-all duration-500'}
          style={tejido
            ? { width: `${progreso.pct}%`, backgroundImage: 'repeating-linear-gradient(45deg, var(--sf-accion,var(--sf-tostado)) 0, var(--sf-accion,var(--sf-tostado)) 4px, var(--sf-tostado-4,var(--sf-acento-4)) 4px, var(--sf-tostado-4,var(--sf-acento-4)) 8px)' }
            : { width: `${progreso.pct}%` }}
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

// COMPRA-LINEAS-FIDELIDAD-1 — `CajonPanel` es el CUERPO del cajón (cabecera + filas + pie),
// extraído de `CartDrawer` por la MISMA razón que ya separó `CartTitulo`/`CartCTA`/
// `BarraEnvioGratis`: ninguno de esos tres fragmentos depende de `useCartStore` — y éste tampoco,
// porque recibe TODO por props. Eso es lo que permite que el editor admin (`CompraSeccion.tsx`,
// § el preview de «Camino de compra») lo monte con datos de MUESTRA, sin `CartProvider` — montar
// `<CartDrawer/>` completo ahí reventaría (`useCartStore` throws sin su Provider) y, peor, un
// `<CartProvider>` de verdad en el panel LEE Y ESCRIBE el `localStorage` del comprador real
// (`lib/cartStore.tsx`, `guardarCarrito`/`restaurarCarrito`) — mismo origen que el storefront —,
// así que sembrar ítems de ejemplo ahí contaminaría el carrito real de quien esté usando el panel
// en el mismo navegador. `CajonPanel` no toca ningún storage: todo lo que pinta vive en sus props.
//
// El cuerpo es BYTE-IDÉNTICO al que `CartDrawer` ya rendía — sólo cambiaron los NOMBRES de lo que
// antes venía de los hooks (`closeCart`→`onClose`, `setDepartamento`→`onDepartamentoChange`, …) por
// los mismos valores recibidos como prop. `CartDrawer`, abajo, sigue siendo el único que habla con
// `useCartStore`/`useSiteContent` y el único que monta el backdrop + la animación de entrada.
export interface CajonPanelItem {
  key: string;
  id: string;
  nombre: string;
  imagen?: string;
  precio: number;
  quantity: number;
  options?: Record<string, string | boolean>;
}

export interface CajonPanelProps {
  cajon: ReturnType<typeof composicionCajon>;
  // `carrito`/`carritoEnvio` se reciben como los SUB-OBJETOS de `SiteContentData` (no aplanados a
  // `carritoVariante`/`carritoEnvioVisible`) A PROPÓSITO — § DEVIACIÓN COMPRA-LINEAS-FIDELIDAD-1:
  // `lib/config/detalles-sitio.test.ts` (fuera de `touches:` de este slice) lee la FUENTE de este
  // archivo y afirma los literales `carrito.variante`/`carritoEnvio.visible` tal cual aparecían
  // antes de esta extracción; aplanarlos a nombres propios habría dejado esos tests leyendo un
  // literal que ya no existe, sin que este slice pudiera tocar ese archivo para corregirlos. Pasar
  // los mismos sub-objetos preserva la expresión exacta `carrito.variante`/`carritoEnvio.visible`
  // dentro de `CajonPanel`, así que esos tests se quedan verdes sin tocarlos.
  carrito: { variante: 'anclado' | 'flotante' };
  /** § el docstring de `composicionCarrito`: hoy siempre `false`, `/carrito` no existe. */
  paginaCarritoExiste?: boolean;
  items: CajonPanelItem[];
  departamento: string | null;
  carritoEnvio: { visible: boolean };
  coloresPorProducto: Record<string, string>;
  vendedor: VendedorContent;
  onClose: () => void;
  onUpdateQuantity: (key: string, quantity: number) => void;
  onRemoveItem: (key: string) => void;
  onDepartamentoChange: (value: string | null) => void;
}

export function CajonPanel({
  cajon,
  carrito,
  paginaCarritoExiste = false,
  items,
  departamento,
  carritoEnvio,
  coloresPorProducto,
  vendedor,
  onClose,
  onUpdateQuantity,
  onRemoveItem,
  onDepartamentoChange,
}: CajonPanelProps) {
  // COMPRA-LINEAS-ONIX-CHAMISAS-1 — el cajón gana una composición ELEGIBLE por tienda, ORTOGONAL a
  // `carrito.variante` (anclado/flotante, § MUESTRARIO-CARRITO-COMPOSICION-1): esa es la POSICIÓN
  // del panel; ésta es el TRATAMIENTO de sus filas y su pie. `cajon` ya llega RESUELTO al set
  // cerrado — `'comun'` (el default de toda tienda que no elige) rinde EXACTAMENTE lo que este
  // archivo ya rendía.
  const esCreditos = cajon === 'creditos';
  const esAlbum = cajon === 'album';

  // Misma fórmula que `lib/cartStore.tsx` (`subtotal = items.reduce((s,i)=>s+i.precio*i.quantity,0)`)
  // — recalculada acá para que `CajonPanel` no dependa del Context; para `CartDrawer` (abajo) da el
  // MISMO número, porque recibe los MISMOS `items`.
  const subtotal = items.reduce((sum, item) => sum + item.precio * item.quantity, 0);

  // CHECKOUT-LISTO-PARA-VENDER-1 — el envío YA NO dice "Se calcula en el checkout" (§ el
  // reporte del slice, § `paginas-pendientes.md` §2.1): el costo depende SOLO del
  // departamento, que ahora se puede elegir desde ACÁ mismo. `departamento` vive en el
  // CartContext (persistido junto con los items, § `lib/cartStore.tsx`), así que el checkout
  // arranca con el que el comprador ya eligió en el cajón, sin volver a preguntarlo.
  const metodoEnvioCajon = departamento ? (isBogotaDC(departamento) ? 'bogota' : 'nacional') : null;
  const shippingMethodCajon = metodoEnvioCajon ? getShippingMethod(metodoEnvioCajon) : null;
  const shippingCostCajon = metodoEnvioCajon ? computeShippingCost(metodoEnvioCajon, subtotal) : null;
  // COMPRA-LINEAS-FIDELIDAD-1 — el total que el pie «Créditos»/«Álbum» YA mostraba en su fila
  // TOTAL (§ abajo) es el MISMO que el botón de pagar necesita repetir junto al verbo (§ la
  // maqueta: «IR A PAGAR · $ 87.000» / «Ir a pagar · $ 115.000») — una sola cuenta, dos lugares.
  const totalCajon = subtotal + (shippingCostCajon ?? 0);

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
  const flotante = carrito.variante !== 'anclado';
  const composicion = composicionCarrito(carrito.variante, paginaCarritoExiste);

  return (
    <>
            {/* COMPRA-LINEAS-ONIX-CHAMISAS-1 — composición «Álbum» (Las Chamisas): franja de tejido
                en la cabecera, un patrón de rayas diagonales alternadas con los tokens del tema —
                nunca un color literal — que distingue el cajón de un vistazo, antes de leer nada. */}
            {esAlbum && (
              <div
                aria-hidden="true"
                className="h-2 w-full shrink-0"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(45deg, var(--sf-acento) 0, var(--sf-acento) 6px, var(--sf-tostado-4,var(--sf-acento-4)) 6px, var(--sf-tostado-4,var(--sf-acento-4)) 12px)',
                }}
              />
            )}
            {/* Header */}
            <div className="flex items-center justify-between sf-divisor-b border-[var(--sf-linea)] px-5 py-4">
              <div className="flex items-center gap-2">
                {/* § CARRITO-CABECERA-Y-COLORES-NAV-1 -- 'flotante' pierde el ícono de bolsa: la
                    cabecera REAL de Cafeone (`xo-modal-content__header`, fetch directo) es sólo
                    título + botón de cerrar, sin ícono -- las capturas de móvil (`.scratch/refs/
                    cafeone-carrito-*-movil.png`) lo confirman. 'anclado' (Nayoli) lo conserva
                    byte-idéntico: el ícono sigue siendo del rol de hoy.
                    COMPRA-LINEAS-FIDELIDAD-1 -- «Créditos»/«Álbum» tampoco lo llevan (§ la
                    maqueta, `.dr-hd`: sólo título + botón de cerrar, para las DOS tiendas). */}
                {!flotante && cajon === 'comun' && <ShoppingBag className="h-5 w-5 text-[var(--sf-acento-texto)]" />}

                {cajon === 'comun' ? (
                  <>
                    <CartTitulo variante={carrito.variante} />

                    {items.length > 0 && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--sf-acento)] text-xs text-[var(--sf-acento-txt)]">
                        {totalItems}
                      </span>
                    )}
                  </>
                ) : (
                  // COMPRA-LINEAS-FIDELIDAD-1 -- «Tu pedido (n)» (§ la maqueta, `dr-hd h2`: "Tu
                  // pedido <span>(n)</span>" -- el MISMO texto para las dos tiendas, SIN el badge
                  // circular rojo de 'comun'; Onix se ve mayúscula sólo por una clase CSS propia
                  // (`.ln-onix .dr-hd h2{text-transform:uppercase}` en la maqueta), nunca en el
                  // string -- el "(n)" se queda en registro normal, como el prototipo.
                  <h2 className={`font-playfair font-normal text-[var(--sf-tinta)] ${esCreditos ? 'text-xl uppercase tracking-wide' : 'text-2xl'}`}>
                    Tu pedido{' '}
                    <span className="font-sans text-sm font-normal normal-case tracking-normal text-[var(--sf-texto-suave)]">
                      ({totalItems})
                    </span>
                  </h2>
                )}
              </div>

              <button
                onClick={onClose}
                className="sf-radio-lg p-1.5 transition-colors hover:bg-[var(--sf-superficie)]"
              >
                <X className="h-5 w-5 text-[var(--sf-texto)]" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {carritoEnvio.visible && (
                <div className="mb-4">
                  <BarraEnvioGratis subtotal={subtotal} threshold={freeShippingThreshold} tejido={esAlbum} />
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
                      onClick={onClose}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--sf-accion,var(--sf-tostado))] px-6 py-3 text-sm font-semibold text-[var(--sf-accion-txt,var(--sf-tinta))] transition-colors hover:bg-[var(--sf-accion-hover,var(--sf-tostado-4))] cursor-pointer"
                    >
                      Seguir comprando
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      onClick={onClose}
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
                          `rounded-xl`, byte-idéntico.
                          COMPRA-LINEAS-ONIX-CHAMISAS-1 -- composición «Álbum»: la miniatura se
                          pinta SOBRE el color de ESE café (`coloresPorProducto`, el
                          MISMO mapa que ya alimenta la lámina de /tienda, § TIENDA-CHAMISAS-ALBUM-1
                          -- nunca un color nuevo), con la foto en `object-contain` para que el
                          color se vea alrededor. Sin color elegido para ESTE producto, el fondo
                          cae a la superficie de siempre -- no se inventa un color de reserva acá
                          (ese cálculo exige el índice del producto en el catálogo completo, que
                          el cajón no tiene). */}
                      <div
                        className={`relative h-16 w-16 shrink-0 overflow-hidden bg-[var(--sf-superficie)] ${flotante ? 'sf-radio-lg' : 'rounded-xl'}`}
                        style={esAlbum && HEX6.test(coloresPorProducto[item.id] ?? '')
                          ? { backgroundColor: coloresPorProducto[item.id] }
                          : undefined}
                      >
                        <Image
                          src={imagenPortada(item.imagen)}
                          alt={item.nombre}
                          fill
                          className={esAlbum ? 'object-contain p-1.5' : 'object-cover'}
                          sizes="64px"
                        />
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <p className={`line-clamp-2 text-sm leading-tight text-[var(--sf-tinta)] ${flotante ? 'font-playfair font-normal' : 'font-medium'}`}>
                          {item.nombre}
                        </p>

                        {typeof item.options?.molienda === "string" && (
                          esCreditos ? (
                            // «Créditos» (Onix): la fila al estilo Taquilla (§ el spec: "EN GRANO ·
                            // 500 G") -- mayúscula espaciada, sin el prefijo "Molienda:".
                            <p className="mt-0.5 text-[0.65rem] font-medium uppercase tracking-wider text-[var(--sf-tostado-3)]">
                              {item.options.molienda}
                            </p>
                          ) : esAlbum ? (
                            // COMPRA-LINEAS-FIDELIDAD-1 -- «Álbum» (Las Chamisas): el mismo dato,
                            // también SIN el prefijo "Molienda:", pero en registro NORMAL -- § la
                            // maqueta, `.ln-ch .rw .vr{text-transform:none}` (a diferencia de
                            // «Créditos», que lo lleva en mayúscula espaciada).
                            <p className="mt-0.5 text-xs text-[var(--sf-texto)]">
                              {item.options.molienda}
                            </p>
                          ) : (
                            <p className="mt-0.5 text-xs text-[var(--sf-tostado-3)]">
                              Molienda: {item.options.molienda}
                            </p>
                          )
                        )}

                        {/* COMPRA-LINEAS-FIDELIDAD-1 -- «Créditos»/«Álbum» NO repiten el precio
                            UNITARIO bajo el nombre (§ la maqueta: sólo el precio de LÍNEA, a la
                            derecha de la fila -- abajo, "Price"); 'comun' y 'flotante' lo
                            conservan byte-idéntico. */}
                        {!esCreditos && !esAlbum && (
                          <p className="mt-0.5 text-xs text-[var(--sf-texto-suave)]">
                            {formatCOP(item.precio)}
                          </p>
                        )}

                        {/* Quantity Controls — CHECKOUT-LISTO-PARA-VENDER-1: el tap target sube
                            a 44px (§ el spec del slice, "stepper de 44 px"), el tamaño mínimo
                            táctil recomendado — 28px (`h-7 w-7`, de antes) es chico para un dedo
                            en celular, que es donde este cajón ocupa toda la pantalla. */}
                        <div className="mt-2 flex items-center gap-3">
                          {esCreditos || esAlbum ? (
                            // COMPRA-LINEAS-FIDELIDAD-1 -- el stepper gana su propia forma por
                            // cajón (§ la maqueta, `.step`): «Créditos» es un grupo CUADRADO con
                            // un borde único y divisores internos (`border:1px solid var(--ink)`,
                            // `span{border-left/right}`); «Álbum» es el MISMO grupo pero en
                            // PÍLDORA (`border-radius:999px`), sin divisores internos
                            // (`.ln-ch .step span{border:0}`). Ninguno de los dos reusa
                            // `composicionCarrito.claseCajaCantidad` -- ese eje es la POSICIÓN del
                            // cajón (anclado/flotante), ORTOGONAL al tratamiento del cajón.
                            <div
                              className={
                                esCreditos
                                  ? 'inline-flex h-11 items-stretch border border-[var(--sf-tinta)]'
                                  : 'inline-flex h-11 items-stretch overflow-hidden rounded-full border border-[var(--sf-linea)] bg-[var(--sf-fondo)]'
                              }
                            >
                              <button
                                onClick={() => onUpdateQuantity(item.key, item.quantity - 1)}
                                aria-label="Reducir cantidad"
                                className="flex h-full w-11 items-center justify-center transition-colors hover:bg-[var(--sf-linea)]/40 cursor-pointer"
                              >
                                <Minus className="h-4 w-4" />
                              </button>

                              <span
                                className={`flex min-w-9 items-center justify-center text-sm font-medium [font-variant-numeric:tabular-nums] ${esCreditos ? 'border-x border-[var(--sf-linea)]' : ''}`}
                              >
                                {item.quantity}
                              </span>

                              <button
                                onClick={() => onUpdateQuantity(item.key, item.quantity + 1)}
                                aria-label="Aumentar cantidad"
                                className="flex h-full w-11 items-center justify-center transition-colors hover:bg-[var(--sf-linea)]/40 cursor-pointer"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <div className={`flex items-center gap-1 sf-radio-lg ${composicion.claseCajaCantidad}`}>
                              <button
                                onClick={() =>
                                  onUpdateQuantity(
                                    item.key,
                                    item.quantity - 1
                                  )
                                }
                                aria-label="Reducir cantidad"
                                className="flex h-11 w-11 items-center justify-center sf-radio-lg transition-colors hover:bg-[var(--sf-linea)] cursor-pointer"
                              >
                                <Minus className="h-4 w-4" />
                              </button>

                              <span className="w-8 text-center text-sm font-medium">
                                {item.quantity}
                              </span>

                              <button
                                onClick={() =>
                                  onUpdateQuantity(
                                    item.key,
                                    item.quantity + 1
                                  )
                                }
                                aria-label="Aumentar cantidad"
                                className="flex h-11 w-11 items-center justify-center sf-radio-lg transition-colors hover:bg-[var(--sf-linea)] cursor-pointer"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          )}

                          {esCreditos || esAlbum ? (
                            // COMPRA-LINEAS-FIDELIDAD-1 -- «Quitar» como TEXTO subrayado (§ la
                            // maqueta, `.rm{text-decoration:underline}`), compartido por las DOS
                            // tiendas -- 'comun' conserva el ícono de papelera, byte-idéntico.
                            <button
                              onClick={() => onRemoveItem(item.key)}
                              className="text-xs text-[var(--sf-texto-suave)] underline underline-offset-2 transition-colors hover:text-[var(--sf-texto)] cursor-pointer"
                            >
                              Quitar
                            </button>
                          ) : (
                            <button
                              onClick={() => onRemoveItem(item.key)}
                              className="text-[var(--sf-tostado-2)] transition-colors hover:text-red-500 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
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
                  {/* CHECKOUT-LISTO-PARA-VENDER-1 — "Envío a [departamento]", con SELECTOR real
                      (§ el spec del slice): el envío sólo depende del departamento, así que
                      "se calcula en el checkout" era una frase de espera para un dato que el
                      comprador puede elegir ACÁ mismo. Con un departamento ya elegido se
                      muestra el costo REAL (`shippingCostCajon`); sin elegir, el selector pide
                      el dato con la MISMA etiqueta ("Envío a…") para que el comprador entienda
                      qué decide. El valor viaja al checkout vía el CartContext (persistido). */}
                  <div className="flex items-center justify-between gap-3 text-[var(--sf-texto)]">
                    <label htmlFor="carrito-departamento" className="shrink-0">
                      Envío{departamento ? ` a ${departamento}` : ''}
                    </label>
                    <select
                      id="carrito-departamento"
                      value={departamento ?? ''}
                      onChange={(e) => onDepartamentoChange(e.target.value || null)}
                      className="min-w-0 max-w-[60%] truncate rounded-lg border border-[var(--sf-linea)] bg-[var(--sf-fondo)] px-2 py-1.5 text-xs text-[var(--sf-tinta)] focus:outline-none focus:ring-2 focus:ring-[var(--sf-tinta)]/20 focus:border-[var(--sf-tinta)]"
                    >
                      <option value="">Selecciona departamento</option>
                      {COLOMBIA_DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  {/* COMPRA-LINEAS-ONIX-CHAMISAS-1 -- bajo «Créditos»/«Álbum» el envío ya se
                      repite como fila del pie (abajo); mostrarlo también acá sería la misma línea
                      dos veces. */}
                  {shippingMethodCajon && !esCreditos && !esAlbum && (
                    <div className="flex justify-between text-[var(--sf-texto-suave)]">
                      <span>{shippingMethodCajon.label}</span>
                      <span className={shippingCostCajon === 0 ? 'text-emerald-600' : undefined}>
                        {shippingCostCajon === 0 ? 'Gratis' : formatCOP(shippingCostCajon!)}
                      </span>
                    </div>
                  )}

                  {!carritoEnvio.visible && (
                    <FraseEnvioGratis belowFreeShipping={belowFreeShipping} threshold={freeShippingThreshold} />
                  )}

                  {/* COMPRA-LINEAS-ONIX-CHAMISAS-1 -- composición «Créditos» (Onix): el pie como
                      Créditos -- SUBTOTAL / ENVÍO / TOTAL en filas con filete, mayúscula espaciada,
                      el TOTAL en el acento de la tienda (§ el spec, § refero-compra.md §4: "verde
                      de la tienda... en el boleto y el pie"). Prioridad sobre 'flotante': es el
                      tratamiento del PIE que esta tienda eligió, independiente de la posición del
                      cajón.
                      COMPRA-LINEAS-FIDELIDAD-1 -- «Envío» gana el departamento elegido (§ la
                      maqueta: "ENVÍO A BOGOTÁ D.C."), la MISMA etiqueta que ya usa el selector de
                      arriba -- una sola frase para el mismo hecho, no una segunda. */}
                  {esCreditos ? (
                    <div className="space-y-1 pt-1 text-xs font-medium uppercase tracking-wider">
                      <div className="flex justify-between sf-divisor-t border-[var(--sf-linea)] pt-1.5 text-[var(--sf-texto)]">
                        <span>Subtotal</span>
                        <span>{formatCOP(subtotal)}</span>
                      </div>
                      {shippingMethodCajon && (
                        <div className="flex justify-between sf-divisor-t border-[var(--sf-linea)] pt-1.5 text-[var(--sf-texto)]">
                          <span>Envío{departamento ? ` a ${departamento}` : ''}</span>
                          <span>{shippingCostCajon === 0 ? 'Gratis' : formatCOP(shippingCostCajon!)}</span>
                        </div>
                      )}
                      <div className="flex justify-between sf-divisor-t border-[var(--sf-linea)] pt-1.5 text-sm text-[var(--sf-acento-texto)]">
                        <span>Total</span>
                        <span className="font-playfair normal-case tracking-normal">{formatCOP(totalCajon)}</span>
                      </div>
                    </div>
                  ) : esAlbum ? (
                    // COMPRA-LINEAS-FIDELIDAD-1 -- «Álbum» (Las Chamisas): el MISMO trío de filas
                    // que «Créditos», en registro NORMAL -- § la maqueta, `.ln-ch .cr` (sin
                    // mayúscula ni filete entre filas) con el TOTAL en serif (`.ln-ch .cr.tot
                    // .v{font-family:var(--serif);font-size:24px}`).
                    <div className="space-y-1.5 pt-1 text-sm">
                      <div className="flex justify-between text-[var(--sf-texto)]">
                        <span>Subtotal</span>
                        <span className="font-semibold">{formatCOP(subtotal)}</span>
                      </div>
                      {shippingMethodCajon && (
                        <div className="flex justify-between text-[var(--sf-texto)]">
                          <span>Envío{departamento ? ` a ${departamento}` : ''}</span>
                          <span className="font-semibold">{shippingCostCajon === 0 ? 'Gratis' : formatCOP(shippingCostCajon!)}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-1 text-[var(--sf-tinta)]">
                        <span>Total</span>
                        <span className="font-playfair text-xl font-normal">{formatCOP(totalCajon)}</span>
                      </div>
                    </div>
                  ) : flotante ? (
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

                {/* TIENDA-LEGAL-1 — la línea «Vende [nombre] · [documento] · [ciudad]», debajo
                    del total y antes del CTA. Gateada por `vendedorEstaCompleto`: sin esa
                    configuración, no se renderiza nada en su lugar (nunca un dato inventado).
                    COMPRA-LINEAS-FIDELIDAD-1 -- «Créditos»/«Álbum» la mueven DESPUÉS del CTA,
                    centrada (§ la maqueta: el botón primero, "Vende … [ejemplo]" debajo) -- la
                    única excepción a TIENDA-LEGAL-1, que sigue rigiendo 'comun'/'flotante'. */}
                {!esCreditos && !esAlbum && vendedorEstaCompleto(vendedor) && (
                  <p className="text-xs text-[var(--sf-texto-suave)]">{lineaVendedor(vendedor)}</p>
                )}

                <CartCTA
                  onClick={onClose}
                  label={
                    // COMPRA-LINEAS-FIDELIDAD-1 -- el botón repite el verbo + el total (§ la
                    // maqueta: «IR A PAGAR · $ 87.000» en Onix, «Ir a pagar · $ 115.000» en Las
                    // Chamisas -- la mayúscula de Onix es del STRING, no de una clase CSS, porque
                    // `CartCTA` no admite una clase extra sin tocar su contrato (`cromo-
                    // carrito.test.ts`)).
                    esCreditos
                      ? `IR A PAGAR · ${formatCOP(totalCajon)}`
                      : esAlbum
                        ? `Ir a pagar · ${formatCOP(totalCajon)}`
                        : composicion.ctaLabel
                  }
                />

                {/* COMPRA-LINEAS-FIDELIDAD-1 -- la línea «Vende…» de «Créditos»/«Álbum», debajo
                    del CTA y centrada (§ arriba). */}
                {(esCreditos || esAlbum) && vendedorEstaCompleto(vendedor) && (
                  <p className="text-center text-xs text-[var(--sf-texto-suave)]">{lineaVendedor(vendedor)}</p>
                )}

                {/* El secundario "Ver carrito" sólo existiría si `/carrito` existiera
                    (`composicion.mostrarBotonSecundario`, hoy siempre `false` -- § el docstring de
                    `composicionCarrito`). Bajo 'flotante' el pie del prototipo no lleva un TERCER
                    link de texto (§ `.drawer-foot`, `docs/prototipos/cafeone/index.html:416-444`:
                    totales + `.drawer-cta` nada más), así que ese link se omite; 'anclado' lo
                    conserva byte-idéntico. COMPRA-LINEAS-FIDELIDAD-1 -- «Créditos»/«Álbum»
                    tampoco lo llevan (§ la maqueta: el pie del cajón termina en la línea «Vende…»,
                    sin un tercer link de texto). */}
                {!flotante && !esCreditos && !esAlbum && (
                  <button
                    onClick={onClose}
                    className="w-full text-center text-sm text-[var(--sf-texto-suave)] transition-colors hover:text-[var(--sf-texto)] cursor-pointer"
                  >
                    Seguir comprando
                  </button>
                )}
              </div>
            )}
    </>
  );
}

// `CartDrawer` queda como el ÚNICO que habla con `useCartStore`/`useSiteContent`: arma el backdrop
// y la animación de entrada/salida, resuelve `cajon` y le pasa a `CajonPanel` (arriba) todo ya
// resuelto. El editor admin (§ `CompraSeccion.tsx`) monta `CajonPanel` directo, con props de
// muestra, sin este wrapper — no necesita backdrop ni Context.
export default function CartDrawer() {
  const {
    items,
    isOpen,
    closeCart,
    removeItem,
    updateQuantity,
    departamento,
    setDepartamento,
  } = useCartStore();
  const { carritoEnvio, carrito, vendedor, compra, tiendaCatalogo } = useSiteContent();

  // COMPRA-LINEAS-ONIX-CHAMISAS-1 — el cajón gana una composición ELEGIBLE por tienda, ORTOGONAL a
  // `carrito.variante` (anclado/flotante, § MUESTRARIO-CARRITO-COMPOSICION-1): esa es la POSICIÓN
  // del panel; ésta es el TRATAMIENTO de sus filas y su pie. `composicionCajon` resuelve al set
  // cerrado — `'comun'` (AUSENTE, el default de toda tienda que no elige) rinde EXACTAMENTE lo
  // que este archivo ya rendía.
  const cajon = composicionCajon(compra.cajon);

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
            <CajonPanel
              cajon={cajon}
              carrito={carrito}
              items={items}
              departamento={departamento}
              carritoEnvio={carritoEnvio}
              coloresPorProducto={tiendaCatalogo.coloresPorProducto}
              vendedor={vendedor}
              onClose={closeCart}
              onUpdateQuantity={updateQuantity}
              onRemoveItem={removeItem}
              onDepartamentoChange={setDepartamento}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}