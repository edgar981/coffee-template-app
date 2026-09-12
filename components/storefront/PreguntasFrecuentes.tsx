"use client";

import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { REGISTRY, seccionEsVisible } from "@/lib/config/site-content-defaults";

// La FAQ de /suscripciones — REPEATER (§ SUSCRIPCIONES-FAQ-DATO-1, sobre § SiteContent — el
// repeater). `constants/subscription-faq.ts` (RETIRADO) tenía cuatro respuestas FALSAS: prometía
// pausar "desde tu cuenta" (la ruta se borró), un cobro recurrente con un cambio "desde el siguiente
// ciclo" (no hay cobro recurrente en el sistema) y "envío gratis a nivel nacional" (no existe esa
// regla). La sección NACE VACÍA y se auto-oculta (hide-on-empty) hasta que el owner cargue preguntas
// REALES por el editor. El `titulo` es DATO (antes un `<h2>` fijo).
export default function PreguntasFrecuentes() {
  const { suscripcionFaq } = useSiteContent();
  if (!seccionEsVisible(REGISTRY.suscripcionFaq, suscripcionFaq)) return null;
  const { titulo, items } = suscripcionFaq;

  return (
    <section className="py-16 bg-[var(--sf-fondo)]">
      <div className="max-w-2xl mx-auto px-4">
        <h2 className="text-2xl font-playfair text-[var(--sf-tinta)] text-center mb-8">{titulo}</h2>
        <div className="space-y-4">
          {items.map((faq, i) => (
            <div key={i} className="bg-[var(--sf-tarjeta)] rounded-2xl sf-borde border-[var(--sf-linea)] p-5">
              <p className="font-semibold text-[var(--sf-tinta)] text-sm mb-2">{faq.question}</p>
              <p className="text-sm text-[var(--sf-texto)]">{faq.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
