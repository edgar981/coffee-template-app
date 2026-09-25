"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import { getCatalog } from "@/lib/api/products";
import type { Product } from "@/types/product";
import { useCartStore } from "@/lib/cartStore";
import { moliendasDisponibles, moliendaAceptada } from "@duna/core/moliendas-opciones";
import { formatCOP } from "@duna/core/utils";
import { imagenPortada } from "@/lib/producto-imagen";
import { fadeUp } from "@/lib/animation";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { REGISTRY, seccionEsVisible, productoSpotlight, productoOtraTalla } from "@/lib/config/site-content-defaults";
import { fontSizeDisplay } from "@/lib/config/escala-display";

// LA BANDA SPOTLIGHT (§ SPOTLIGHT-BANDA-1) — un solo producto PINEADO, con su selector de
// molienda, notas de cata y "Agregar al carrito" REUSADOS VERBATIM (medido:
// SPOTLIGHT-CAPACIDAD-CENSO-1: el selector es `moliendasDisponibles`/`moliendaAceptada`, el MISMO
// módulo que ya comparten ProductCard/el detalle/el servidor; el carrito es el `addItem` de
// `useCartStore`, sin una segunda implementación). El PIN (`spotlight.productoSlug`) se resuelve
// contra el catálogo vivo con `productoSpotlight` (§ site-content-defaults.ts): el producto pineado
// se LEE en cada render — nombre, descripción, notas de cata, precio e imagen NUNCA se copian a
// SiteContent, sólo su `slug` viaja como puntero.
//
// EL PANEL/EL CABLEADO EN LA HOME NO ES PARTE DE ESTE COMPONENTE (§ SPOTLIGHT-BANDA-1,
// DECISIONS.md): `spotlight` todavía no es miembro de `BANDA_IDS` ni está montada en
// `app/(storefront)/page.tsx` — este archivo EXISTE y COMPILA, listo para conectarse el día que
// esa RULING se resuelva, pero hoy no lo alcanza ningún preset.
export default function Spotlight({ style }: { style?: React.CSSProperties } = {}) {
  const { spotlight, tema } = useSiteContent();
  const preview = useIsPreview();
  // ESCALA DE DISPLAY (§ TEMAS-ESCALA-DISPLAY-1, SPOTLIGHT-CIERRE-1) — mismo mecanismo que
  // FeaturedProductsGrilla.tsx: `undefined` sin escala declarada → NO se toca el `style`, el h2
  // sigue rindiendo `text-3xl sm:text-4xl` (byte-idéntico); sólo CORTE ('amplia') lo agranda.
  const displayL = fontSizeDisplay(tema.escalaDisplay, 'l');

  const [catalog, setCatalog] = useState<Product[]>([]);
  useEffect(() => {
    getCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);

  const { addItem } = useCartStore();
  const producto = productoSpotlight(catalog, spotlight.productoSlug);

  // Molienda elegida — por defecto la primera opción DISPONIBLE del producto pineado. Mismo
  // mecanismo que el detalle de producto (§ app/(storefront)/tienda/[slug]/page.tsx): se fija una
  // sola vez, cuando el producto llega.
  const [molienda, setMolienda] = useState<string | null>(null);
  useEffect(() => {
    if (producto && molienda === null) {
      setMolienda(moliendasDisponibles(producto.moliendasOpciones)[0]?.nombre ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [producto]);

  if (!seccionEsVisible(REGISTRY.spotlight, spotlight)) return null;
  if (!producto) return null; // catálogo vacío (§ productoSpotlight — hide-on-empty)

  const otroTamano = productoOtraTalla(catalog, spotlight.otroTamanoSlug);

  const handleAdd = () => {
    // Se comprueba con `moliendaAceptada`, LA MISMA función que decide en el servidor — igual que
    // el detalle de producto: la UI y el checkout no pueden discrepar sobre qué molienda es válida.
    if (!moliendaAceptada(producto.moliendasOpciones, molienda)) {
      toast.error("Selecciona una molienda disponible");
      return;
    }
    addItem(producto, 1, { ...(molienda ? { molienda } : {}) });
    toast.success(`${producto.nombre} agregado al carrito`);
  };

  return (
    <section className="py-20 bg-[var(--sf-banda,var(--sf-fondo))]" style={style}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {(spotlight.eyebrow || spotlight.titulo) && (
          <motion.div
            initial={preview ? false : "hidden"}
            animate={preview ? "visible" : undefined}
            whileInView={preview ? undefined : "visible"}
            viewport={preview ? undefined : { once: true }}
            variants={fadeUp}
            className="mb-12"
          >
            {spotlight.eyebrow && (
              <p className="text-[var(--sf-sobre-banda,var(--sf-acento-texto))] text-xs font-medium tracking-[0.2em] uppercase mb-2">{spotlight.eyebrow}</p>
            )}
            {spotlight.titulo && (
              <h2 className="text-3xl sm:text-4xl font-playfair text-[var(--sf-sobre-banda,var(--sf-tinta))] whitespace-pre-line" style={displayL ? { fontSize: displayL } : undefined}>{spotlight.titulo}</h2>
            )}
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <motion.div
            initial={preview ? false : "hidden"}
            animate={preview ? "visible" : undefined}
            whileInView={preview ? undefined : "visible"}
            viewport={preview ? undefined : { once: true }}
            variants={fadeUp}
            className="relative aspect-square overflow-hidden rounded-3xl bg-[var(--sf-superficie)]"
          >
            {spotlight.badge && (
              <span className="absolute top-4 left-4 z-10 text-xs font-semibold bg-[var(--sf-tostado)] text-[var(--sf-tinta)] px-3 py-1 sf-pildora sf-badge">{spotlight.badge}</span>
            )}
            <Image
              src={imagenPortada(producto.imagen)}
              alt={producto.nombre}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </motion.div>

          <div className="space-y-6">
            <h3 className="text-2xl sm:text-3xl font-playfair text-[var(--sf-tinta)] leading-tight">{producto.nombre}</h3>
            <p className="text-[var(--sf-texto)] leading-relaxed text-sm">{producto.descripcion}</p>

            {(producto.notasCata?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-semibold text-[var(--sf-texto)] uppercase tracking-wide mb-2">Notas de cata</p>
                <div className="flex flex-wrap gap-2">
                  {producto.notasCata!.map((n) => (
                    <span key={n} className="text-sm bg-[var(--sf-superficie)] text-[var(--sf-sobre-superficie,var(--sf-texto))] px-3 py-1 sf-pildora sf-borde border-[var(--sf-linea)]">{n}</span>
                  ))}
                </div>
              </div>
            )}

            {(producto.moliendasOpciones?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-semibold text-[var(--sf-texto)] uppercase tracking-wide mb-2">Presentación</p>
                <div className="flex flex-wrap gap-2">
                  {producto.moliendasOpciones!.map((o) => {
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

            {/* Tamaño como ENLACE a la otra talla (otro producto, otro slug) — NO una variante
                agrupada (§ Backlog #62, que este slice no dispara). Sin `otroTamanoSlug` el
                control simplemente no aparece (preferir callar a un link roto). */}
            {otroTamano && (
              <div>
                <p className="text-xs font-semibold text-[var(--sf-texto)] uppercase tracking-wide mb-2">Tamaño</p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-2 sf-radio-lg sf-borde border-[var(--sf-acento)] bg-[var(--sf-acento)]/5 text-xs font-medium text-[var(--sf-acento-texto)]">
                    {producto.peso_gramos != null ? `${producto.peso_gramos} g` : producto.nombre}
                  </span>
                  <Link
                    href={`/tienda/${otroTamano.slug}`}
                    className="px-3 py-2 sf-radio-lg sf-borde border-[var(--sf-linea)] hover:border-[var(--sf-acento)]/40 text-xs font-medium text-[var(--sf-tinta)] transition-all"
                  >
                    {otroTamano.peso_gramos != null ? `${otroTamano.peso_gramos} g` : otroTamano.nombre}
                  </Link>
                </div>
              </div>
            )}

            <div className="flex items-end gap-3">
              <span className="text-3xl font-bold text-[var(--sf-tinta)]">{formatCOP(producto.precio)}</span>
            </div>

            <button
              onClick={handleAdd}
              className="w-full flex items-center justify-center gap-2 bg-[var(--sf-tinta)] hover:bg-[var(--sf-tinta-2)] text-[var(--sf-sobre)] font-semibold py-4 rounded-2xl transition-all hover:-translate-y-0.5 text-sm"
            >
              <ShoppingBag className="w-4 h-4" /> Agregar al carrito
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
