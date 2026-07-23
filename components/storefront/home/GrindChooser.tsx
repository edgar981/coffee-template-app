"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { fadeUp } from "@/lib/animation";

const OPCIONES = [
  {
    label: "En grano",
    copy: "Para moler en casa, máxima frescura.",
    img: "/images/cafe-nayoli-250g-grano.webp",
    path: "/tienda?cat=cafe_grano",
  },
  {
    label: "Molido",
    copy: "Listo para tu greca, filtro o prensa.",
    img: "/images/cafe-nayoli-250g-molido.webp",
    path: "/tienda?cat=cafe_molido",
  },
];

export default function GrindChooser() {
  return (
    <section className="py-20 bg-[#faf7f4]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-12">
          <p className="text-[#8B4513] text-xs font-medium tracking-[0.2em] uppercase mb-2">Elige tu presentación</p>
          <h2 className="text-3xl sm:text-4xl font-playfair text-[#1a0f08]">¿Cómo tomas tu café?</h2>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {OPCIONES.map((op, i) => (
            <motion.div key={op.label} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ delay: i * 0.08 }}>
              <Link href={op.path} className="group relative flex flex-col justify-end overflow-hidden rounded-3xl aspect-[4/5] sm:aspect-[3/2] bg-[#e8ddd0]">
                <Image
                  src={op.img}
                  alt={`Café Nayoli ${op.label}`}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1a0f08]/80 via-[#1a0f08]/20 to-transparent" />
                <div className="relative p-8">
                  <h3 className="text-2xl sm:text-3xl font-playfair text-white mb-1">{op.label}</h3>
                  <p className="text-white/80 text-sm mb-4 max-w-xs">{op.copy}</p>
                  <span className="inline-flex items-center gap-2 text-[#d4a97a] font-semibold text-sm group-hover:gap-3 transition-all">
                    Ver café {op.label.toLowerCase()} <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
