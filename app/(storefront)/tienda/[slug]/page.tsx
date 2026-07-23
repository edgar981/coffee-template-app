"use client";

import { use, useEffect, useState } from "react";

import Image from "next/image";
import Link from "next/link";

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

import { toast } from "sonner";
import { formatCOP } from "@/lib/utils";
import { TOSTION_LABELS } from "@/constants/roast-levels";
import { SUBSCRIPTIONS_ENABLED, SUBSCRIPTION_DISCOUNT } from "@/constants/features";
import Chip from "@/components/storefront/ProductChip";

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

  // Molienda elegida — por defecto la primera opción disponible del producto
  // ("Media" en molido, "Grano entero" en grano). Como el producto llega
  // async desde la DB, el default se fija cuando carga.
  const [molienda, setMolienda] = useState<string | null>(null);
  useEffect(() => {
    if (product && molienda === null) {
      setMolienda(product.moliendasOpciones?.find((o) => o.disponible)?.nombre ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);

  // Catálogo aún cargando
  if (catalog === null) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center pt-16">
        <p className="font-playfair text-xl text-[#8B6650]">Cargando…</p>
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
          className="text-sm text-[#8B4513] underline"
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

  // Imagen hero: galería si existe, si no la principal. Puede faltar
  // (`undefined`) → renderizamos el bloque crema de marca en su lugar.
  const heroSrc = product.imagenes?.[imgIdx] || product.imagen;

  const related = catalog.filter(
    (p) =>
      p.id !== product.id &&
      (p.categoria === product.categoria ||
        p.origen === product.origen)
  ).slice(0, 4);

  const handleAdd = () => {
    // Solo una molienda marcada como disponible puede ir al carrito (el
    // servidor lo valida de nuevo en el checkout).
    const opcion = product.moliendasOpciones?.find((o) => o.nombre === molienda);
    if (product.moliendasOpciones?.length && (!opcion || !opcion.disponible)) {
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
        <nav className="flex items-center gap-2 text-xs text-[#8B6650]">
          <Link
            href="/"
            className="hover:text-[#8B4513]"
          >
            Inicio
          </Link>

          <span>/</span>

          <Link
            href="/tienda"
            className="hover:text-[#8B4513]"
          >
            Tienda
          </Link>

          <span>/</span>

          <span className="text-[#1a0f08]">
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
              className="relative aspect-square overflow-hidden rounded-3xl bg-[#f0e8de]"
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

            {(product.imagenes?.length ?? 0) >
              1 && (
              <div className="flex gap-3">
                {product.imagenes?.map(
                  (img, i) => (
                    <button
                      key={i}
                      onClick={() =>
                        setImgIdx(i)
                      }
                      className={`h-16 w-16 overflow-hidden rounded-xl border-2 transition-all ${
                        imgIdx === i
                          ? "border-[#8B4513]"
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
                <span className="inline-block text-xs font-semibold bg-[#d4a97a] text-[#1a0f08] px-3 py-1 rounded-full">{product.badge}</span>
              )}
              <div>
                <p className="text-sm text-[#8B4513] mb-1 capitalize">{product.origen || product.categoria?.replace('_', ' ')}</p>
                <h1 className="text-3xl sm:text-4xl font-playfair text-[#1a0f08] leading-tight">{product.nombre}</h1>
              </div>

              {/* Rating */}
              <div className="flex items-center gap-3">
                <div className="flex gap-1">{Array(5).fill(0).map((_, i) => <Star key={i} className="w-4 h-4 fill-[#d4a97a] text-[#d4a97a]" />)}</div>
                <span className="text-sm text-[#5a3a28]">4.9 · 124 reseñas</span>
              </div>

              {/* Ficha técnica — pills compactas (datos estructurados del empaque) */}
              {(product.variedad || product.proceso || product.altitudMin != null) && (
                <div>
                  <div className="flex flex-wrap gap-3">
                    {product.proceso && <Chip label="Proceso" value={product.proceso} />}
                    {product.tostado && <Chip label="Tostión" value={TOSTION_LABELS[product.tostado]} />}
                    {product.altitudMin != null && product.altitudMax != null && (
                      <Chip label="Altitud" value={`${product.altitudMin.toLocaleString('es-CO')}–${product.altitudMax.toLocaleString('es-CO')} m s.n.m.`} />
                    )}
                    {product.peso_gramos != null && <Chip label="Tamaño" value={`${product.peso_gramos} g`} />}
                    {product.variedad && <Chip label="Variedad" value={product.variedad} />}
                  </div>
                  <p className="text-xs text-[#8B6650] mt-2">Café de especialidad · 100% colombiano</p>
                </div>
              )}

              {/* Notas de cata (empaque) */}
              {(product.notasCata?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[#5a3a28] uppercase tracking-wide mb-2">Notas de cata</p>
                  <div className="flex flex-wrap gap-2">
                    {product.notasCata!.map(n => (
                      <span key={n} className="text-sm bg-[#f0e8de] text-[#5a3a28] px-3 py-1 rounded-full border border-[#e8ddd0]">{n}</span>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[#5a3a28] leading-relaxed text-sm">{product.descripcion}</p>

              {/* Tipo de molienda — data-driven desde el producto. Molido: escala
                  completa con solo las disponibles clickeables; Grano: chip único. */}
              {(product.moliendasOpciones?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[#5a3a28] uppercase tracking-wide mb-2">Tipo de molienda</p>
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
                              ? 'border-[#8B4513] bg-[#8B4513]/5'
                              : o.disponible
                                ? 'border-[#e8ddd0] hover:border-[#8B4513]/40 cursor-pointer'
                                : 'border-[#e8ddd0] opacity-40 cursor-not-allowed'
                          }`}
                        >
                          <span className={`block text-xs font-medium ${selected ? 'text-[#8B4513]' : 'text-[#1a0f08]'}`}>{o.nombre}</span>
                          <span className="block text-[10px] text-[#8B6650]">{o.metodo}</span>
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
                <div className={`rounded-2xl border-2 p-4 cursor-pointer transition-all ${suscripcion ? 'border-[#8B4513] bg-[#8B4513]/5' : 'border-[#e8ddd0] hover:border-[#c0a080]'}`} onClick={() => setSuscripcion(!suscripcion)}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-[#1a0f08] text-sm">Suscribirse y ahorrar {Math.round(SUBSCRIPTION_DISCOUNT * 100)}%</p>
                      <p className="text-xs text-[#5a3a28] mt-0.5">Entrega mensual · Pausa o cancela cuando quieras</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${suscripcion ? 'border-[#8B4513] bg-[#8B4513]' : 'border-[#c0a080]'}`}>
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
                  <span className="text-4xl font-bold text-[#1a0f08]">{formatCOP(price)}</span>
                  {suscripcion && <span className="text-lg text-[#a07050] line-through">{formatCOP(product.precio)}</span>}
                  {product.esSuscripcion && <span className="text-sm text-[#5a3a28]">/mes</span>}
                </div>

                {product.disponible ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 bg-[#f0e8de] rounded-xl px-1">
                        <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-9 h-9 flex items-center justify-center hover:bg-[#e8ddd0] rounded-lg transition-colors cursor-pointer"><Minus className="w-4 h-4" /></button>
                        <span className="w-8 text-center font-semibold text-[#1a0f08]">{qty}</span>
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
                          className="w-9 h-9 flex items-center justify-center hover:bg-[#e8ddd0] rounded-lg transition-colors cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={handleAdd} className="flex-1 flex items-center justify-center gap-2 bg-[#1a0f08] hover:bg-[#2d1a0e] text-white font-semibold py-4 rounded-2xl transition-all hover:-translate-y-0.5 text-sm">
                        <ShoppingBag className="w-4 h-4" /> Agregar al carrito
                      </button>
                      <button onClick={() => setWishlisted(!wishlisted)} className={`w-12 h-12 rounded-2xl border-2 flex items-center justify-center transition-all ${wishlisted ? 'border-red-400 bg-red-50 text-red-500' : 'border-[#e8ddd0] text-[#a07050] hover:border-red-300'}`}>
                        <Heart className={`w-5 h-5 ${wishlisted ? 'fill-red-400' : ''}`} />
                      </button>
                    </div>
                    <button onClick={() => { handleAdd(); }} className="w-full border-2 border-[#8B4513] text-[#8B4513] hover:bg-[#8B4513] hover:text-white font-semibold py-4 rounded-2xl transition-all text-sm">
                      Comprar ahora
                    </button>
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center">
                    <p className="font-semibold text-gray-600">Producto Agotado</p>
                    <p className="text-sm text-gray-400 mt-1">Déjanos tu correo para notificarte cuando regrese.</p>
                    <div className="flex gap-2 mt-3">
                      <input type="email" placeholder="tu@correo.com" className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                      <button className="bg-[#8B4513] text-white px-4 py-2 rounded-lg text-sm font-medium">Avisar</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Shipping Perks */}
              <div className="flex flex-col gap-2 pt-2">
                {[{ icon: Truck, text: 'Envío a todo Colombia · Gratis +$150.000' }, { icon: RotateCcw, text: 'Garantía de frescura de 30 días' }, { icon: CheckCircle, text: 'Tostado dentro de los 7 días previos al envío' }].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-2 text-xs text-[#5a3a28]">
                    <Icon className="w-3.5 h-3.5 text-[#8B4513] shrink-0" /> {text}
                  </div>
                ))}
              </div>
            </div>
        </div>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <div className="bg-[#f0e8de] py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2 className="mb-8 font-playfair text-2xl text-[#1a0f08]">
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
