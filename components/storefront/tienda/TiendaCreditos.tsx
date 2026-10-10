"use client";

// LA FICHA DE ORIGEN · «CRÉDITOS» (§ TIENDA-ONIX-CARTELERA-1) — sección NUEVA, opcional, montada
// SIEMPRE por `page.tsx` (como `TiendaInterludio`/`TiendaCierre`): el gate vive DENTRO del
// componente —`seccionEsVisible` (el toggle) Y `creditosVisibles` (el piso de 3 filas completas, §
// lib/tienda/creditos.ts)—, nunca en el llamador.
import { motion } from 'framer-motion';
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { useIsPreview } from '@/components/storefront/PreviewMode';
import { REGISTRY, seccionEsVisible } from '@/lib/config/site-content-defaults';
import { creditosVisibles, filasCompletas } from '@/lib/tienda/creditos';

export default function TiendaCreditos() {
  const { tiendaCreditos } = useSiteContent();
  const preview = useIsPreview();
  if (!seccionEsVisible(REGISTRY.tiendaCreditos, tiendaCreditos)) return null;
  const filas = filasCompletas(tiendaCreditos.items);
  if (!creditosVisibles(tiendaCreditos.items)) return null;

  return (
    <motion.section
      initial={preview ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="py-16"
    >
      <div className="mx-auto max-w-xl">
        {filas.map((fila, i) => (
          <div
            key={`${fila.etiqueta}-${i}`}
            className="flex items-baseline justify-between gap-6 border-t border-[var(--sf-linea)]/15 py-3 first:border-t-0"
          >
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sf-texto-suave)]">
              {fila.etiqueta}
            </span>
            <span className="text-right text-base text-[var(--sf-tinta)]">{fila.valor}</span>
          </div>
        ))}
      </div>
    </motion.section>
  );
}
