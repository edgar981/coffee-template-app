"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { SUBSCRIPTION_PLANS } from "@/lib/mock/subscriptions";

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } };

export default function SubscriptionCTA() {
  return (
    <section className="py-20 bg-[#2d1a0e]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
              <p className="text-[#d4a97a] text-xs tracking-[0.2em] uppercase mb-3">Plan Suscripción</p>
              <h2 className="text-4xl font-playfair text-white mb-4">Tu café de Supatá, cada mes</h2>
              <p className="text-white/60 mb-8 leading-relaxed">El mismo café de nuestra finca, tostado fresco y enviado a tu puerta. Pausa o cancela cuando quieras.</p>
              <div className="space-y-3 mb-8">
                {['El mismo café de nuestra finca en Supatá', 'Grano o molido, como prefieras', 'Tostado fresco en tandas semanales', 'Pausa o cancela cuando quieras'].map(b => (
                  <div key={b} className="flex items-center gap-3 text-sm text-white/70">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#d4a97a]" />
                    {b}
                  </div>
                ))}
              </div>
              <Link href="/suscripciones" className="inline-flex items-center gap-2 bg-[#d4a97a] hover:bg-[#c49060] text-[#1a0f08] font-semibold px-8 py-4 rounded-full text-sm transition-all hover:-translate-y-0.5">
                Ver los planes <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {SUBSCRIPTION_PLANS.map((p, i) => (
                <div key={p.id} className={`rounded-2xl p-5 text-white ${i === 1 ? 'bg-[#8B4513]' : 'bg-[#3d2314]'}`}>
                  <p className="text-[#d4a97a] text-xs font-medium mb-2">{p.nombre}</p>
                  <p className="text-white/70 text-xs leading-snug">{p.descripcion}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>
  )
}
