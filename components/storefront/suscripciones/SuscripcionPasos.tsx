"use client";

import { Star, Coffee, Zap, CheckCircle, type LucideIcon } from 'lucide-react';
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { REGISTRY, seccionEsVisible } from '@/lib/config/site-content-defaults';
import { pasosDeSuscripcion } from '@/lib/storefront/planes-suscripcion';
import { contenedorAnchoClase } from '@/lib/config/themes';
import CampoEditable from '@/components/storefront/CampoEditable';

// Los pasos "¿Cómo funciona?" de /suscripciones, desde SiteContent (§ Backlog #49 · e). El TEXTO
// (label + descripción) es DATO editable; el ÍCONO y el número "0N" son ESTRUCTURA —secuencia, no
// contenido— y salen por ÍNDICE, así que un cliente edita las palabras sin poder subir un ícono roto.
// Cardinalidad FIJA 4. Sección OCULTABLE: si `visible=false` se auto-oculta (un cliente puede no
// querer un "cómo funciona").
const ICONOS: LucideIcon[] = [Star, Coffee, Zap, CheckCircle];

export default function SuscripcionPasos() {
  const { suscripcionPasos, navTratamiento } = useSiteContent();
  if (!seccionEsVisible(REGISTRY.suscripcionPasos, suscripcionPasos)) return null;
  const c = suscripcionPasos;
  const pasos = pasosDeSuscripcion(c);

  // § CHAMISAS-SUSCRIPCIONES-CASILLAS-1, re-medido en § CHAMISAS-SUSCRIPCIONES-FIDELIDAD-1 — "Así
  // funciona" como tarjetas de álbum inclinadas (§ el spec, item 6): CERO campos nuevos, las mismas
  // `pasos` tal cual, sólo otro tratamiento visual (una rejilla de tarjetas rotadas con número en
  // círculo, en vez de numerales centrados sobre una banda a lo ancho — el lenguaje de álbum de Las
  // Chamisas, ver el docstring de `SuscripcionPasosCasillas` abajo).
  if (c.variante === 'casillas') {
    return <SuscripcionPasosCasillas titulo={c.titulo} pasos={pasos} posicion={navTratamiento.posicion} />;
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

// «CASILLAS DE ÁLBUM» (§ CHAMISAS-SUSCRIPCIONES-CASILLAS-1, refero-chamisas.md §4, item 4 —
// re-medido en § CHAMISAS-SUSCRIPCIONES-FIDELIDAD-1, el spec item 6, contra `.how`/`.alb`/`.alb li`
// de la maqueta aprobada): TARJETAS INCLINADAS, no numerales centrados sobre una banda a lo ancho.
// Cada paso es su propia TARJETA (`--sf-superficie` sobre el fondo de PÁGINA de la sección —
// `--sf-fondo`, no `--sf-superficie`, para que la tarjeta se recorte contra algo), con una rotación
// leve FIJA por índice (el mismo tratamiento de "casilla de álbum" de las Láminas de /tienda,
// § TIENDA-CHAMISAS-ALBUM-1) aplicada a la TARJETA entera —antes sólo al número—, y un número en
// un círculo BLANCO (`--sf-tarjeta`) sobre la tarjeta, no un divisor punteado entre pasos.
//
// § CHAMISAS-PAGINAS-ARREGLOS-1 — DOS AJUSTES medidos contra la maqueta (`.how.wrap{max-width:
// 1376px}`, `h2.sec-t` sin `text-align`, así que hereda el default IZQUIERDA — ninguna regla la
// centra):
//
// 1. EL ANCHO: vivía en su PROPIO `max-w-5xl`, el único de la página que no era ni el de siempre
//    (`max-w-6xl`) ni `contenedorAnchoClase`. Pasa a `contenedorAnchoClase(posicion)`, el MISMO
//    contenedor que la apertura y «Arma tu pedido» (`SuscripcionCasillas.tsx`) — con `posicion:false`
//    (el default) es un ancho ligeramente MAYOR que el `max-w-5xl` (1024px) de antes, `max-w-6xl`
//    (1152px); no hay ningún tenant hoy que dependa del valor viejo (§ el docstring de
//    `SuscripcionCasillas.tsx`: esta variante es exclusiva de Las Chamisas).
// 2. EL TÍTULO estaba CENTRADO (`text-center`) — la maqueta nunca lo centra; pasa a alineado a la
//    izquierda, como el resto de los títulos de sección de estas páginas.
const ROTACIONES = ['-1deg', '0.8deg', '-0.6deg', '0.6deg'];

function SuscripcionPasosCasillas({ titulo, pasos, posicion }: { titulo: string; pasos: { label: string; descripcion: string }[]; posicion: boolean }) {
  const contenedorClase = contenedorAnchoClase(posicion);
  return (
    <section className="bg-[var(--sf-fondo)] py-16">
      <div className={`${contenedorClase} mx-auto`}>
        <h2 className="mb-10 font-playfair text-2xl text-[var(--sf-tinta)]">
          <CampoEditable campo="suscripcionPasos.titulo">{titulo}</CampoEditable>
        </h2>
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:gap-4">
          {pasos.map((paso, i) => {
            const n = i + 1;
            return (
              <li
                key={i}
                style={{ transform: `rotate(${ROTACIONES[i % ROTACIONES.length]})` }}
                className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 rounded-2xl bg-[var(--sf-superficie)] p-3.5 sm:grid-cols-1 sm:content-start sm:items-start sm:gap-y-2.5 sm:p-4"
              >
                <span
                  aria-hidden="true"
                  className="row-span-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--sf-tarjeta)] font-playfair text-lg text-[var(--sf-tinta)] sm:row-span-1"
                >
                  {n}
                </span>
                <p className="font-playfair text-lg leading-tight text-[var(--sf-tinta)]">
                  <CampoEditable campo={`suscripcionPasos.paso${n}Label`}>{paso.label}</CampoEditable>
                </p>
                <p className="text-sm leading-snug text-[var(--sf-texto)]">
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
