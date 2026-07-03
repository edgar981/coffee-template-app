"use client";

import { DEMO_PRODUCTS } from "@/lib/mock/products";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import ProductCard from "../ProductCard";

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } };

export default function FeaturedProducts() {
  const featured = DEMO_PRODUCTS.slice(0, 4);

  return (
    <section className="py-20 bg-[#faf7f4]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="flex items-end justify-between mb-12">
            <div>
              <p className="text-[#8B4513] text-xs font-medium tracking-[0.2em] uppercase mb-2">Nuestro Catálogo</p>
              <h2 className="text-3xl sm:text-4xl font-playfair text-[#1a0f08]">Selección del mes</h2>
            </div>
            <Link href="/tienda" className="hidden sm:flex items-center gap-1 text-sm font-medium text-[#8B4513] hover:text-[#5a2d0c] transition-colors">
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
            <Link href="/tienda" className="inline-flex items-center gap-1 text-sm font-medium text-[#8B4513]">Ver todos los productos <ArrowRight className="w-4 h-4" /></Link>
          </div>
        </div>
      </section>
  )
}


