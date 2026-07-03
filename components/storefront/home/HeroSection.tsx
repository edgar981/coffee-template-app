"use client";

import Link from "next/link";
import Image from "next/image";

import { ArrowRight } from "lucide-react";

import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },

  visible: { opacity: 1, y: 0 },
};

export default function HeroSection() {
  return (
    <section className="relative flex min-h-[92vh] items-center overflow-hidden bg-[#1a0f08]">
      <div className="absolute inset-0">
        <Image
          src="/images/hero-image.jpeg"
          alt="Café Nayoli"
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-40"
        />

        <div className="absolute inset-0 bg-linear-to-b from-[#1a0f08]/60 via-transparent to-[#1a0f08]/80" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            visible: {
              transition: {
                staggerChildren: 0.15,
              },
            },
          }}
          className="max-w-2xl"
        >
          <motion.p
            variants={fadeUp}
            className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-[#d4a97a]"
          >
            Café de Especialidad · Colombia
          </motion.p>

          <motion.h1
            variants={fadeUp}
            className="mb-6 font-playfair text-5xl leading-[1.08] text-white sm:text-6xl lg:text-7xl"
          >
            Café que cuenta
            <br />
            <em className="italic text-[#d4a97a]">
              historias
            </em>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mb-10 max-w-md text-lg leading-relaxed text-white/70"
          >
            Microlotes de origen colombiano.
            Tostado artesanal. Entregado en
            tu puerta con la cadena de
            trazabilidad completa.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="flex flex-wrap gap-4"
          >
            <Link
              href="/tienda"
              className="inline-flex items-center gap-2 rounded-full bg-[#d4a97a] px-8 py-4 text-sm font-semibold text-[#1a0f08] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#c49060]"
            >
              Explorar Café

              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/suscripciones"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 px-8 py-4 text-sm font-medium text-white transition-all duration-200 hover:border-white/60 hover:bg-white/10"
            >
              Suscripción Mensual
            </Link>
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll indicator */} 
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/40"> 
        
      </div>
      <motion.div 
        animate={{ y: [0, 8, 0], }}
        transition={{ duration: 2, repeat: Infinity,
        }}
        className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-white/40"
    >
        <span className="text-xs tracking-widest uppercase">Scroll</span> 
        <div className="w-px h-12 bg-linear-to-b from-white/40 to-transparent" /> 
      </motion.div>
    </section>
  );
}