"use client";

import { useState } from "react";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { REGISTRY, seccionEsVisible, type SuscripcionFaqItem } from "@/lib/config/site-content-defaults";
import { siguienteAbierta } from "@/lib/storefront/letra-pequena";
import CampoEditable from "@/components/storefront/CampoEditable";

// La FAQ de /suscripciones — REPEATER (§ SUSCRIPCIONES-FAQ-DATO-1, sobre § SiteContent — el
// repeater). `constants/subscription-faq.ts` (RETIRADO) tenía cuatro respuestas FALSAS: prometía
// pausar "desde tu cuenta" (la ruta se borró), un cobro recurrente con un cambio "desde el siguiente
// ciclo" (no hay cobro recurrente en el sistema) y "envío gratis a nivel nacional" (no existe esa
// regla). La sección NACE VACÍA y se auto-oculta (hide-on-empty) hasta que el owner cargue preguntas
// REALES por el editor. El `titulo` es DATO (antes un `<h2>` fijo).
//
// EL CAMPO EDITABLE (§ EDITOR-TIENDA-CAMPO-EDITABLE-CIERRE-1): este componente era el ÚNICO hueco
// nombrado de toda la fila 4 de § 6.4 de EDICION-INLINE.md — `EDITOR-TIENDA-CAMPO-EDITABLE-PAGINAS-1`
// lo dejó sin instrumentar porque vive FUERA de su `touches:` (es compartido con `/tienda` y
// `/preguntas-frecuentes`, § el grep de sus 3 importadores). Esta tanda SÍ lo toca: `titulo` y cada
// `question`/`answer` del repeater marcan su ruta por ÍNDICE (`suscripcionFaq.items.${i}.question`),
// como `testimonials`/`nosotrosGaleria` — acá no hace falta preservar el índice ORIGINAL frente a un
// filtro: `items.map` recorre el array completo sin saltar ninguno (sin hide-on-empty POR ÍTEM), así
// que la posición visible y el índice real coinciden siempre.
//
// `variante` (§ ONIX-SUSCRIPCION-LETRA-CIERRE-1): 'tarjetas' (la de arriba, canónica, sin tocar) |
// 'letraPequena' (`LetraPequena`, abajo) — CERO campos nuevos, las dos leen `titulo`/`items` tal
// cual, sólo cambia CÓMO se dibujan.
export default function PreguntasFrecuentes() {
  const { suscripcionFaq } = useSiteContent();
  if (!seccionEsVisible(REGISTRY.suscripcionFaq, suscripcionFaq)) return null;
  const { titulo, items, variante } = suscripcionFaq;

  if (variante === "letraPequena") {
    return <LetraPequena titulo={titulo} items={items} />;
  }

  return (
    <section className="py-16 bg-[var(--sf-fondo)]">
      <div className="max-w-2xl mx-auto px-4">
        <h2 className="text-2xl font-playfair text-[var(--sf-tinta)] text-center mb-8"><CampoEditable campo="suscripcionFaq.titulo">{titulo}</CampoEditable></h2>
        <div className="space-y-4">
          {items.map((faq, i) => (
            <div key={i} className="bg-[var(--sf-tarjeta)] rounded-2xl sf-borde border-[var(--sf-linea)] p-5">
              <p className="font-semibold text-[var(--sf-tinta)] text-sm mb-2"><CampoEditable campo={`suscripcionFaq.items.${i}.question`}>{faq.question}</CampoEditable></p>
              <p className="text-sm text-[var(--sf-texto)]"><CampoEditable campo={`suscripcionFaq.items.${i}.answer`} multilinea>{faq.answer}</CampoEditable></p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// LA COMPOSICIÓN «LETRA PEQUEÑA» (§ ONIX-SUSCRIPCION-LETRA-CIERRE-1, `.scratch/onix-paginas/
// refero-onix-paginas.md`, § d): columna de 720px sobre crema; la pregunta en sans mayúscula de
// 12px (+0.14em de tracking) con un indicador "+/–"; la respuesta a 15px; los MISMOS filetes que
// `CreditosFilas` (`border-t border-[var(--sf-linea)]/15 … first:border-t-0`, § TiendaCreditos.tsx)
// — el spec lo pide explícito ("Lleva los filetes de los créditos"). SÓLO UNA abierta a la vez
// (`siguienteAbierta`, lib/storefront/letra-pequena.ts); la primera arranca abierta, como la
// maqueta. Mismo precedente de accesibilidad que `SeccionPreguntas.tsx`
// (components/storefront/secciones/Preguntas.tsx): `aria-expanded`/`aria-controls` en el botón,
// `role="region"`/`aria-labelledby` en el panel.
function LetraPequena({ titulo, items }: { titulo: string; items: SuscripcionFaqItem[] }) {
  const [abierta, setAbierta] = useState<number | null>(0);

  return (
    <section className="py-16 bg-[var(--sf-fondo)]">
      <div className="mx-auto max-w-[720px] px-4">
        <h2 className="mb-6 text-left font-playfair text-3xl uppercase leading-tight text-[var(--sf-tinta)]">
          <CampoEditable campo="suscripcionFaq.titulo">{titulo}</CampoEditable>
        </h2>
        <div>
          {items.map((faq, i) => {
            const abierto = abierta === i;
            const botonId = `letra-pequena-boton-${i}`;
            const panelId = `letra-pequena-panel-${i}`;
            return (
              <div key={i} className="border-t border-[var(--sf-linea)]/15 first:border-t-0">
                <button
                  type="button"
                  id={botonId}
                  aria-expanded={abierto}
                  aria-controls={panelId}
                  onClick={() => setAbierta((actual) => siguienteAbierta(actual, i))}
                  className="flex w-full items-center justify-between gap-4 py-[18px] text-left text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--sf-tinta)]"
                >
                  <span><CampoEditable campo={`suscripcionFaq.items.${i}.question`}>{faq.question}</CampoEditable></span>
                  <span aria-hidden="true" className="font-playfair text-2xl font-light leading-none text-[var(--sf-tinta)]">
                    {abierto ? "–" : "+"}
                  </span>
                </button>
                {abierto && (
                  <div id={panelId} role="region" aria-labelledby={botonId} className="max-w-[60ch] pb-5 text-[15px] text-[var(--sf-texto)]">
                    <CampoEditable campo={`suscripcionFaq.items.${i}.answer`} multilinea>{faq.answer}</CampoEditable>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
