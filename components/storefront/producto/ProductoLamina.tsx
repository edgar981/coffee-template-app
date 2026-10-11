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
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Minus, Plus, ShoppingBag } from 'lucide-react';
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
import { colorLaminaProducto, laminasRelacionadas, fraseNotas, datosProductoLamina, colorPuntoNota } from '@/lib/tienda/producto-lamina';
import { tiendaInterludioVisible } from '@/lib/tienda/tienda-cierre';
import { REGISTRY, seccionEsVisible } from '@/lib/config/site-content-defaults';

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
  const [molienda, setMolienda] = useState<string | null>(
    () => moliendasDisponibles(product.moliendasOpciones)[0]?.nombre ?? null,
  );

  const galeria = galeriaCompleta(product.imagen, product.imagenes);
  const heroSrc = imagenPortada(galeria[imgIdx] ?? '');
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

  const handleAdd = () => {
    // MISMA comprobación que «Actual» (`moliendaAceptada`, la función que el SERVIDOR revalida): así
    // lo que esta composición deja pasar y lo que el checkout acepta no pueden divergir.
    if (!moliendaAceptada(product.moliendasOpciones, molienda)) {
      toast.error('Selecciona una molienda disponible');
      return;
    }
    addItem(product, qty, molienda ? { molienda } : {});
    toast.success(`${product.nombre} agregado al carrito`);
  };

  return (
    <motion.div initial={preview ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div className={`mx-auto ${contenedorClase} pb-16`}>
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
          {/* LA TARJETA DEL COLOR (§ el spec) — el MISMO arco 4:5 que «Láminas» (TiendaLaminas.tsx),
              sobre el lavado del color de ESTE café, nunca el color pleno (el texto nunca va encima
              del color sin lavar). */}
          <div className="relative rounded-[24px] p-6 sm:p-8" style={{ backgroundColor: lavado }}>
            <div className="relative mx-auto w-[70%] overflow-hidden rounded-t-full rounded-b-[20px]" style={{ aspectRatio: '4 / 5' }}>
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

            {/* LAS DEMÁS FOTOS, SIN FLECHAS (§ el spec) — puntos, no un carrusel con flechas. */}
            {galeria.length > 1 && (
              <div className="mt-4 flex items-center justify-center gap-2">
                {galeria.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setImgIdx(i)}
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
                page.tsx`, el array "Shipping Perks": "Envío a todo Colombia…" + "Tostado dentro de los
                7 días previos al envío"), no un texto nuevo inventado para esta composición — sólo se
                recombinan sus dos hechos de envío/tostión en una sola línea, como pide la maqueta.
                Ese archivo queda FUERA de `touches:`, así que esta línea es un literal propio; si
                algún día ese texto cambia en «Actual», esta línea puede quedar desactualizada — anotado
                como seguimiento, no una refactorización de este slice. */}
            <p className="text-[13px] text-[var(--sf-texto-suave)]">
              Envío a todo Colombia · tostado dentro de los 7 días previos al envío
            </p>
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
