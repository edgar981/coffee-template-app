"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { fadeUp } from "@/lib/animation";

export default function CategoriesSection() {
  return (
    <section className="py-20 bg-[#faf7f4]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-12">
            <p className="text-[#8B4513] text-xs font-medium tracking-[0.2em] uppercase mb-2">Categorías</p>
            <h2 className="text-3xl sm:text-4xl font-playfair text-[#1a0f08]">Encuentra tu café</h2>
          </motion.div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Café en Bolsa', img: '/images/products-1.jpeg', path: '/tienda?cat=cafe_bolsa' },
              { label: 'Café en Grano', img: '/images/products-2.jpeg', path: '/tienda?cat=cafe_grano' },
              { label: 'Café Molido', img: '/images/products-3.jpeg', path: '/tienda?cat=cafe_molido' },
              { label: 'Cold Brew', img: '/images/products-4.jpeg', path: '/tienda?cat=cold_brew' },
              { label: 'Cajas Regalo', img: '/images/products-5.jpeg', path: '/tienda?cat=caja_regalo' },
              { label: 'Suscripciones', img: '/images/subscription-1.jpeg', path: '/suscripciones' },
            ].map((cat, i) => (
              <motion.div key={cat.label} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ delay: i * 0.06 }}>
                <Link href={cat.path} className="group flex flex-col items-center gap-3 text-center">
                  <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-[#e8ddd0]">
                    <Image src={cat.img} alt={cat.label} sizes="(max-width: 768px) 50vw, 16vw" className="object-cover group-hover:scale-105 transition-transform duration-500" fill/>
                  </div>
                  <span className="text-sm font-medium text-[#3d2314] group-hover:text-[#8B4513] transition-colors">{cat.label}</span>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
  )
}
