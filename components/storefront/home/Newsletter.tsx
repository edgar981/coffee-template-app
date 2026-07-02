"use client";

import { motion } from "framer-motion";
import { Coffee } from "lucide-react";
import { fadeUp } from "@/lib/animation";

export default function Newsletter() {
  return (
    <section className="py-16 bg-[#f0e8de]">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <Coffee className="w-8 h-8 text-[#8B4513] mx-auto mb-4" />
            <h2 className="text-2xl sm:text-3xl font-playfair text-[#1a0f08] mb-3">Únete a la comunidad</h2>
            <p className="text-sm text-[#5a3a28] mb-6">Recibe novedades, recetas y descuentos exclusivos. Solo café, sin spam.</p>
            <form className="flex gap-3 max-w-sm mx-auto" onSubmit={e => e.preventDefault()}>
              <input type="email" placeholder="tu@correo.com" className="flex-1 px-4 py-3 rounded-full bg-white border border-[#d4b896] text-sm focus:outline-none focus:ring-2 focus:ring-[#8B4513]/30" />
              <button type="submit" className="bg-[#8B4513] hover:bg-[#5a2d0c] text-white font-medium px-6 py-3 rounded-full text-sm transition-colors shrink-0">Suscribir</button>
            </form>
          </motion.div>
        </div>
      </section>
  )
}
