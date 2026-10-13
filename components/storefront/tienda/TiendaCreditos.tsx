"use client";

// LA FICHA DE ORIGEN · «CRÉDITOS» (§ TIENDA-ONIX-CARTELERA-1) — sección NUEVA, opcional, montada
// SIEMPRE por `page.tsx` (como `TiendaInterludio`/`TiendaCierre`): el gate vive DENTRO del
// componente —`seccionEsVisible` (el toggle) Y `creditosVisibles` (el piso de 3 filas completas, §
// lib/tienda/creditos.ts)—, nunca en el llamador.
//
// LAS FILAS (`CreditosFilas`, abajo) SON UN EXPORT NOMBRADO (§ TIENDA-ONIX-AJUSTES-1): la forma C
// aprobada pone la ficha DEBAJO de la tabla de compra, DENTRO de la columna de `TiendaTaquilla.tsx`
// —no como bloque aparte centrado—, así que ese componente necesita renderizar las MISMAS filas sin
// un segundo JSX que pudiera divergir del de acá.
//
// LA STANDALONE CALLA CUANDO TAQUILLA YA LAS MUESTRA: con `tiendaCatalogo.variante === 'taquilla'` Y
// una matriz VÁLIDA (`taquillaActiva`, § lib/tienda/taquilla.ts — el criterio ÚNICO, compartido con
// `TiendaTaquilla.tsx`), esta sección se oculta — mostrarla también acá la duplicaría. Mientras el
// catálogo carga (`catalog === null`) todavía no se sabe si Taquilla va a montar, así que se muestra
// igual (mismo criterio que `TiendaCatalogo.tsx` cayendo a «Actual» mientras espera el fetch): el
// peor caso es un parpadeo breve al resolver, no un hueco permanente. El fetch reusa `getCatalog()`
// (memoizado a nivel de módulo, § lib/api/products.ts) — nunca una segunda llamada de red: si
// `TiendaTaquilla` ya lo pidió, esto reutiliza la MISMA promesa.
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { useIsPreview } from '@/components/storefront/PreviewMode';
import CampoEditable from '@/components/storefront/CampoEditable';
import { REGISTRY, seccionEsVisible } from '@/lib/config/site-content-defaults';
import { contenedorAnchoClase } from '@/lib/config/themes';
import { creditosVisibles, filasCompletas, type CreditoItem } from '@/lib/tienda/creditos';
import { camposPorFilaCreditos } from '@/lib/admin/editor-orden-y-lienzo';
import { taquillaActiva } from '@/lib/tienda/taquilla';
import { getCatalog } from '@/lib/api/products';
import type { Product } from '@/types/product';

export default function TiendaCreditos() {
  const { tiendaCreditos, tiendaCatalogo, navTratamiento } = useSiteContent();
  const preview = useIsPreview();
  const [catalog, setCatalog] = useState<Product[] | null>(null);
  useEffect(() => {
    if (tiendaCatalogo.variante !== 'taquilla') return;
    getCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, [tiendaCatalogo.variante]);

  if (!seccionEsVisible(REGISTRY.tiendaCreditos, tiendaCreditos)) return null;
  const filas = filasCompletas(tiendaCreditos.items);
  if (!creditosVisibles(tiendaCreditos.items)) return null;
  if (catalog !== null && taquillaActiva(catalog)) return null;

  // EDITOR-CREDITOSFILAS-INDICE-ORIGINAL-1 — el índice ORIGINAL (no el visible, que corre en
  // cuanto una fila de en medio queda a medias), para que el clic en una fila abra el ÍTEM real de
  // `tiendaCreditos.items`. Ver el docstring de `camposPorFilaCreditos`.
  const camposPorFila = camposPorFilaCreditos(tiendaCreditos.items, filas, (i) => ({
    etiqueta: `tiendaCreditos.items.${i}.etiqueta`,
    valor: `tiendaCreditos.items.${i}.valor`,
  }));

  return (
    <motion.section
      initial={preview ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="py-16"
    >
      {/* EL MARGEN LATERAL (§ TIENDA-ONIX-AJUSTES-1) — `contenedorAnchoClase` es el MISMO eje que el
          resto de la página (encabezado, catálogo, el cierre «Costura»): sin él, en el celular esta
          ficha queda pegada al borde de la pantalla mientras todo lo demás respeta el margen. El
          ancho de LECTURA angosto (`max-w-xl`) se queda, anidado adentro — es una decisión de forma
          distinta (cuánto mide la columna), no el margen que este fix corrige. */}
      <div className={`${contenedorAnchoClase(navTratamiento.posicion)} mx-auto`}>
        <div className="mx-auto max-w-xl">
          <CreditosFilas filas={filas} camposPorFila={camposPorFila} />
        </div>
      </div>
    </motion.section>
  );
}

/** Las filas etiqueta/valor, SIN wrapper de ancho ni margen — el consumidor decide eso (acá, la
 *  standalone; en `TiendaTaquilla.tsx`, la columna de compra; en `NosotrosFicha.tsx`, § ONIX-
 *  NOSOTROS-ESCENAS-FICHA-1, la mitad derecha del capítulo verde).
 *
 *  `invertido` (default false) swapea los DOS tokens de color por su par de fondo-OSCURO (`--sf-
 *  fondo`, la crema) en vez de pisar con un hex: la Ficha vive sobre `--sf-tinta` y el par
 *  texto-suave/tinta de SIEMPRE (pensado para fondo CLARO) se leería invertido literal —texto
 *  oscuro sobre fondo oscuro—. El filete se invierte por el MISMO motivo (`--sf-fondo`/20 en vez de
 *  `--sf-linea`/15, mismo % que ya usa el resto de la ficha para "crema al 20%").
 *
 *  § ONIX-PAGINAS-FIDELIDAD-1 — TRES arreglos de fidelidad a la maqueta aprobada de Onix, los tres
 *  en esta MISMA función porque la comparten Taquilla/standalone/Escenas/Ficha:
 *  - **R1 (filete):** tinta al 15% (`--sf-tinta`/15), no `--sf-linea`/15 — ese token, para Onix,
 *    deriva casi invisible (`mix(fondo,acento,.16)` sobre una base ya clara). El filete invertido
 *    NO cambia: ya era crema/20, y la maqueta coincide.
 *  - **R2 (texto principal en la tinta):** la maqueta pinta dt Y dd casi negros (`--verde`/`#1F1914`
 *    de Onix) — los DOS colapsan al rol `--sf-tinta` genérico («texto principal en la tinta», §
 *    el spec item 3), nunca `--sf-texto-suave` (que para Onix deriva oliva, § R2 del informe).
 *  - **R3 (estructura):** filete ARRIBA de la primera fila Y ABAJO de cada fila (N+1), como
 *    `.creditos` de la maqueta (`div:first-child{border-top}` + `div{border-bottom}`) — no sólo
 *    ENTRE filas (N−1, lo que había).
 *
 *  `camposPorFila` (§ EDITOR-CREDITOSFILAS-INDICE-ORIGINAL-1, EDITOR-ORDEN-Y-LIENZO-2) — OPCIONAL,
 *  alineado 1-a-1 con `filas` (NUNCA con el array original: es el llamador quien ya resolvió el
 *  índice original con `camposPorFilaCreditos`, § lib/admin/editor-orden-y-lienzo.ts). Ausente (el
 *  default), la fila se pinta como texto plano — el caso de `NosotrosEscenas.tsx`, que no lo pasa
 *  (§ su propio docstring, aún sin instrumentar). Presente, cada etiqueta/valor se vuelve
 *  click-to-edit, UNA fila a la vez — nunca el bloque entero. */
export function CreditosFilas({
  filas,
  invertido = false,
  camposPorFila,
}: {
  filas: readonly CreditoItem[];
  invertido?: boolean;
  camposPorFila?: readonly { etiqueta: string; valor: string }[];
}) {
  const filete = invertido ? 'border-[var(--sf-fondo)]/20' : 'border-[var(--sf-tinta)]/15';
  return (
    <>
      {filas.map((fila, i) => {
        const campos = camposPorFila?.[i];
        return (
          <div
            key={`${fila.etiqueta}-${i}`}
            className={`flex items-baseline justify-between gap-4 border-b ${filete} py-3.5 ${i === 0 ? `border-t ${filete}` : ''}`}
          >
            <span className={`text-[11.5px] font-bold uppercase tracking-[0.16em] ${invertido ? 'text-[var(--sf-fondo)]/80' : 'text-[var(--sf-tinta)]'}`}>
              {campos ? <CampoEditable campo={campos.etiqueta}>{fila.etiqueta}</CampoEditable> : fila.etiqueta}
            </span>
            <span className={`text-right text-[15px] ${invertido ? 'text-[var(--sf-fondo)]' : 'text-[var(--sf-tinta)]'}`}>
              {campos ? <CampoEditable campo={campos.valor}>{fila.valor}</CampoEditable> : fila.valor}
            </span>
          </div>
        );
      })}
    </>
  );
}
