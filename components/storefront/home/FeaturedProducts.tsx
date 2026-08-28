"use client";

import { useEffect, useState } from "react";
import { getCatalog } from "@/lib/api/products";
import type { Product } from "@/types/product";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import ProductCard from "../ProductCard";

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } };

export default function FeaturedProducts() {
  // Fuente única: catálogo público desde la DB (petición compartida/memoizada).
  const [catalog, setCatalog] = useState<Product[]>([]);
  useEffect(() => {
    getCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);

  const featured = catalog.slice(0, 4);

  return (
    <section className="py-20 bg-[var(--sf-fondo)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="flex items-end justify-between mb-12">
            <div>
              <p className="text-[var(--sf-acento-texto)] text-xs font-medium tracking-[0.2em] uppercase mb-2">Nuestro Catálogo</p>
              <h2 className="text-3xl sm:text-4xl font-playfair text-[var(--sf-tinta)]">Selección del mes</h2>
            </div>
            <Link href="/tienda" className="hidden sm:flex items-center gap-1 text-sm font-medium text-[var(--sf-acento-texto)] hover:text-[var(--sf-acento-3)] transition-colors">
              Ver todo <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featured.map((p, i) => (
              <motion.div key={p.id} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ delay: i * 0.08 }}>
                <ProductCard product={p} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" />
              </motion.div>
            ))}
          </div>
          <div className="mt-8 text-center sm:hidden">
            <Link href="/tienda" className="inline-flex items-center gap-1 text-sm font-medium text-[var(--sf-acento-texto)]">Ver todos los productos <ArrowRight className="w-4 h-4" /></Link>
          </div>
        </div>
      </section>
  )
}


