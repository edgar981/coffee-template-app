"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { fadeUp } from "@/lib/animation";


export default function BrandStory() {
  return (
    <section className="py-24 bg-[#1a0f08]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <p className="text-[#d4a97a] text-xs font-medium tracking-[0.2em] uppercase mb-4">
              Nuestra Historia
            </p>
            <h2 className="text-4xl sm:text-5xl font-playfair text-white leading-tight mb-6">
              Del cafetal
              <br />a tu taza
            </h2>
            <p className="text-white/60 leading-relaxed mb-6 text-base">
              Sierra Nativa nació de una idea simple: llevar el café excepcional
              del Huila y Nariño directamente a quienes lo aprecian. Sin
              intermediarios innecesarios, con trazabilidad completa y respeto
              por el productor.
            </p>
            <p className="text-white/60 leading-relaxed mb-8 text-base">
              Cada bolsa que recibís lleva consigo la historia de una finca
              específica, el nombre de la familia cultivadora y las notas de
              cata de nuestro equipo.
            </p>
            <Link
              href="/tienda/nosotros"
              className="inline-flex items-center gap-2 text-[#d4a97a] text-sm font-medium hover:gap-3 transition-all"
            >
              Conoce nuestra historia <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="grid grid-cols-2 gap-4"
          >
            <div className="relative h-48 overflow-hidden rounded-2xl">
              <Image
                src="/images/products-6.jpeg"
                alt="Café"
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                className="object-cover"
              />
            </div>
            <div className="relative h-48 overflow-hidden rounded-2xl mt-8">
              <Image
                src="/images/products-7.jpeg"
                alt="Tostado"
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                className="object-cover"
              />
            </div>
            <div className="relative h-48 overflow-hidden rounded-2xl -mt-4">
              <Image
                src="/images/products-8.jpeg"
                alt="Finca"
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                className="object-cover"
              />
            </div>
            <div className="relative h-48 overflow-hidden rounded-2xl mt-4">
              <Image
                src="/images/products-8.jpeg"
                alt="Barista"
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                className="object-cover"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
