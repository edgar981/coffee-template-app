"use client";

import { use, useEffect, useState } from "react";

import Image from "next/image";
import Link from "next/link";
import { imagenPortada } from "@/lib/producto-imagen";

import {
  ShoppingBag,
  Minus,
  Plus,
  Heart,
  Truck,
  RotateCcw,
  CheckCircle,
  MessageCircle,
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
import Chip from "@/components/storefront/ProductChip";
import { galeriaCompleta } from "@duna/core/product-gallery";
import { entradaHeroInicial, heroDeGaleria } from "@/lib/storefront/pdp-galeria";
import { clasesBotonesCompra, claseBotonFavoritos } from "@/lib/storefront/pdp-botones";
import GaleriaProducto from "@/components/storefront/pdp/GaleriaProducto";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useSiteSettings } from "@/components/storefront/SiteSettingsProvider";
import { contenedorAnchoClase, navOffsetClase } from "@/lib/config/themes";
import ProductoLamina from "@/components/storefront/producto/ProductoLamina";
import { whatsappUrl } from "@/lib/config/site";

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
  // § PARIDAD-PDP-BOTONES-1 (`lib/storefront/pdp-botones.ts`): la jerarquía/color de los dos botones
  // de compra sigue al eje EXISTENTE `tema.origenAccion`, no un campo nuevo de SiteContent.
  // `tiendaProducto` (§ PRODUCTO-CHAMISAS-LAMINA-1): la composición elegida para ESTA página —
  // «Actual» (byte-idéntica, lo de siempre abajo) o «Lámina abierta» (`ProductoLamina`, montada más
  // abajo con el producto/catálogo que esta página ya resolvió).
  const { tema, navTratamiento, tiendaProducto } = useSiteContent();
  // `whatsapp` (§ PRODUCTO-CHAMISAS-LAMINA-1): sólo lo consume «Lámina abierta», para «Avísame por
  // WhatsApp» en un café agotado de "Te puede interesar" — mismo patrón que `TiendaLaminas`/
  // `TiendaCierre`. La composición «Actual», de abajo, no lo lee: un hook de más sin renderizar nada
  // no cambia un solo byte de su HTML.
  const { whatsapp } = useSiteSettings();
  // § DESTACADO-PANEL-COMPLETO-Y-BOTONES-PDP-1: cantidad/favoritos se suman a la misma función, con
  // el mismo gate `tema.origenAccion` — Nayoli y el resto quedan byte a byte en lo de siempre.
  const { primario: claseBotonComprar, secundario: claseBotonAgregar, cantidad: claseCantidad, cantidadBoton: claseCantidadBoton } = clasesBotonesCompra(tema.origenAccion);
  // EL CONTENEDOR (§ PARIDAD-ANCHO-CONTENIDO-1) — ver el docstring de `contenedorAnchoClase`
  // (`lib/config/themes.ts`) para el porqué de reusar `navTratamiento.posicion` acá. `false`
  // (todo tenant salvo CORTE) = el literal de HOY, byte a byte.
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);
  // EL RELLENO SUPERIOR (§ NAV-INTERNAS-CLARO-Y-OFFSET-1) — el defecto REPORTADO que este slice
  // cierra: sin esto, el header fijo de CORTE (76/88px) tapaba la ruta de migas ("Inicio / Tienda /
  // producto"), que reservaba sólo 64px (`pt-16`). Ver el docstring de `navOffsetClase`
  // (`lib/config/themes.ts`). `false` (todo tenant salvo CORTE) = `pt-16`, byte a byte.
  const offsetClase = navOffsetClase(navTratamiento.posicion);

  const [qty, setQty] = useState(1);

  const [imgIdx, setImgIdx] =
    useState(0);

  // § HERO-SIN-TARJETA-Y-PDP-IMAGEN-1 (defecto 2, `lib/storefront/pdp-galeria.ts`): mientras el
  // visitante NO tocó ninguna miniatura, la imagen principal no debe depender de que una animación
  // de JS complete para hacerse visible. Se pone en `true` en el `onClick` de la miniatura, abajo —
  // nunca se vuelve a `false` (una vez que JS demostró estar corriendo, se queda demostrado).
  const [galeriaTocada, setGaleriaTocada] =
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
      <div className={`flex min-h-[60vh] items-center justify-center ${offsetClase}`}>
        <p className="font-playfair text-xl text-[var(--sf-texto-suave)]">Cargando…</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className={`flex min-h-[60vh] flex-col items-center justify-center ${offsetClase}`}>
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
  const heroSrc = imagenPortada(heroDeGaleria(galeria, imgIdx));

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
      product,

      qty,

      {
        ...(molienda ? { molienda } : {}),
      }
    );

    toast.success(
      `${product.nombre} agregado al carrito`
    );
  };

  return (
    <div className={offsetClase}>
      {/* Breadcrumb — § MENU-MOVIL-MARGEN-Y-CENSO-TRANSICIONES-1 (censo de transiciones,
          2026-09-30): los dos enlaces ("Inicio"/"Tienda") cambiaban de color al hover SIN
          `transition-colors` (a diferencia del resto de hovers de esta página, todos con
          `transition-colors`/`transition-all`) — se les agregó, sin tocar color ni destino. */}
      <div className={`mx-auto ${contenedorClase} py-4`}>
        <nav className="flex items-center gap-2 text-xs text-[var(--sf-texto-suave)]">
          <Link
            href="/"
            className="transition-colors hover:text-[var(--sf-acento-texto)]"
          >
            Inicio
          </Link>

          <span>/</span>

          <Link
            href="/tienda"
            className="transition-colors hover:text-[var(--sf-acento-texto)]"
          >
            Tienda
          </Link>

          <span>/</span>

          <span className="text-[var(--sf-tinta)]">
            {product.nombre}
          </span>
        </nav>
      </div>

      {/* § PRODUCTO-CHAMISAS-LAMINA-1 — la composición elegida decide el resto de la página; el
          breadcrumb de arriba es compartido por las dos. «Lámina abierta» recibe el `product`/
          `catalog` que esta página YA resolvió (sin `product` no se habría llegado hasta acá, § el
          early-return "Producto no encontrado" de arriba) — nunca un segundo fetch ni una segunda
          resolución de "no encontrado". `key={product.id}` fuerza un remonte limpio al navegar de un
          producto a otro por «Te puede interesar» (sin él, `qty`/`molienda`/`imgIdx` del producto
          anterior sobrevivirían en el nuevo). */}
      {tiendaProducto.variante === 'lamina' ? (
        <ProductoLamina key={product.id} product={product} catalog={catalog} whatsapp={whatsapp} />
      ) : (
        <>
      {/* Product */}
      <div className={`mx-auto ${contenedorClase} pb-16`}>
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Images — § FOTOS-SIN-BORDE-LINEA-NAV-FLECHAS-PDP-1 (sólo CORTE): CORTE monta
              `GaleriaProducto` (flechas sobre la imagen, teclado, swipe — su propio docstring).
              Los otros 5 presets siguen con ESTE markup, sin cambio — `navTratamiento.posicion` es
              el MISMO booleano que ya gatea `contenedorClase`/`offsetClase` arriba ("adoptar la
              geometría MEDIDA del prototipo", hoy sólo CORTE la declara). Nayoli byte-idéntico:
              nunca importa ni renderiza `GaleriaProducto`. */}
          {navTratamiento.posicion ? (
            <GaleriaProducto galeria={galeria} nombre={product.nombre} />
          ) : (
            <div className="space-y-3">
              {/* § HERO-SIN-TARJETA-Y-PDP-IMAGEN-1: la imagen PRINCIPAL nunca debe depender de que
                  una animación de JS complete para hacerse visible (`initial={false}` mientras el
                  visitante no tocó ninguna miniatura, § lib/storefront/pdp-galeria.ts). El fade entre
                  imágenes se conserva DESPUÉS de la primera interacción. */}
              <motion.div
                key={imgIdx}
                initial={entradaHeroInicial(galeriaTocada)}
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
                        onClick={() => {
                          setGaleriaTocada(true);
                          setImgIdx(i);
                        }}
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
          )}

          {/* Info */}
          <div className="space-y-6">
              {product.badge && (
                <span className="inline-block text-xs font-semibold bg-[var(--sf-tostado)] text-[var(--sf-tinta)] px-3 py-1 sf-pildora sf-badge">{product.badge}</span>
              )}
              <div>
                <p className="text-sm text-[var(--sf-acento-texto)] mb-1 capitalize">{product.origen || product.categoria?.replace('_', ' ')}</p>
                <h1 className="text-3xl sm:text-4xl font-playfair text-[var(--sf-tinta)] leading-tight">{product.nombre}</h1>
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
                      // PALETA-MIGRAR-TEXTO-SOBRE-SUPERFICIE-1: texto directo sobre `--sf-superficie`
                      // migrado al par `var(--sf-sobre-superficie,<token de hoy>)`.
                      <span key={n} className="text-sm bg-[var(--sf-superficie)] text-[var(--sf-sobre-superficie,var(--sf-texto))] px-3 py-1 sf-pildora sf-borde border-[var(--sf-linea)]">{n}</span>
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
                          className={`px-3 py-2 sf-radio-lg text-left sf-borde transition-all ${
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

              {/* Price + CTA */}
              <div className="space-y-4">
                <div className="flex items-end gap-3">
                  <span className="text-4xl font-bold text-[var(--sf-tinta)]">{formatCOP(product.precio)}</span>
                </div>

                {product.disponible ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      {/* PALETA-MIGRAR-TEXTO-SOBRE-SUPERFICIE-1: texto directo sobre `--sf-superficie`
                          migrado al par `var(--sf-sobre-superficie,<token de hoy>)`. El span de la
                          cantidad (fallback `--sf-tinta`, no `--sf-texto`) migró en PALETA-MIGRAR-
                          ACENTO-TINTA-1 -- § PALETA-ACENTO-TINTA-SOBRE-SUPERFICIE-1, DECISIONS.md. */}
                      <div className={claseCantidad}>
                        <button onClick={() => setQty(Math.max(1, qty - 1))} className={claseCantidadBoton}><Minus className="w-4 h-4" /></button>
                        <span className="w-8 text-center font-semibold text-[var(--sf-sobre-superficie,var(--sf-tinta))]">{qty}</span>
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
                          className={claseCantidadBoton}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={handleAdd} className={claseBotonAgregar}>
                        <ShoppingBag className="w-4 h-4" /> Agregar al carrito
                      </button>
                      <button onClick={() => setWishlisted(!wishlisted)} className={claseBotonFavoritos(tema.origenAccion, wishlisted)}>
                        <Heart className={`w-5 h-5 ${wishlisted ? 'fill-red-400' : ''}`} />
                      </button>
                    </div>
                    <button onClick={() => { handleAdd(); }} className={claseBotonComprar}>
                      Comprar ahora
                    </button>
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center">
                    <p className="font-semibold text-gray-600">Producto Agotado</p>
                    {/* TIENDA-LEGAL-1 — el formulario «Avisar» se QUITA: no tenía manejador (el
                        botón no hacía nada con el correo tecleado). En su lugar, el único canal
                        real que ya existe para este caso — WhatsApp, si la tienda lo configuró —
                        o, sin él, un texto honesto sin prometer un aviso que nadie va a mandar. */}
                    {whatsapp.trim() !== '' ? (
                      <a
                        href={whatsappUrl(whatsapp, `Hola, quiero saber cuándo vuelve a estar disponible "${product.nombre}".`)}
                        target="_blank" rel="noopener"
                        className="mt-3 inline-flex items-center justify-center gap-1.5 bg-[var(--sf-acento)] text-[var(--sf-acento-txt)] px-4 py-2 sf-radio-lg text-sm font-medium"
                      >
                        <MessageCircle className="w-4 h-4" /> Avísame por WhatsApp
                      </a>
                    ) : (
                      <p className="text-sm text-gray-400 mt-1">Vuelve a visitarnos pronto.</p>
                    )}
                  </div>
                )}
              </div>

              {/* TIENDA-LEGAL-1 — las TRES garantías dejaron de ser un array literal fijo
                  ("Envío a todo Colombia · Gratis +$150.000", "Garantía de frescura de 30 días",
                  "Tostado dentro de los 7 días previos al envío"): ahora son DATO
                  (`tiendaProducto.badge1/2/3`, default vacío), y cada una se muestra SÓLO si el
                  dueño la escribió — la fila se achica sola en vez de mostrar una promesa que
                  nadie confirmó. */}
              <div className="flex flex-col gap-2 pt-2">
                {[
                  { icon: Truck, text: tiendaProducto.badge1 },
                  { icon: RotateCcw, text: tiendaProducto.badge2 },
                  { icon: CheckCircle, text: tiendaProducto.badge3 },
                ].filter(({ text }) => text.trim() !== '').map(({ icon: Icon, text }) => (
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
        // Este h2 (fallback `--sf-tinta`) migró en PALETA-MIGRAR-ACENTO-TINTA-1 --
        // § PALETA-ACENTO-TINTA-SOBRE-SUPERFICIE-1, DECISIONS.md.
        <div className="bg-[var(--sf-superficie)] py-16">
          <div className={`mx-auto ${contenedorClase}`}>
            <h2 className="mb-8 font-playfair text-2xl text-[var(--sf-sobre-superficie,var(--sf-tinta))]">
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
        </>
      )}
    </div>
  );
}
