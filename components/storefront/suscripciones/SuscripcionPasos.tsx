"use client";

import { Star, Coffee, Zap, CheckCircle, type LucideIcon } from 'lucide-react';
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { REGISTRY, seccionEsVisible } from '@/lib/config/site-content-defaults';
import { pasosDeSuscripcion } from '@/lib/storefront/planes-suscripcion';

// Los pasos "¿Cómo funciona?" de /suscripciones, desde SiteContent (§ Backlog #49 · e). El TEXTO
// (label + descripción) es DATO editable; el ÍCONO y el número "0N" son ESTRUCTURA —secuencia, no
// contenido— y salen por ÍNDICE, así que un cliente edita las palabras sin poder subir un ícono roto.
// Cardinalidad FIJA 4. Sección OCULTABLE: si `visible=false` se auto-oculta (un cliente puede no
// querer un "cómo funciona").
const ICONOS: LucideIcon[] = [Star, Coffee, Zap, CheckCircle];

export default function SuscripcionPasos() {
  const { suscripcionPasos } = useSiteContent();
  if (!seccionEsVisible(REGISTRY.suscripcionPasos, suscripcionPasos)) return null;
  const c = suscripcionPasos;
  const pasos = pasosDeSuscripcion(c);

  return (
    <section className="py-16 bg-[var(--sf-superficie)]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-playfair text-[var(--sf-tinta)] text-center mb-10">{c.titulo}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
          {pasos.map((paso, i) => {
            const Icono = ICONOS[i];
            return (
              <div key={i} className="text-center">
                <div className="w-12 h-12 bg-[var(--sf-acento)] rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Icono className="w-5 h-5 text-white" />
                </div>
                <p className="text-[var(--sf-tostado)] text-xs font-bold mb-1">{String(i + 1).padStart(2, '0')}</p>
                <p className="font-semibold text-[var(--sf-tinta)] mb-1 text-sm">{paso.label}</p>
                <p className="text-xs text-[var(--sf-texto)]">{paso.descripcion}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
