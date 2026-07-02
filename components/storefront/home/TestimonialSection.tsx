"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { fadeUp } from "@/lib/animation";

export default function TestimonialSection() {
  return (
    <section className="py-20 bg-[#faf7f4]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-12">
            <p className="text-[#8B4513] text-xs font-medium tracking-[0.2em] uppercase mb-2">Testimonios</p>
            <h2 className="text-3xl font-playfair text-[#1a0f08]">Lo que dicen nuestros clientes</h2>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: 'Valentina Torres', city: 'Bogotá', stars: 5, text: 'El Nariño Premium cambió mi ritual de mañana. Notas de frutas rojas increíbles. El packaging es bellísimo.', product: 'Café Nariño Premium' },
              { name: 'Carlos Eduardo Mora', city: 'Bogotá', stars: 5, text: 'Tengo la suscripción premium hace 8 meses y cada mes me sorprenden. El soporte por WhatsApp es excelente.', product: 'Suscripción Premium' },
              { name: 'Laura Jiménez', city: 'Manizales', stars: 5, text: 'El Cold Brew es adictivo. Llegó perfectamente empacado al día siguiente. Definitivamente el mejor café online.', product: 'Cold Brew Concentrado' },
            ].map((t, i) => (
              <motion.div key={t.name} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ delay: i * 0.1 }} className="bg-white rounded-2xl p-6 shadow-sm border border-[#e8ddd0]">
                <div className="flex gap-1 mb-4">{Array(t.stars).fill(0).map((_, j) => <Star key={j} className="w-4 h-4 fill-[#d4a97a] text-[#d4a97a]" />)}</div>
                <p className="text-[#3d2314] text-sm leading-relaxed mb-4">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#e8ddd0] flex items-center justify-center">
                    <span className="text-xs font-semibold text-[#8B4513]">{t.name[0]}</span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#1a0f08]">{t.name}</p>
                    <p className="text-xs text-[#8B4513]">{t.city} · {t.product}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
  )
}
