"use client";
import { useState } from 'react';
import { CheckCircle, ArrowRight, Coffee, Pause, RotateCcw, Star, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatCOP } from '@/lib/utils';
import { useCartStore } from '@/lib/cartStore';
import { toast } from 'sonner';
import { SUBSCRIPTION_PLANS } from '@/lib/mock/subscriptions';
import { SUBSCRIPTION_FAQ } from '@/constants/subscription-faq';
import { SUBSCRIPTION_STEPS } from '@/constants/subscription-steps';
import PreguntasFrecuentes from '@/components/storefront/PreguntasFrecuentes';

export default function Subscription() {
  const [selected, setSelected] = useState<string>('s2');
  const { addItem } = useCartStore();

  const plan = SUBSCRIPTION_PLANS.find(p => p.id === selected);
  if (!plan) return null;

  const handleSubscribe = () => {
    addItem({
    id: `subscription-${plan.id}`,
    nombre: `Suscripción ${plan.nombre} — Mensual`,
    slug: `suscripcion-${plan.id}`,
    categoria: "suscripcion",
    precio: plan.precio,
    costo: 0,
    sku: `SUB-${plan.id.toUpperCase()}`,
    stock: 999,
    activo: true,
    descripcion:
      plan.descripcion,
    imagen:
      "/images/subscription-1.jpeg",
    imagenes: [
      "/images/subscription-1.jpeg",
    ],
    esSuscripcion: true,
  },
  1,
  {
    suscripcion: "true",
    plan: plan.nombre,
  });
    toast.success(`Suscripción ${plan.nombre} agregada al carrito`);
  };

  return (
      <div className="pt-16">
        {/* Hero */}
        <section className="bg-[#1a0f08] py-20 text-center px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-[#d4a97a] text-xs tracking-widest uppercase mb-4">Suscripción de Café</p>
            <h1 className="text-5xl sm:text-6xl font-playfair text-white mb-4">
              Tu café favorito,<br /><em className="text-[#d4a97a] italic">cada mes</em>
            </h1>
            <p className="text-white/60 text-lg max-w-xl mx-auto">Selecciona tu plan, personaliza tu café y recíbelo directamente en casa. Sin complicaciones.</p>
          </motion.div>
        </section>

        {/* Plans */}
        <section className="py-20 bg-[#faf7f4]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-playfair text-[#1a0f08] mb-2">Elige tu plan</h2>
              <p className="text-[#5a3a28] text-sm">Todos los planes incluyen envío gratis y puedes cancelar cuando quieras.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              {SUBSCRIPTION_PLANS.map(plan => (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  onClick={() => setSelected(plan.id)}
                  className={`relative cursor-pointer rounded-2xl p-6 border-2 transition-all ${selected === plan.id ? 'border-[#8B4513] shadow-lg shadow-[#8B4513]/10' : 'border-[#e8ddd0] hover:border-[#c0a080]'} bg-white`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#8B4513] text-white text-xs font-bold px-4 py-1 rounded-full">
                      Más Popular
                    </div>
                  )}
                  <div className="w-10 h-10 rounded-xl mb-4 flex items-center justify-center" style={{ background: plan.theme + '20' }}>
                    <Coffee className="w-5 h-5" style={{ color: plan.theme }} />
                  </div>
                  <h3 className="text-xl font-playfair text-[#1a0f08] mb-1">{plan.nombre}</h3>
                  <p className="text-sm text-[#8B6650] mb-4">{plan.descripcion}</p>
                  <p className="text-3xl font-bold text-[#1a0f08] mb-4">{formatCOP(plan.precio)}<span className="text-sm font-normal text-[#8B6650]">/mes</span></p>
                  <div className="space-y-2">
                    {plan.beneficios.map(b => (
                      <div key={b} className="flex items-center gap-2 text-sm text-[#3d2314]">
                        <CheckCircle className="w-4 h-4 text-[#8B4513] shrink-0" /> {b}
                      </div>
                    ))}
                  </div>
                  {selected === plan.id && (
                    <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-[#8B4513]">
                      <CheckCircle className="w-4 h-4 fill-[#8B4513] text-white" /> Plan seleccionado
                    </div>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Subscribe CTA */}
            <div className="bg-[#1a0f08] rounded-3xl p-8 text-center">
              <p className="text-[#d4a97a] text-xs tracking-wide uppercase mb-3">Plan Seleccionado</p>
              <h3 className="text-2xl font-playfair text-white mb-1">Suscripción {plan.nombre}</h3>
              <p className="text-white/50 text-sm mb-6">{plan.descripcion}</p>
              <p className="text-4xl font-bold text-white mb-6">{formatCOP(plan.precio)}<span className="text-base font-normal text-white/50">/mes</span></p>
              <button onClick={handleSubscribe} className="inline-flex items-center gap-2 bg-[#d4a97a] hover:bg-[#c49060] text-[#1a0f08] font-bold px-10 py-4 rounded-full text-sm transition-all hover:-translate-y-0.5 cursor-pointer">
                Suscribirme ahora <ArrowRight className="w-4 h-4" />
              </button>
              <p className="text-white/40 text-xs mt-4">Pausa o cancela cuando quieras. Sin compromisos.</p>
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