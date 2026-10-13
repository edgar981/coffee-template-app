"use client";

import { Star, Coffee, Zap, CheckCircle, type LucideIcon } from 'lucide-react';
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { REGISTRY, seccionEsVisible } from '@/lib/config/site-content-defaults';
import { pasosDeSuscripcion } from '@/lib/storefront/planes-suscripcion';
import CampoEditable from '@/components/storefront/CampoEditable';

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

  // § CHAMISAS-SUSCRIPCIONES-CASILLAS-1 — "Así funciona" como casillas de álbum (§ el spec, item
  // 5): CERO campos nuevos, las mismas `pasos` tal cual, sólo otro tratamiento visual (vertical en
  // celular, en fila en escritorio, con números rotados y filetes punteados — el lenguaje de álbum
  // de Las Chamisas).
  if (c.variante === 'casillas') {
    return <SuscripcionPasosCasillas titulo={c.titulo} pasos={pasos} />;
  }

  return (
    // PALETA-MIGRAR-TEXTO-SOBRE-SUPERFICIE-1: texto directo sobre `--sf-superficie` migrado al
    // par `var(--sf-sobre-superficie,<token de hoy>)` (§ TEMAS-P6-FAMILIAS-1) — el token viejo
    // queda como fallback, byte-idéntico para Nayoli. `--sf-tostado` (línea del "0N") NO migra:
    // es decorativo, nunca formó parte de la familia floreada-contra-fondo. El título y el label
    // de cada paso (fallback `--sf-tinta`, no `--sf-texto`) migraron en PALETA-MIGRAR-ACENTO-
    // TINTA-1 -- § PALETA-ACENTO-TINTA-SOBRE-SUPERFICIE-1, DECISIONS.md.
    <section className="py-16 bg-[var(--sf-superficie)]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-playfair text-[var(--sf-sobre-superficie,var(--sf-tinta))] text-center mb-10"><CampoEditable campo="suscripcionPasos.titulo">{c.titulo}</CampoEditable></h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
          {pasos.map((paso, i) => {
            const Icono = ICONOS[i];
            // Cardinalidad FIJA 4 sin filtro: `i` mapea 1:1 a `paso{i+1}Label/Desc`, sin el riesgo de
            // desplazamiento que sí tienen los repeaters-pobres filtrados (galería, planes).
            const n = i + 1;
            return (
              <div key={i} className="text-center">
                <div className="w-12 h-12 bg-[var(--sf-acento)] rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Icono className="w-5 h-5 text-[var(--sf-acento-txt)]" />
                </div>
                <p className="text-[var(--sf-tostado)] text-xs font-bold mb-1">{String(n).padStart(2, '0')}</p>
                <p className="font-semibold text-[var(--sf-sobre-superficie,var(--sf-tinta))] mb-1 text-sm"><CampoEditable campo={`suscripcionPasos.paso${n}Label`}>{paso.label}</CampoEditable></p>
                <p className="text-xs text-[var(--sf-sobre-superficie,var(--sf-texto))]"><CampoEditable campo={`suscripcionPasos.paso${n}Desc`} multilinea>{paso.descripcion}</CampoEditable></p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// «CASILLAS DE ÁLBUM» (§ CHAMISAS-SUSCRIPCIONES-CASILLAS-1, refero-chamisas.md §4, item 4) — lista
// numerada: vertical (una fila por paso) en celular, en FILA (`sm:flex-row`) en escritorio — nunca
// una rejilla de íconos como «Tarjetas». Cada número lleva una rotación leve alternada, el
// tratamiento de "casilla de álbum" que ya usan las Láminas de /tienda (§ TIENDA-CHAMISAS-ALBUM-1),
// y un filete punteado separa los pasos en vez de un divisor sólido.
const ROTACIONES = ['-1deg', '0.8deg', '-0.6deg', '0.6deg'];

function SuscripcionPasosCasillas({ titulo, pasos }: { titulo: string; pasos: { label: string; descripcion: string }[] }) {
  return (
    <section className="bg-[var(--sf-superficie)] py-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <h2 className="mb-10 text-center font-playfair text-2xl text-[var(--sf-sobre-superficie,var(--sf-tinta))]">
          <CampoEditable campo="suscripcionPasos.titulo">{titulo}</CampoEditable>
        </h2>
        <ol className="flex flex-col divide-y divide-dashed divide-[var(--sf-linea)] sm:flex-row sm:divide-x sm:divide-y-0">
          {pasos.map((paso, i) => {
            const n = i + 1;
            return (
              <li key={i} className="flex-1 px-4 py-4 text-center first:pt-0 sm:py-0">
                <span
                  aria-hidden="true"
                  style={{ transform: `rotate(${ROTACIONES[i % ROTACIONES.length]})` }}
                  className="mb-2 inline-block font-playfair text-3xl text-[var(--sf-tostado)]"
                >
                  {String(n).padStart(2, '0')}
                </span>
                <p className="font-semibold text-[var(--sf-sobre-superficie,var(--sf-tinta))]">
                  <CampoEditable campo={`suscripcionPasos.paso${n}Label`}>{paso.label}</CampoEditable>
                </p>
                <p className="mt-1 text-xs text-[var(--sf-sobre-superficie,var(--sf-texto))]">
                  <CampoEditable campo={`suscripcionPasos.paso${n}Desc`} multilinea>{paso.descripcion}</CampoEditable>
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
