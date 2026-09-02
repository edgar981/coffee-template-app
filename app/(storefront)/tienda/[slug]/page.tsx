"use client";

import { use, useEffect, useState } from "react";

import Image from "next/image";
import Link from "next/link";
import { imagenPortada } from "@/lib/producto-imagen";

import {
  ShoppingBag,
  Star,
  Minus,
  Plus,
  Heart,
  Truck,
  RotateCcw,
  CheckCircle,
} from "lucide-react";

import { motion } from "framer-motion";

import ProductCard from "@/components/storefront/ProductCard";

import { getCatalog } from "@/lib/api/products";
import type { Product } from "@/types/product";

import { useCartStore } from "@/lib/cartStore";
import { moliendasDisponibles, moliendaAceptada } from "@duna/core/moliendas-opciones";

import { toast } from "sonner";
import { formatCOP } from "@duna/core/utils";
import { TOSTION_LABELS } from "@/constants/roast-levels";
import { SUBSCRIPTIONS_ENABLED, SUBSCRIPTION_DISCOUNT } from "@/constants/features";
import Chip from "@/components/storefront/ProductChip";
import { galeriaCompleta } from "@duna/core/product-gallery";

interface ProductPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default function ProductPage({
  params,
}: ProductPageProps) {
  const { slug } = use(params);

  // Fuente única: catálogo público desde la DB (memoizado en lib/api).
  const [catalog, setCatalog] = useState<Product[] | null>(null);
  useEffect(() => {
    getCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);

  const product = catalog?.find((p) => p.slug === slug);

  const { addItem } = useCartStore();

  const [qty, setQty] = useState(1);

  const [imgIdx, setImgIdx] =
    useState(0);

  const [suscripcion, setSuscripcion] =
    useState(false);

  const [wishlisted, setWishlisted] =
    useState(false);

  // Molienda elegida — por defecto la primera opción DISPONIBLE del producto
  // ("Media" en molido, "Grano entero" en grano). Como el producto llega
  // async desde la DB, el default se fija cuando carga.
  //
  // Sale de `moliendasDisponibles`, el helper compartido con la card y con el
  // servidor: cuando esta preselección la calculaba este archivo por su cuenta, la
  // card construía la línea distinto y el checkout la rechazaba.
  const [molienda, setMolienda] = useState<string | null>(null);
  useEffect(() => {
    if (product && molienda === null) {
      setMolienda(moliendasDisponibles(product.moliendasOpciones)[0]?.nombre ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);

  // Catálogo aún cargando
  if (catalog === null) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center pt-16">
        <p className="font-playfair text-xl text-[var(--sf-texto-suave)]">Cargando…</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center pt-16">
        <p className="mb-4 font-playfair text-xl">
          Producto no encontrado
        </p>

        <Link
          href="/tienda"
          className="text-sm text-[var(--sf-acento-texto)] underline"
        >
          ← Volver a la tienda
        </Link>
      </div>
    );
  }

  const price = suscripcion
    ? Math.round(product.precio * (1 - SUBSCRIPTION_DISCOUNT))
    : product.precio;

  // Tope del selector de cantidad. Viene acotado desde el catálogo (no revela
  // el stock real); si faltara, caemos a 1 para no permitir compras ciegas.
  const maxCompra = product.maxCompra ?? 1;

  // Galería del detalle: portada primero, después las tomas adicionales, SIN
  // repetir. La dedupe la hace `galeriaCompleta` —compartida con el admin— y es
  // una guarda, no una limpieza pendiente: los seeds traen la portada duplicada
  // dentro de `imagenes[]` y ese dato no se migró (ver CLAUDE.md).
  //
  // `imgIdx` indexa ESTA lista, no `imagenes[]`: la portada es el índice 0, así
  // que el hero arranca en ella. Puede quedar vacía (producto sin imágenes) →
  // se renderiza el bloque crema de marca.
  const galeria = galeriaCompleta(product.imagen, product.imagenes);
  const heroSrc = imagenPortada(galeria[imgIdx] ?? galeria[0]);

  const related = catalog.filter(
    (p) =>
      p.id !== product.id &&
      (p.categoria === product.categoria ||
        p.origen === product.origen)
  ).slice(0, 4);

  const handleAdd = () => {
    // Se comprueba con `moliendaAceptada`, LA MISMA función que decide en el
    // servidor: así lo que la UI deja pasar y lo que el checkout acepta no pueden
    // separarse. El servidor sigue revalidando — esto es para dar el error acá y
    // no en el último paso del pago.
    if (!moliendaAceptada(product.moliendasOpciones, molienda)) {
      toast.error("Selecciona una molienda disponible");
      return;
    }

    addItem(
      {
        ...product,
        precio: price,
      },

      qty,

      {
        ...(molienda ? { molienda } : {}),
        suscripcion,
      }
    );

    toast.success(
      `${product.nombre} agregado al carrito`
    );
  };

  return (
    <div className="pt-16">
      {/* Breadcrumb */}
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
        <nav className="flex items-center gap-2 text-xs text-[var(--sf-texto-suave)]">
          <Link
            href="/"
            className="hover:text-[var(--sf-acento-texto)]"
          >
            Inicio
          </Link>

          <span>/</span>

          <Link
            href="/tienda"
            className="hover:text-[var(--sf-acento-texto)]"
          >
            Tienda
          </Link>

          <span>/</span>

          <span className="text-[var(--sf-tinta)]">
            {product.nombre}
          </span>
        </nav>
      </div>

      {/* Product */}
      <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Images */}
          <div className="space-y-3">
            <motion.div
              key={imgIdx}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="relative aspect-square overflow-hidden rounded-3xl bg-[var(--sf-superficie)]"
            >
              {heroSrc && (
                <Image
                  src={heroSrc}
                  alt={product.nombre}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                  // Imagen hero del detalle = LCP: preload + sin lazy-loading.
                  priority
                />
              )}
            </motion.div>

            {/* Una sola imagen no lleva fila de miniaturas: un thumbnail suelto
                bajo su propia hero no es navegación, es ruido. Por eso un
                producto sin tomas adicionales se ve exactamente como antes. */}
            {galeria.length > 1 && (
              <div className="flex gap-3">
                {galeria.map(
                  (img, i) => (
                    <button
                      key={i}
                      onClick={() =>
                        setImgIdx(i)
                      }
                      className={`h-16 w-16 overflow-hidden rounded-xl border-2 transition-all ${
                        imgIdx === i
                          ? "border-[var(--sf-acento)]"
                          : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                    >
                      <div className="relative h-full w-full">
                        <Image
                          src={img}
                          alt=""
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      </div>
                    </button>
                  )
                )}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="space-y-6">
              {product.badge && (
                <span className="inline-block text-xs font-semibold bg-[var(--sf-tostado)] text-[var(--sf-tinta)] px-3 py-1 rounded-full">{product.badge}</span>
              )}
              <div>
                <p className="text-sm text-[var(--sf-acento-texto)] mb-1 capitalize">{product.origen || product.categoria?.replace('_', ' ')}</p>
                <h1 className="text-3xl sm:text-4xl font-playfair text-[var(--sf-tinta)] leading-tight">{product.nombre}</h1>
              </div>

              {/* Rating */}
              <div className="flex items-center gap-3">
                <div className="flex gap-1">{Array(5).fill(0).map((_, i) => <Star key={i} className="w-4 h-4 fill-[var(--sf-tostado)] text-[var(--sf-tostado)]" />)}</div>
                <span className="text-sm text-[var(--sf-texto)]">4.9 · 124 reseñas</span>
              </div>

              {/* Ficha técnica — pills compactas (datos estructurados del empaque) */}
              {(product.variedad || product.proceso || product.altitudMin != null) && (
                <div>
                  <div className="flex flex-wrap gap-3">
                    {product.proceso && <Chip label="Proceso" value={product.proceso} />}
                    {/* Sólo si `tostado` es uno de los 4 niveles conocidos: un valor fuera de RoastLevel
                        (un catálogo no-café) NO pinta "Tostión: undefined" (C3, hardening). */}
                    {product.tostado && TOSTION_LABELS[product.tostado] && <Chip label="Tostión" value={TOSTION_LABELS[product.tostado]} />}
                    {product.altitudMin != null && product.altitudMax != null && (
                      <Chip label="Altitud" value={`${product.altitudMin.toLocaleString('es-CO')}–${product.altitudMax.toLocaleString('es-CO')} m s.n.m.`} />
                    )}
                    {product.peso_gramos != null && <Chip label="Tamaño" value={`${product.peso_gramos} g`} />}
                    {product.variedad && <Chip label="Variedad" value={product.variedad} />}
                  </div>
                  <p className="text-xs text-[var(--sf-texto-suave)] mt-2">Café de especialidad · 100% colombiano</p>
                </div>
              )}

              {/* Notas de cata (empaque) */}
              {(product.notasCata?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[var(--sf-texto)] uppercase tracking-wide mb-2">Notas de cata</p>
                  <div className="flex flex-wrap gap-2">
                    {product.notasCata!.map(n => (
                      <span key={n} className="text-sm bg-[var(--sf-superficie)] text-[var(--sf-texto)] px-3 py-1 rounded-full border border-[var(--sf-linea)]">{n}</span>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[var(--sf-texto)] leading-relaxed text-sm">{product.descripcion}</p>

              {/* Tipo de molienda — data-driven desde el producto. Molido: escala
                  completa con solo las disponibles clickeables; Grano: chip único. */}
              {(product.moliendasOpciones?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[var(--sf-texto)] uppercase tracking-wide mb-2">Tipo de molienda</p>
                  <div className="flex flex-wrap gap-2">
                    {product.moliendasOpciones!.map(o => {
                      const selected = molienda === o.nombre;
                      return (
                        <button
                          key={o.nombre}
                          disabled={!o.disponible}
                          onClick={() => o.disponible && setMolienda(o.nombre)}
                          title={o.disponible ? undefined : 'Próximamente'}
                          className={`px-3 py-2 rounded-lg text-left border transition-all ${
                            selected
                              ? 'border-[var(--sf-acento)] bg-[var(--sf-acento)]/5'
                              : o.disponible
                                ? 'border-[var(--sf-linea)] hover:border-[var(--sf-acento)]/40 cursor-pointer'
                                : 'border-[var(--sf-linea)] opacity-40 cursor-not-allowed'
                          }`}
                        >
                          <span className={`block text-xs font-medium ${selected ? 'text-[var(--sf-acento-texto)]' : 'text-[var(--sf-tinta)]'}`}>{o.nombre}</span>
                          <span className="block text-[10px] text-[var(--sf-texto-suave)]">{o.metodo}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Subscription Toggle — OCULTO por ahora: Nayoli no opera
                  suscripciones todavía (SUBSCRIPTIONS_ENABLED). El componente se
                  conserva para reactivarlo cuando se definan precio y descuento. */}
              {SUBSCRIPTIONS_ENABLED && !product.esSuscripcion && (
                <div className={`rounded-2xl border-2 p-4 cursor-pointer transition-all ${suscripcion ? 'border-[var(--sf-acento)] bg-[var(--sf-acento)]/5' : 'border-[var(--sf-linea)] hover:border-[var(--sf-tostado-2)]'}`} onClick={() => setSuscripcion(!suscripcion)}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-[var(--sf-tinta)] text-sm">Suscribirse y ahorrar {Math.round(SUBSCRIPTION_DISCOUNT * 100)}%</p>
                      <p className="text-xs text-[var(--sf-texto)] mt-0.5">Entrega mensual · Pausa o cancela cuando quieras</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${suscripcion ? 'border-[var(--sf-acento)] bg-[var(--sf-acento)]' : 'border-[var(--sf-tostado-2)]'}`}>
                      {suscripcion && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                    </div>
                  </div>
                  {suscripcion && (
                    <p className="text-xs text-emerald-700 mt-2 font-medium">Ahorras {formatCOP(product.precio - price)} por entrega</p>
                  )}
                </div>
              )}

              {/* Price + CTA */}
              <div className="space-y-4">
                <div className="flex items-end gap-3">
                  <span className="text-4xl font-bold text-[var(--sf-tinta)]">{formatCOP(price)}</span>
                  {suscripcion && <span className="text-lg text-[var(--sf-tostado-3)] line-through">{formatCOP(product.precio)}</span>}
                  {product.esSuscripcion && <span className="text-sm text-[var(--sf-texto)]">/mes</span>}
                </div>

                {product.disponible ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 bg-[var(--sf-superficie)] rounded-xl px-1">
                        <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-9 h-9 flex items-center justify-center hover:bg-[var(--sf-linea)] rounded-lg transition-colors cursor-pointer"><Minus className="w-4 h-4" /></button>
                        <span className="w-8 text-center font-semibold text-[var(--sf-tinta)]">{qty}</span>
                        <button
                          onClick={() =>
                            setQty((q) => {
                              // Tope de cantidad sin revelar el número disponible.
                              if (q >= maxCompra) {
                                toast.error("Cantidad no disponible");
                                return q;
                              }
                              return q + 1;
                            })
                          }
                          className="w-9 h-9 flex items-center justify-center hover:bg-[var(--sf-linea)] rounded-lg transition-colors cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={handleAdd} className="flex-1 flex items-center justify-center gap-2 bg-[var(--sf-tinta)] hover:bg-[var(--sf-tinta-2)] text-white font-semibold py-4 rounded-2xl transition-all hover:-translate-y-0.5 text-sm">
                        <ShoppingBag className="w-4 h-4" /> Agregar al carrito
                      </button>
                      <button onClick={() => setWishlisted(!wishlisted)} className={`w-12 h-12 rounded-2xl border-2 flex items-center justify-center transition-all ${wishlisted ? 'border-red-400 bg-red-50 text-red-500' : 'border-[var(--sf-linea)] text-[var(--sf-tostado-3)] hover:border-red-300'}`}>
                        <Heart className={`w-5 h-5 ${wishlisted ? 'fill-red-400' : ''}`} />
                      </button>
                    </div>
                    <button onClick={() => { handleAdd(); }} className="w-full border-2 border-[var(--sf-acento)] text-[var(--sf-acento-texto)] hover:bg-[var(--sf-acento)] hover:text-[var(--sf-acento-txt)] font-semibold py-4 rounded-2xl transition-all text-sm">
                      Comprar ahora
                    </button>
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center">
                    <p className="font-semibold text-gray-600">Producto Agotado</p>
                    <p className="text-sm text-gray-400 mt-1">Déjanos tu correo para notificarte cuando regrese.</p>
                    <div className="flex gap-2 mt-3">
                      <input type="email" placeholder="tu@correo.com" className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                      <button className="bg-[var(--sf-acento)] text-[var(--sf-acento-txt)] px-4 py-2 rounded-lg text-sm font-medium">Avisar</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Shipping Perks */}
              <div className="flex flex-col gap-2 pt-2">
                {[{ icon: Truck, text: 'Envío a todo Colombia · Gratis +$150.000' }, { icon: RotateCcw, text: 'Garantía de frescura de 30 días' }, { icon: CheckCircle, text: 'Tostado dentro de los 7 días previos al envío' }].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-2 text-xs text-[var(--sf-texto)]">
                    <Icon className="w-3.5 h-3.5 text-[var(--sf-acento-texto)] shrink-0" /> {text}
                  </div>
                ))}
              </div>
            </div>
        </div>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <div className="bg-[var(--sf-superficie)] py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2 className="mb-8 font-playfair text-2xl text-[var(--sf-tinta)]">
              También te puede gustar
            </h2>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {related.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  sizes="(max-width: 640px) 50vw, 25vw"
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
