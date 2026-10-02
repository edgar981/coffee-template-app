"use client";

import { useEffect, useState } from "react";
import { getCatalog } from "@/lib/api/products";
import type { Product } from "@/types/product";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import ProductCard from "../ProductCard";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { fontSizeDisplay } from "@/lib/config/escala-display";
import { contenedorAnchoClase } from "@/lib/config/themes";
import RevelarBloque from "@/components/storefront/RevelarBloque";

// LA VARIANTE CANÓNICA (§ TEMAS-FEATURED-GRILLA-1): la fila de 4 de SIEMPRE, extraída VERBATIM al
// separar el mecanismo de variantes del dispatcher (`FeaturedProducts.tsx`) — mismo movimiento que
// `GrindChooserMosaico`/`HeroCurtina` en su momento. El gate de visibilidad no aplica acá: `featured`
// es `ocultable:false` por posición (§ `content.orden`), no una `SeccionKey` con `visible`.
//
// LA ENTRADA (§ SECCIONES-ENTRAN-VIVAS-1): antetítulo/título/"Ver todo" y cada tarjeta entran por su
// cuenta con `RevelarBloque` (§ su docstring), en vez de un único bloque sin curva/duración
// declaradas. SIN gate `preview`: esta variante (`featured·cuadricula`) no es una `SeccionVista` del
// editor (`VistaTiendaEnVivo.tsx` sólo mapea `'featured'`→`Spotlight`, § su `COMPONENTES`) — nunca se
// monta dentro del contenedor escalado, así que no hace falta el switch que sí necesitan
// `TrustBadges`/los dispatchers con variante.

export default function FeaturedProductsCuadricula({ style }: { style?: React.CSSProperties } = {}) {
  // Fuente única: catálogo público desde la DB (petición compartida/memoizada).
  const [catalog, setCatalog] = useState<Product[]>([]);
  useEffect(() => {
    getCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);

  const featured = catalog.slice(0, 4);
  // ESCALA DE DISPLAY (§ TEMAS-ESCALA-DISPLAY-1): `undefined` sin escala declarada → NO se toca el
  // `style` del h2, que sigue rindiendo exactamente `text-3xl sm:text-4xl` (1.875rem/2.25rem,
  // medido) — byte-idéntico.
  const { tema, navTratamiento } = useSiteContent();
  const displayL = fontSizeDisplay(tema.escalaDisplay, 'l');
  // EL CONTENEDOR (§ PARIDAD-ANCHO-CONTENIDO-1) — ver el docstring de `contenedorAnchoClase`
  // (`lib/config/themes.ts`) para el porqué de reusar `navTratamiento.posicion` acá. `false`
  // (todo tenant salvo CORTE) = el literal de HOY, byte a byte.
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);

  return (
    <section className="py-20 bg-[var(--sf-banda,var(--sf-fondo))]" style={style}>
        <div className={`${contenedorClase} mx-auto`}>
          {/* Eyebrow/título/link SOBRE EL FONDO de la banda: `--sf-sobre-banda` con el literal de hoy
              como fallback (§ eje 5b, home-2). Las ProductCard de la grilla NO se tocan: su texto va
              sobre `--sf-tarjeta`, no sobre la banda. */}
          <div className="flex items-end justify-between mb-12">
            <div>
              <RevelarBloque as="p" indice={0} className="text-[var(--sf-sobre-banda,var(--sf-acento-texto))] text-xs font-medium tracking-[0.2em] uppercase mb-2">Nuestro Catálogo</RevelarBloque>
              <RevelarBloque as="h2" indice={1} className="text-3xl sm:text-4xl font-playfair text-[var(--sf-sobre-banda,var(--sf-tinta))]" style={displayL ? { fontSize: displayL } : undefined}>Selección del mes</RevelarBloque>
            </div>
            <RevelarBloque indice={2} className="hidden sm:block">
              <Link href="/tienda" className="flex items-center gap-1 text-sm font-medium text-[var(--sf-sobre-banda,var(--sf-acento-texto))] hover:text-[var(--sf-acento-3)] transition-colors">
                Ver todo <ArrowRight className="w-4 h-4" />
              </Link>
            </RevelarBloque>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featured.map((p, i) => (
              <RevelarBloque key={p.id} indice={i}>
                <ProductCard product={p} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" />
              </RevelarBloque>
            ))}
          </div>
          <div className="mt-8 text-center sm:hidden">
            <Link href="/tienda" className="inline-flex items-center gap-1 text-sm font-medium text-[var(--sf-sobre-banda,var(--sf-acento-texto))]">Ver todos los productos <ArrowRight className="w-4 h-4" /></Link>
          </div>
        </div>
      </section>
  )
}
