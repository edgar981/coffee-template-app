"use client";

import { useEffect, useState } from "react";
import { getCatalog } from "@/lib/api/products";
import type { Product } from "@/types/product";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import ProductCard from "../ProductCard";

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } };

// LA VARIANTE "grilla" (§ TEMAS-FEATURED-GRILLA-1, pedida por CORTE/PATIO/VITRINA — `lib/config/
// themes.ts`): la MALLA de 6, distinta de la fila de 4 de `FeaturedProductsCuadricula` — más celdas,
// más chicas. Misma tarjeta (`ProductCard`), misma fuente de datos (`getCatalog`); lo único que
// cambia es la CANTIDAD (6, no 4) y la RETÍCULA. El ritmo de columnas (2 → 3 → 4) NO se inventa: es
// el MISMO que ya usa el catálogo completo de `/tienda` para esta misma tarjeta
// (`app/(storefront)/tienda/page.tsx`, grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 + su `sizes`) — la
// retícula que el repositorio ya usa para una grilla de ProductCard con más de 4 ítems.
export default function FeaturedProductsGrilla({ style }: { style?: React.CSSProperties } = {}) {
  // Fuente única: catálogo público desde la DB (petición compartida/memoizada).
  const [catalog, setCatalog] = useState<Product[]>([]);
  useEffect(() => {
    getCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);

  // Sin huecos si el catálogo tiene menos de 6: un tema no puede exigir inventario, así que la
  // malla simplemente muestra las que hay (`.slice` sobre un array corto devuelve lo que existe; el
  // grid CSS no deja celdas vacías por un `.map` más corto).
  const featured = catalog.slice(0, 6);

  return (
    <section className="py-20 bg-[var(--sf-banda,var(--sf-fondo))]" style={style}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Eyebrow/título/link SOBRE EL FONDO de la banda: `--sf-sobre-banda` con el literal de hoy
              como fallback (§ eje 5b, home-2). Las ProductCard de la grilla NO se tocan: su texto va
              sobre `--sf-tarjeta`, no sobre la banda. */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="flex items-end justify-between mb-12">
            <div>
              <p className="text-[var(--sf-sobre-banda,var(--sf-acento-texto))] text-xs font-medium tracking-[0.2em] uppercase mb-2">Nuestro Catálogo</p>
              <h2 className="text-3xl sm:text-4xl font-playfair text-[var(--sf-sobre-banda,var(--sf-tinta))]">Selección del mes</h2>
            </div>
            <Link href="/tienda" className="hidden sm:flex items-center gap-1 text-sm font-medium text-[var(--sf-sobre-banda,var(--sf-acento-texto))] hover:text-[var(--sf-acento-3)] transition-colors">
              Ver todo <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {featured.map((p, i) => (
              <motion.div key={p.id} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ delay: i * 0.06 }}>
                <ProductCard product={p} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" />
              </motion.div>
            ))}
          </div>
          <div className="mt-8 text-center sm:hidden">
            <Link href="/tienda" className="inline-flex items-center gap-1 text-sm font-medium text-[var(--sf-sobre-banda,var(--sf-acento-texto))]">Ver todos los productos <ArrowRight className="w-4 h-4" /></Link>
          </div>
        </div>
      </section>
  )
}
