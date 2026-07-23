"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { fadeUp } from "@/lib/animation";


export default function BrandStory() {
  return (
    <section id="nuestra-historia" className="py-24 bg-[#1a0f08]">
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
              Café Nayoli nace en un solo lugar: la Finca Nayoli, en la vereda Providencia de Supatá, Cundinamarca.
              Cada grano viene de esta tierra, cultivado entre los 1.650 y 2.100 metros sobre el nivel del mar, 
              donde la altura y el clima de la montaña colombiana dan al café su carácter.
            </p>
            <p className="text-white/60 leading-relaxed mb-8 text-base">
              Trabajamos una sola variedad, Castillo, con proceso lavado — el método que mejor revela lo que esta tierra tiene para ofrecer. 
              El resultado es una taza con fragancia a chocolate, aroma herbal e intenso, y un balance preciso entre acidez y cuerpo. 
              El equilibrio que buscamos en cada tostión. Somos café de especialidad, 100% colombiano, de una finca con nombre y una historia que apenas comienza a contarse. 
              Cuando abres una bolsa de Nayoli, sabes exactamente de dónde viene — y ese, para nosotros, es el verdadero secreto de Supatá.
            </p>
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
                src="/images/products-9.jpg"
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
                src="/images/products-10.jpg"
                alt="Finca"
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                className="object-cover"
              />
            </div>
            <div className="relative h-48 overflow-hidden rounded-2xl mt-4">
              <Image
                src="/images/products-11.jpg"
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
