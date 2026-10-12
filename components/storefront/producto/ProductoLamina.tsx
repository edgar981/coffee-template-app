"use client";

// LA PÁGINA DE PRODUCTO · COMPOSICIÓN «LÁMINA ABIERTA» (§ PRODUCTO-CHAMISAS-LAMINA-1, la línea
// «cálida, hecha por mujeres» de Las Chamisas, aprobada por el owner el 2026-10-10 sobre
// `.scratch/tienda-composiciones/producto-maquetas-aprobadas.png`). Montada por
// `app/(storefront)/tienda/[slug]/page.tsx` cuando `tiendaProducto.variante === 'lamina'`, DESPUÉS
// de que la página ya confirmó que el producto existe (§ el docstring de ese archivo) — este
// componente recibe `product`/`catalog` por PROP, no se fetchea a sí mismo, para no duplicar la
// lógica de "producto no encontrado" que la página ya resuelve.
//
// CASI TODO ES REUSO, no dato nuevo (§ el docstring de `REGISTRY.tiendaProducto`,
// site-content-defaults.ts): el color por café es el MISMO `tiendaCatalogo.coloresPorProducto` que
// pinta «Láminas» en /tienda; el sticker es el MISMO `tiendaEncabezado.sticker` de «Carta»; el
// camino de dinero —molienda, cantidad, carrito— es el MISMO `moliendasOpciones`/`moliendaAceptada`/
// `addItem` de la composición «Actual». «QUIENES LO CULTIVAN» (§ PRODUCTO-CHAMISAS-FIDELIDAD-1,
// diferencia 6) reusa el MISMO DATO que `TiendaInterludio` (`tiendaInterludio`, vía
// `useSiteContent`) y su MISMO GATE (`tiendaInterludioVisible`), pero YA NO monta ese componente —
// esta página necesita una FRANJA COMPACTA propia, distinta del Interludio grande y centrado de
// /tienda, así que el dato se lee acá directo y se dibuja con su propio diseño.
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Minus, Plus, ShoppingBag } from 'lucide-react';
import type { Product } from '@/types/product';
import { useCartStore } from '@/lib/cartStore';
import { moliendasDisponibles, moliendaAceptada } from '@duna/core/moliendas-opciones';
import { formatCOP } from '@duna/core/utils';
import { imagenPortada } from '@/lib/producto-imagen';
import { galeriaCompleta } from '@duna/core/product-gallery';
import { whatsappUrl } from '@/lib/config/site';
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { useIsPreview } from '@/components/storefront/PreviewMode';
import { contenedorAnchoClase } from '@/lib/config/themes';
import { getCatalog } from '@/lib/api/products';
import { lavadoLamina } from '@/lib/tienda/laminas';
import { colorLaminaProducto, laminasRelacionadas, fraseNotas, datosProductoLamina, colorPuntoNota, siguienteIndiceGaleria } from '@/lib/tienda/producto-lamina';
import { tiendaInterludioVisible } from '@/lib/tienda/tienda-cierre';
import { REGISTRY, seccionEsVisible } from '@/lib/config/site-content-defaults';
import { entradaHeroInicial, heroDeGaleria } from '@/lib/storefront/pdp-galeria';

// EL UMBRAL DE DESLIZAR (§ PRODUCTO-LAMINA-GALERIA-1) — MISMO valor que `GaleriaProducto.tsx`
// (`UMBRAL_SWIPE_PX`, la composición «Actual»): 40px distingue un arrastre real de un toque corto,
// sin confundir un tap con un gesto de navegación. No se re-exporta desde ese archivo porque es un
// literal de UX, no una regla con decisión que afirmar en capa 1 (a diferencia de
// `siguienteIndiceGaleria`, que sí vive en `lib/`).
const UMBRAL_SWIPE_PX = 40;

interface ProductoLaminaProps {
  product: Product;
  catalog: Product[];
  whatsapp?: string;
}

export default function ProductoLamina({ product, catalog, whatsapp }: ProductoLaminaProps) {
  const { tiendaCatalogo, tiendaEncabezado, tiendaProducto, tiendaInterludio, navTratamiento } = useSiteContent();
  const preview = useIsPreview();
  const { addItem } = useCartStore();
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);

  const [qty, setQty] = useState(1);
  const [imgIdx, setImgIdx] = useState(0);
  // «GALERÍA TOCADA» (§ el mismo mecanismo que `GaleriaProducto.tsx`, vía `entradaHeroInicial`
  // reusado): la foto con la que la página llega NUNCA depende de que una animación de framer-motion
  // complete para hacerse visible (§ `lib/storefront/pdp-galeria.ts`, el defecto que ese archivo
  // documenta). El fade sólo entra en juego DESPUÉS de que el visitante ya cambió de foto una vez —
  // ahí la interacción ya demuestra que JS corre.
  const [galeriaTocada, setGaleriaTocada] = useState(false);
  const touchXRef = useRef<number | null>(null);
  const reducirMovimiento = useReducedMotion();
  const [molienda, setMolienda] = useState<string | null>(
    () => moliendasDisponibles(product.moliendasOpciones)[0]?.nombre ?? null,
  );

  const galeria = galeriaCompleta(product.imagen, product.imagenes);
  const puedeNavegarGaleria = galeria.length > 1;
  const heroSrc = imagenPortada(heroDeGaleria(galeria, imgIdx) ?? '');
  const color = colorLaminaProducto(catalog, product.id, tiendaCatalogo.coloresPorProducto);
  const lavado = lavadoLamina(color);
  const agotado = !product.disponible;
  const datos = datosProductoLamina(product);
  const frase = fraseNotas(product.notas ?? []);
  const relacionados = laminasRelacionadas(catalog, product.id, tiendaCatalogo.coloresPorProducto);
  const maxCompra = product.maxCompra ?? 1;
  // «QUIENES LO CULTIVAN» (§ PRODUCTO-CHAMISAS-FIDELIDAD-1, diferencia 6) honra las DOS condiciones
  // que ya gatean el Interludio en /tienda (`TiendaInterludio.tsx`) — el toggle de sección
  // (`seccionEsVisible`) Y tener retrato (`tiendaInterludioVisible`) — compuestas, nunca una sola:
  // si el dueño apagó «Quienes lo cultivan» a propósito, esta franja no debe resucitarlo aquí.
  const cultivanVisible = seccionEsVisible(REGISTRY.tiendaInterludio, tiendaInterludio) && tiendaInterludioVisible(tiendaInterludio.imagen);

  // EL MECANISMO DE CAMBIAR DE FOTO (§ PRODUCTO-LAMINA-GALERIA-1) — flechas, deslizar, miniaturas y
  // teclado convergen todos en `irA`/`avanzar`, igual que `GaleriaProducto.tsx` (la composición
  // «Actual»): un solo punto de escritura de `imgIdx`, nunca cuatro mecanismos que pudieran dejarlo
  // en estados distintos.
  function irA(i: number) {
    setGaleriaTocada(true);
    setImgIdx(i);
  }

  function avanzar(direccion: 1 | -1) {
    irA(siguienteIndiceGaleria(imgIdx, galeria.length, direccion));
  }

  function onKeyDownGaleria(e: React.KeyboardEvent) {
    if (!puedeNavegarGaleria) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      avanzar(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      avanzar(1);
    }
  }

  function onTouchStartGaleria(e: React.TouchEvent) {
    touchXRef.current = e.touches[0]?.clientX ?? null;
  }

  // SIN `preventDefault` (§ el spec: "sin bloquear el scroll vertical") — sólo se mide la distancia
  // horizontal entre el toque inicial y el final; el scroll vertical del visitante nunca se toca.
  function onTouchEndGaleria(e: React.TouchEvent) {
    if (touchXRef.current === null || !puedeNavegarGaleria) return;
    const inicioX = touchXRef.current;
    touchXRef.current = null;
    const dx = (e.changedTouches[0]?.clientX ?? inicioX) - inicioX;
    if (Math.abs(dx) < UMBRAL_SWIPE_PX) return;
    avanzar(dx < 0 ? 1 : -1);
  }

  const handleAdd = () => {
    // MISMA comprobación que «Actual» (`moliendaAceptada`, la función que el SERVIDOR revalida): así
    // lo que esta composición deja pasar y lo que el checkout acepta no pueden divergir.
    if (!moliendaAceptada(product.moliendasOpciones, molienda)) {
      toast.error('Selecciona una molienda disponible');
      return;
    }
    addItem(product, qty, molienda ? { molienda } : {});
    // CHECKOUT-LISTO-PARA-VENDER-1 — `top-right`, junto al ícono del carrito del nav, nunca
    // tapando el pie fijo del cajón (§ `ProductCard.tsx`, el mismo fix).
    toast.success(`${product.nombre} agregado al carrito`, { position: 'top-right' });
  };

  return (
    <motion.div initial={preview ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div className={`mx-auto ${contenedorClase} pb-16`}>
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
          {/* LA TARJETA DEL COLOR (§ el spec) — el MISMO arco 4:5 que «Láminas» (TiendaLaminas.tsx),
              sobre el lavado del color de ESTE café, nunca el color pleno (el texto nunca va encima
              del color sin lavar). EL TECLADO (§ PRODUCTO-LAMINA-GALERIA-1, "flechas izquierda/
              derecha cuando la galería tiene el foco") va en la TARJETA ENTERA, no en el arco: el
              evento de teclado BURBUJEA desde cualquier descendiente enfocado —una flecha, una
              miniatura— hasta este `onKeyDown`, sin necesitar `tabIndex` propio (mismo mecanismo,
              medido por ejecución, que ya usa `GaleriaProducto.tsx`). */}
          <div className="relative rounded-[24px] p-6 sm:p-8" style={{ backgroundColor: lavado }} onKeyDown={onKeyDownGaleria}>
            {/* EL ARCO + LAS FLECHAS comparten un wrapper PROPIO, SIN `overflow-hidden` (§ el spec:
                "botones circulares sobre el color claro del café") — el arco de la foto SÍ recorta
                (`overflow-hidden`, más abajo), pero las flechas viven en el MARGEN entre el arco
                (`w-[70%]`) y el borde de la tarjeta, que es donde se ve el `lavado` sin la foto
                encima. Metiéndolas dentro del div con `overflow-hidden` quedarían recortadas o
                tapadas por la imagen; en la tarjeta entera, fuera de este wrapper, no podrían
                centrarse verticalmente contra el arco (la tarjeta también mide las miniaturas y los
                puntos de más abajo). Este wrapper no define alto propio: lo hereda del arco, su único
                hijo de flujo normal. */}
            <div
              className="relative mx-auto w-[70%]"
              onTouchStart={onTouchStartGaleria}
              onTouchEnd={onTouchEndGaleria}
            >
              <div className="relative overflow-hidden rounded-t-full rounded-b-[20px]" style={{ aspectRatio: '4 / 5' }}>
                {/* EL CROSSFADE AL CAMBIAR DE FOTO (§ el spec, punto 4: "prefers-reduced-motion: sin
                    animación de paso") — `key={imgIdx}` remonta el `motion.div` en cada cambio;
                    `entradaHeroInicial` (reusada de `lib/storefront/pdp-galeria.ts`, el MISMO gate
                    que «Actual») evita que la foto CON LA QUE LLEGA la página dependa de que
                    framer-motion complete una animación para hacerse visible. Bajo movimiento
                    reducido, `initial` queda SIEMPRE en `false` —se monta YA en el estado final,
                    nunca anima— así que no hay "animación de paso" que mostrar. */}
                <motion.div
                  key={imgIdx}
                  initial={reducirMovimiento ? false : entradaHeroInicial(galeriaTocada)}
                  animate={{ opacity: 1 }}
                  transition={{ duration: reducirMovimiento ? 0 : 0.22, ease: [0.22, 0.61, 0.36, 1] }}
                  className="absolute inset-0"
                >
                  {heroSrc ? (
                    <Image
                      src={heroSrc}
                      alt={product.nombre}
                      fill
                      sizes="(max-width: 1024px) 70vw, 35vw"
                      className="object-cover"
                      priority
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[var(--sf-superficie)]" />
                  )}
                </motion.div>
              </div>

              {/* LAS FLECHAS (§ el spec, punto 1) — SÓLO en escritorio (`hidden sm:flex`): en el
                  celular el gesto es deslizar, no un botón angosto peleando por espacio en el margen
                  del arco. Circulares (`sf-pildora` + `h-10 w-10`), con `aria-label`, cursor, hover
                  (relleno de tinta, el MISMO tratamiento que la molienda SELECCIONADA más abajo —
                  consistencia DENTRO de este archivo, no un token de acento ajeno) y foco visible
                  (el MISMO anillo que ya usan los botones de cantidad). Desplazadas fuera del arco
                  (`-left-12`/`-right-12`, `sm:-left-14`/`sm:-right-14`) para caer en el margen con
                  `lavado`, nunca sobre la foto. */}
              {puedeNavegarGaleria && (
                <>
                  <button
                    type="button"
                    onClick={() => avanzar(-1)}
                    aria-label="Foto anterior"
                    className="absolute -left-12 top-1/2 hidden h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center sf-pildora bg-[var(--sf-fondo)] text-[var(--sf-tinta)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sf-tinta)] hover:bg-[var(--sf-tinta)] hover:text-[var(--sf-fondo)] sm:-left-14 sm:flex"
                  >
                    <ArrowLeft className="h-[18px] w-[18px]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => avanzar(1)}
                    aria-label="Foto siguiente"
                    className="absolute -right-12 top-1/2 hidden h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center sf-pildora bg-[var(--sf-fondo)] text-[var(--sf-tinta)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sf-tinta)] hover:bg-[var(--sf-tinta)] hover:text-[var(--sf-fondo)] sm:-right-14 sm:flex"
                  >
                    <ArrowRight className="h-[18px] w-[18px]" />
                  </button>
                </>
              )}
            </div>

            {/* EL STICKER/BADGE VIVE SOBRE LA TARJETA ENTERA, NO sobre el arco (§ TIENDA-ONIX-AJUSTES-1)
                — dentro del arco angosto (`w-[70%]`) y con el `overflow-hidden` que ese arco necesita
                para recortar la FOTO, un badge girado (`rotate-[8deg]`) queda recortado en el celular
                y, en escritorio, directamente fuera del área visible (el arco es más angosto que la
                tarjeta). Como sibling de la tarjeta —no del arco— tiene margen de sobra para mostrarse
                completo en los dos anchos, igual que en la maqueta aprobada. AGOTADO GANA sobre el
                sticker de la Carta (mismo orden de prioridad que `TiendaLaminas`). */}
            {agotado ? (
              <span className="sf-pildora absolute top-3 right-3 bg-[var(--sf-tostado)] text-[var(--sf-tinta)] px-2.5 py-1 text-xs font-semibold sm:top-4 sm:right-4">
                se nos acabó
              </span>
            ) : tiendaEncabezado.sticker ? (
              <span className="sf-pildora absolute top-3 right-3 rotate-[8deg] bg-[var(--sf-tostado)] text-[var(--sf-tinta)] px-2.5 py-1 text-xs font-semibold sm:top-4 sm:right-4">
                {tiendaEncabezado.sticker}
              </span>
            ) : null}

            {/* LAS MINIATURAS (§ el spec, punto 3) — "arcos pequeños con la foto", el MISMO
                tratamiento de domo que el arco principal y que los arcos chicos de «QUIENES LO
                CULTIVAN»/«TE PUEDE INTERESAR» más abajo en esta misma página, nunca un cuadrado
                genérico. La activa queda marcada con el borde de tinta; clic elige (`irA`, el MISMO
                escritor que las flechas y el deslizar). Con una sola foto, `puedeNavegarGaleria` es
                `false` y nada de esto se monta. */}
            {puedeNavegarGaleria && (
              <div className="mt-4 flex items-center justify-center gap-2">
                {galeria.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => irA(i)}
                    aria-label={`Ver foto ${i + 1} de ${galeria.length}`}
                    aria-current={i === imgIdx}
                    className={`relative h-12 w-10 shrink-0 cursor-pointer overflow-hidden rounded-t-full rounded-b-[8px] border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sf-tinta)] ${
                      i === imgIdx ? 'border-[var(--sf-tinta)]' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <Image src={imagenPortada(img)} alt="" fill sizes="40px" className="object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* LOS PUNTOS SE QUEDAN (§ el spec, punto 5) — reusan `irA`, igual que las flechas y las
                miniaturas, así que un clic en un punto también marca `galeriaTocada` y queda en
                sincronía con las demás entradas. */}
            {puedeNavegarGaleria && (
              <div className="mt-3 flex items-center justify-center gap-2">
                {galeria.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => irA(i)}
                    aria-label={`Foto ${i + 1} de ${galeria.length}`}
                    aria-current={i === imgIdx}
                    className={`h-2 w-2 cursor-pointer rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sf-tinta)] ${
                      i === imgIdx ? 'bg-[var(--sf-tinta)]' : 'bg-[var(--sf-tinta)]/30 hover:bg-[var(--sf-tinta)]/60'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* LA INFO */}
          <div className="space-y-6">
            <h1 className="font-playfair text-3xl text-[var(--sf-tinta)] sm:text-4xl">{product.nombre}</h1>

            {frase && <p className="text-[var(--sf-texto)]">{frase}</p>}

            {(product.notas?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-2">
                {product.notas!.map((n) => (
                  <span
                    key={n}
                    className="sf-pildora-real flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[var(--sf-tinta)]"
                    style={{ backgroundColor: lavado }}
                  >
                    {/* EL PUNTO LLEVA EL COLOR FUERTE, NO EL DE LA LÁMINA (§ PRODUCTO-CHAMISAS-FIDELIDAD-1,
                        diferencia 1) — `colorPuntoNota` deriva una versión saturada/oscura de `color`
                        (nunca un segundo color aparte), así que el punto se distingue del fondo de la
                        píldora (`lavado`) POR CONSTRUCCIÓN y ya no necesita el borde que el defecto viejo
                        (punto hueco y pálido) exigía como parche. */}
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: colorPuntoNota(color) }}
                      aria-hidden="true"
                    />
                    {n}
                  </span>
                ))}
              </div>
            )}

            {/* LA ETIQUETA COSIDA (§ PRODUCTO-CHAMISAS-FIDELIDAD-1, diferencia 2) — borde punteado BIEN
                VISIBLE (2px, tinta al 30%, no el `--sf-linea` tenue de antes), ligeramente girada como
                una etiqueta cosida de verdad, fondo casi blanco (`--sf-tarjeta`, la superficie "papel"
                del motor de tema) y los VALORES en la serif de la tienda — sólo los datos que el
                producto trae; sin ninguno, no se monta la caja. */}
            {datos.length > 0 && (
              <div className="grid -rotate-[0.6deg] grid-cols-2 gap-x-[18px] gap-y-[10px] rounded-[18px] border-2 border-dashed border-[var(--sf-tinta)]/30 bg-[var(--sf-tarjeta)] px-[18px] py-[14px]">
                {datos.map((d) => (
                  <div key={d.label}>
                    <p className="text-xs text-[var(--sf-texto-suave)]">{d.label}</p>
                    <p className="font-playfair text-[17px] text-[var(--sf-tinta)]">{d.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* LA MOLIENDA EN PÍLDORAS — MISMA regla que «Actual» (`moliendasOpciones`, disabled por
                opción); sólo cambia el ESTILO del control, nunca el dato. El rótulo «¿Cómo lo
                quieres?» (§ PRODUCTO-CHAMISAS-FIDELIDAD-1, diferencia 3) nombra la pregunta ANTES de
                las opciones — sin él, las píldoras aparecían sin decir qué estaban eligiendo. */}
            {(product.moliendasOpciones?.length ?? 0) > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-sm text-[var(--sf-texto-suave)]">¿Cómo lo quieres?</span>
                {product.moliendasOpciones!.map((o) => {
                  const selected = molienda === o.nombre;
                  return (
                    <button
                      key={o.nombre}
                      type="button"
                      disabled={!o.disponible}
                      onClick={() => o.disponible && setMolienda(o.nombre)}
                      title={o.disponible ? undefined : 'Próximamente'}
                      className={`sf-pildora-real px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sf-tinta)] ${
                        selected
                          ? 'cursor-pointer bg-[var(--sf-tinta)] text-[var(--sf-fondo)]'
                          : o.disponible
                            ? 'cursor-pointer border border-[var(--sf-linea)] text-[var(--sf-tinta)] hover:border-[var(--sf-tinta)]/40'
                            : 'cursor-not-allowed border border-[var(--sf-linea)] text-[var(--sf-tinta)] opacity-40'
                      }`}
                    >
                      {o.nombre}
                    </button>
                  );
                })}
              </div>
            )}

            {/* EL PRECIO EN LA SERIF DE LA TIENDA (§ PRODUCTO-CHAMISAS-FIDELIDAD-1, diferencia 4) —
                `font-playfair`, grande, cifras tabulares (que no bailen al cambiar de cantidad). */}
            <p className="font-playfair text-3xl tabular-nums text-[var(--sf-tinta)]">{formatCOP(product.precio)}</p>

            {/* LA CANTIDAD Y UN SOLO BOTÓN PRINCIPAL (§ el spec) — sin "Comprar ahora" ni favoritos. */}
            {agotado ? (
              whatsapp ? (
                <a
                  href={whatsappUrl(whatsapp, `Hola, ¿cuándo vuelve a haber ${product.nombre}?`)}
                  target={preview ? undefined : '_blank'}
                  rel="noreferrer"
                  className="sf-pildora inline-flex cursor-pointer items-center justify-center border border-[var(--sf-tinta)] px-6 py-3 text-sm font-medium text-[var(--sf-tinta)] transition-colors hover:bg-[var(--sf-tinta)] hover:text-[var(--sf-fondo)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sf-tinta)]"
                >
                  Avísame por WhatsApp
                </a>
              ) : (
                <p className="text-sm text-[var(--sf-texto-suave)]">Agotado por ahora.</p>
              )
            ) : (
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-3 rounded-full border border-[var(--sf-linea)] px-2 py-1">
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="cursor-pointer rounded-full p-1.5 transition-colors hover:bg-[var(--sf-superficie)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sf-tinta)]"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold text-[var(--sf-tinta)]">{qty}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setQty((q) => {
                        if (q >= maxCompra) {
                          toast.error('Cantidad no disponible');
                          return q;
                        }
                        return q + 1;
                      })
                    }
                    className="cursor-pointer rounded-full p-1.5 transition-colors hover:bg-[var(--sf-superficie)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sf-tinta)]"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleAdd}
                  className="sf-pildora flex cursor-pointer items-center gap-2 bg-[var(--sf-tinta)] px-6 py-3 text-sm font-medium text-[var(--sf-fondo)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sf-tinta)]"
                >
                  <ShoppingBag className="h-4 w-4" /> Agregar al carrito
                </button>
              </div>
            )}

            {/* LA LÍNEA DE CONFIANZA (§ PRODUCTO-CHAMISAS-FIDELIDAD-1, diferencia 5) — el MISMO dato
                que la composición «Actual» ya muestra bajo su botón (`app/(storefront)/tienda/[slug]/
                page.tsx`, las garantías de la ficha). CORREGIDO por § TIENDA-LEGAL-1: ese archivo
                dejó de tener un array literal fijo ("Envío a todo Colombia…", "Tostado dentro de
                los 7 días…") — las garantías pasaron a dato (`tiendaProducto.badge1/2/3`, default
                vacío) porque eran una PROMESA COMERCIAL que ninguna tienda nueva ofrece por
                defecto. Esta línea lee la MISMA fuente, uniendo las que el dueño llenó — nunca el
                literal viejo, que habría quedado mintiendo para cualquier tienda sin esas tres
                condiciones reales. Vacías las tres → la línea se omite entera. */}
            {(() => {
              const garantias = [tiendaProducto.badge1, tiendaProducto.badge2, tiendaProducto.badge3].filter((b) => b.trim() !== '');
              if (garantias.length === 0) return null;
              return (
                <p className="text-[13px] text-[var(--sf-texto-suave)]">
                  {garantias.join(' · ')}
                </p>
              );
            })()}
          </div>
        </div>
      </div>

      {/* QUIENES LO CULTIVAN (§ PRODUCTO-CHAMISAS-FIDELIDAD-1, diferencia 6) — NO es el Interludio
          grande de /tienda (`TiendaInterludio`, centrado, a toda altura): es una FRANJA COMPACTA con
          líneas punteadas arriba/abajo, el retrato en un arco CHICO a la izquierda y la cita con su
          firma a la derecha. Reusa el MISMO dato (`tiendaInterludio`, vía `useSiteContent`) y el MISMO
          gate (`tiendaInterludioVisible`, reusado tal cual — no una segunda definición de "¿hay algo
          que mostrar?") que /tienda, con un diseño propio para esta página. */}
      {cultivanVisible && (
        <div className={`mx-auto ${contenedorClase}`}>
          <div className="grid grid-cols-[150px_1fr] items-center gap-6 border-y-2 border-dashed border-[var(--sf-tinta)]/18 py-7">
            <div className="relative overflow-hidden rounded-t-full rounded-b-[14px] bg-[var(--sf-superficie)]" style={{ aspectRatio: '4 / 5' }}>
              <Image
                src={tiendaInterludio.imagen}
                alt={tiendaInterludio.firma || ''}
                fill
                sizes="150px"
                className="object-cover"
              />
            </div>
            {(tiendaInterludio.cita || tiendaInterludio.firma) && (
              <p className="flex flex-col gap-2 font-playfair text-2xl leading-[1.3] text-[var(--sf-tinta)]">
                {tiendaInterludio.cita && <span className="italic">&ldquo;{tiendaInterludio.cita}&rdquo;</span>}
                {tiendaInterludio.firma && (
                  <span className="not-italic font-sans text-sm text-[var(--sf-texto-suave)]">— {tiendaInterludio.firma}</span>
                )}
              </p>
            )}
          </div>
        </div>
      )}

      {/* «TE PUEDE INTERESAR» (§ PRODUCTO-CHAMISAS-FIDELIDAD-1, diferencia 7) — cada café en una
          LÁMINA HORIZONTAL de su color claro, con PADDING (antes la foto iba pegada al borde), la
          bolsa dentro de un arco CHICO (≈120px) que no la recorta —el defecto viejo: `w-28`/`w-32` sin
          padding, `items-stretch`, hacía que `object-cover` cortara la bolsa para llenar la fila
          entera—, y a la derecha el nombre en serif, la FRASE COMPLETA de notas (reusa `fraseNotas`,
          la MISMA función que arma la frase del producto principal, nunca un `.join(' · ')` aparte) y
          el precio. */}
      {relacionados.length > 0 && (
        <div className="py-16">
          <div className={`mx-auto ${contenedorClase}`}>
            <h2 className="mb-8 font-playfair text-2xl text-[var(--sf-tinta)]">{tiendaProducto.teInteresaTitulo}</h2>
            <div className="grid grid-cols-1 gap-[22px] sm:grid-cols-2">
              {relacionados.map((r) => {
                const fraseR = fraseNotas(r.notas);
                return (
                  <Link
                    key={r.productId}
                    href={`/tienda/${r.slug}`}
                    className="grid cursor-pointer grid-cols-[120px_1fr] items-center gap-4 rounded-[24px] p-4 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sf-tinta)]"
                    style={{ backgroundColor: lavadoLamina(r.color) }}
                  >
                    {/* EL ARCO CHICO (§ la maqueta): el MISMO tratamiento que la foto principal
                        (`rounded-t-full`, domo arriba), con el MISMO radio inferior que ese arco (20px →
                        acá `rounded-b-[18px]`, el de `.arco` en la maqueta — el 14px es sólo del arco
                        MINI de «Quienes lo cultivan», arriba), y ahora CONTENIDO por el padding de la
                        tarjeta en vez de a sangre contra su borde. */}
                    <div className="relative overflow-hidden rounded-t-full rounded-b-[18px] bg-[var(--sf-superficie)]" style={{ aspectRatio: '4 / 5' }}>
                      {r.imagen ? (
                        <Image src={r.imagen} alt={r.nombre} fill sizes="120px" className="object-cover" />
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-1">
                      <h3 className="font-playfair text-lg text-[var(--sf-tinta)]">{r.nombre}</h3>
                      {fraseR && <p className="text-sm text-[var(--sf-texto)]">{fraseR}</p>}
                      <p className="text-sm font-semibold text-[var(--sf-tinta)]">{formatCOP(r.precio)}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// LA VISTA PREVIA DEL PANEL (§ PRODUCTO-CHAMISAS-LAMINA-1, registrada en
// `components/admin/VistaTiendaEnVivo.tsx`). El árbol de preview del editor NO tiene ruta —no hay
// `[slug]` que resolver, como sí hay en la página real—, así que esta envoltura se fetchea su propio
// catálogo (memoizado, § `getCatalog`) y usa el PRIMER producto como muestra, el mismo criterio de
// respaldo que `productoSpotlight` ya usa para el pin de Destacado (`catalog.find(...) ?? catalog[0]`)
// cuando no hay nada más específico que elegir. Sin catálogo (o vacío), no hay nada que previsualizar.
export function ProductoLaminaVistaPrevia() {
  const [catalog, setCatalog] = useState<Product[] | null>(null);
  useEffect(() => {
    getCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);
  if (!catalog || catalog.length === 0) return null;
  return <ProductoLamina product={catalog[0]} catalog={catalog} />;
}
