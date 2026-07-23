"use client";
import { CheckCircle, ArrowRight, Coffee } from 'lucide-react';
import { motion } from 'framer-motion';
import { SUBSCRIPTION_PLANS } from '@/lib/mock/subscriptions';
import { SUBSCRIPTION_STEPS } from '@/constants/subscription-steps';
import { whatsappHref } from '@/lib/whatsapp-link';
import PreguntasFrecuentes from '@/components/storefront/PreguntasFrecuentes';

// Propuesta de suscripción (no transaccional): planes visibles, pero el CTA
// "Me interesa" abre WhatsApp con mensaje precargado — no crea pedidos.
const interesHref = (plan: string) =>
  whatsappHref(`Hola, me interesa el plan de suscripción de ${plan}`);

export default function Subscription() {
  return (
      <div className="pt-16">
        {/* Hero */}
        <section className="bg-[#1a0f08] py-20 text-center px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-[#d4a97a] text-xs tracking-widest uppercase mb-4">Suscripción de Café</p>
            <h1 className="text-5xl sm:text-6xl font-playfair text-white mb-4">
              Tu café de Supatá,<br /><em className="text-[#d4a97a] italic">cada mes</em>
            </h1>
            <p className="text-white/60 text-lg max-w-xl mx-auto">El mismo café de nuestra finca, tostado fresco y enviado a tu puerta. Pausa o cancela cuando quieras.</p>
          </motion.div>
        </section>

        {/* Plans */}
        <section className="py-20 bg-[#faf7f4]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-playfair text-[#1a0f08] mb-2">Elige tu plan</h2>
              <p className="text-[#5a3a28] text-sm max-w-lg mx-auto">Escríbenos y coordinamos tu suscripción por WhatsApp. Sin compromisos, pausa o cancela cuando quieras.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {SUBSCRIPTION_PLANS.map(plan => (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className={`relative flex flex-col rounded-2xl p-6 border-2 bg-white ${plan.popular ? 'border-[#8B4513] shadow-lg shadow-[#8B4513]/10' : 'border-[#e8ddd0]'}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#8B4513] text-white text-xs font-bold px-4 py-1 rounded-full">
                      Más Popular
                    </div>
                  )}
                  <div className="w-10 h-10 rounded-xl mb-4 flex items-center justify-center bg-[#8B4513]/10">
                    <Coffee className="w-5 h-5 text-[#8B4513]" />
                  </div>
                  <h3 className="text-xl font-playfair text-[#1a0f08] mb-1">{plan.nombre}</h3>
                  <p className="text-sm text-[#8B6650] mb-4">{plan.descripcion}</p>
                  <div className="space-y-2 mb-6">
                    {plan.beneficios.map(b => (
                      <div key={b} className="flex items-center gap-2 text-sm text-[#3d2314]">
                        <CheckCircle className="w-4 h-4 text-[#8B4513] shrink-0" /> {b}
                      </div>
                    ))}
                  </div>
                  <a
                    href={interesHref(plan.nombre)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`mt-auto inline-flex items-center justify-center gap-2 font-semibold px-6 py-3 rounded-full text-sm transition-all hover:-translate-y-0.5 ${plan.popular ? 'bg-[#8B4513] hover:bg-[#5a2d0c] text-white' : 'border-2 border-[#8B4513] text-[#8B4513] hover:bg-[#8B4513] hover:text-white'}`}
                  >
                    Me interesa <ArrowRight className="w-4 h-4" />
                  </a>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-16 bg-[#f0e8de]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-playfair text-[#1a0f08] text-center mb-10">¿Cómo funciona?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
              {SUBSCRIPTION_STEPS.map(step => (
                <div key={step.id} className="text-center">
                  <div className="w-12 h-12 bg-[#8B4513] rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <step.icon className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-[#d4a97a] text-xs font-bold mb-1">{step.id}</p>
                  <p className="font-semibold text-[#1a0f08] mb-1 text-sm">{step.label}</p>
                  <p className="text-xs text-[#5a3a28]">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <main className="bg-[#faf7f4]">
          <PreguntasFrecuentes />
        </main>
      </div>
  );
}
