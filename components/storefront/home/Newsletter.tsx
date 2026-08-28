"use client";

import { motion } from "framer-motion";
import { Coffee } from "lucide-react";
import { fadeUp } from "@/lib/animation";

export default function Newsletter() {
  return (
    <section className="py-16 bg-[var(--sf-superficie)]">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <Coffee className="w-8 h-8 text-[var(--sf-acento-texto)] mx-auto mb-4" />
            <h2 className="text-2xl sm:text-3xl font-playfair text-[var(--sf-tinta)] mb-3">Únete a la comunidad</h2>
            <p className="text-sm text-[var(--sf-texto)] mb-6">Recibe novedades, recetas y descuentos exclusivos. Solo café, sin spam.</p>
            <form className="flex gap-3 max-w-sm mx-auto" onSubmit={e => e.preventDefault()}>
              <input type="email" placeholder="tu@correo.com" className="flex-1 px-4 py-3 rounded-full bg-white border border-[var(--sf-tostado-8)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--sf-acento)]/30" />
              <button type="submit" className="bg-[var(--sf-acento)] hover:bg-[var(--sf-acento-3)] text-[var(--sf-acento-txt)] font-medium px-6 py-3 rounded-full text-sm transition-colors shrink-0">Suscribir</button>
            </form>
          </motion.div>
        </div>
      </section>
  )
}
