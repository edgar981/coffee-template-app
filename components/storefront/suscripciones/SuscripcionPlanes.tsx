"use client";

import { CheckCircle, ArrowRight, Coffee } from 'lucide-react';
import { motion } from 'framer-motion';
import { whatsappUrl } from '@/lib/config/site';
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { useIsPreview } from '@/components/storefront/PreviewMode';
import { planesDeSuscripcion, gridColsPlanes } from '@/lib/storefront/planes-suscripcion';

// El ENCABEZADO + los PLANES de /suscripciones, desde SiteContent (§ Backlog #49). Antes eran literales
// + `SUBSCRIPTION_PLANS`; ahora la sección `suscripcionPlanes`, editable. Los DOS surfaces (esta página
// y el teaser de la home) leen `planesDeSuscripcion` → no divergen.
//
// EL `whatsapp` LLEGA POR PROP, no por `useSiteSettings()` — este componente se monta también en la
// VISTA PREVIA del panel (VistaTiendaEnVivo), que NO tiene el SiteSettingsProvider del storefront (el
// hook LANZARÍA, § el {negocio} de GrindChooser/NosotrosGaleria). La página /suscripciones pasa el
// número; en el preview va sin prop → el CTA se oculta (un `wa.me/` sin número es un botón muerto).
export default function SuscripcionPlanes({ whatsapp }: { whatsapp?: string }) {
  const { suscripcionPlanes } = useSiteContent();
  const preview = useIsPreview();
  const c = suscripcionPlanes;
  const planes = planesDeSuscripcion(c);
  const interesHref = (nombre: string) =>
    whatsappUrl(whatsapp ?? '', `Hola, me interesa el plan de suscripción de ${nombre}`);

  return (
    <>
      {/* Hero */}
      <section className="bg-[var(--sf-tinta)] py-20 text-center px-4">
        <motion.div initial={preview ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {c.eyebrow && <p className="text-[var(--sf-tostado)] text-xs tracking-widest uppercase mb-4">{c.eyebrow}</p>}
          <h1 className="text-5xl sm:text-6xl font-playfair text-white mb-4">
            {c.titulo}{c.tituloEnfasis && (<><br /><em className="text-[var(--sf-tostado)] italic">{c.tituloEnfasis}</em></>)}
          </h1>
          <p className="text-white/60 text-lg max-w-xl mx-auto">{c.subtitulo}</p>
        </motion.div>
      </section>

      {/* Plans */}
      <section className="py-20 bg-[var(--sf-fondo)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-playfair text-[var(--sf-tinta)] mb-2">{c.planesTitulo}</h2>
            {c.planesSubtitulo && <p className="text-[var(--sf-texto)] text-sm max-w-lg mx-auto">{c.planesSubtitulo}</p>}
          </div>

          <div className={`grid grid-cols-1 ${gridColsPlanes(planes.length)} gap-6`}>
            {planes.map(plan => (
              <motion.div
                key={plan.slot}
                initial={preview ? false : { opacity: 0, y: 20 }}
                whileInView={preview ? undefined : { opacity: 1, y: 0 }}
                animate={preview ? { opacity: 1, y: 0 } : undefined}
                viewport={preview ? undefined : { once: true }}
                className={`relative flex flex-col rounded-2xl p-6 border-2 bg-white ${plan.destacado ? 'border-[var(--sf-acento)] shadow-lg shadow-[var(--sf-acento)]/10' : 'border-[var(--sf-linea)]'}`}
              >
                {plan.destacado && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--sf-acento)] text-[var(--sf-acento-txt)] text-xs font-bold px-4 py-1 rounded-full">
                    Más Popular
                  </div>
                )}
                <div className="w-10 h-10 rounded-xl mb-4 flex items-center justify-center bg-[var(--sf-acento)]/10">
                  <Coffee className="w-5 h-5 text-[var(--sf-acento-texto)]" />
                </div>
                <h3 className="text-xl font-playfair text-[var(--sf-tinta)] mb-1">{plan.nombre}</h3>
                {plan.descripcion && <p className="text-sm text-[var(--sf-texto-suave)] mb-4">{plan.descripcion}</p>}
                {/* El PRECIO es OPCIONAL y de TEXTO: vacío → NO se muestra (nunca placeholder ni "desde";
                    § site-content-defaults). Nayoli no lo lleva, así que este bloque no aparece. */}
                {plan.precio && <p className="text-2xl font-playfair text-[var(--sf-tinta)] mb-4">{plan.precio}</p>}
                <div className="space-y-2 mb-6">
                  {plan.beneficios.map(b => (
                    <div key={b} className="flex items-center gap-2 text-sm text-[var(--sf-acento-2)]">
                      <CheckCircle className="w-4 h-4 text-[var(--sf-acento-texto)] shrink-0" /> {b}
                    </div>
                  ))}
                </div>
                {/* El CTA es un enlace a WhatsApp: se OCULTA si el número no está configurado (un
                    `wa.me/` sin número es un botón muerto). En el preview `whatsapp` va sin prop. */}
                {whatsapp && (
                  <a
                    href={interesHref(plan.nombre)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`mt-auto inline-flex items-center justify-center gap-2 font-semibold px-6 py-3 rounded-full text-sm transition-all hover:-translate-y-0.5 ${plan.destacado ? 'bg-[var(--sf-acento)] hover:bg-[var(--sf-acento-3)] text-[var(--sf-acento-txt)]' : 'border-2 border-[var(--sf-acento)] text-[var(--sf-acento-texto)] hover:bg-[var(--sf-acento)] hover:text-[var(--sf-acento-txt)]'}`}
                  >
                    {c.ctaLabel} <ArrowRight className="w-4 h-4" />
                  </a>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
