import { decidirMolienda, type DecisionMolienda } from '@duna/core/moliendas-opciones';
import { formatCOP } from '@duna/core/utils';
import type { SuscripcionPlanesContent } from '../config/site-content-defaults';

// LA TAQUILLA DE SUSCRIPCIÓN (§ ONIX-SUSCRIPCION-TAQUILLA-1). PURO (capa 1): sin red, sin DOM. Arma
// el resumen, la referencia de precio y el mensaje de WhatsApp del pedido de suscripción, sobre el
// MISMO producto (una celda de la matriz derivada del catálogo, § lib/tienda/taquilla.ts) que ya
// elige la Taquilla de /tienda — nunca un segundo modelo de producto.
//
// LA MOLIENDA SIGUE `decidirMolienda` (packages/core/src/moliendas-opciones.ts), la MISMA regla que
// ya gobierna el catálogo y el checkout — nunca una copia. La maqueta de Onix hardcodea
// `pres==='molido'` para decidir si hay fila de molienda (su demo sólo declara moliendas en el
// producto "molido"); acá el gate es el PRODUCTO elegido —`decidirMolienda` sobre SU
// `moliendasOpciones`—, no el nombre de su categoría: una categoría cualquiera puede o no declarar
// opciones, y es ese dato el que decide si hay algo que elegir, no su etiqueta.

/** Las frecuencias configuradas, en orden — lista plana compacta (1-4 slots): sólo las NO vacías. */
export function frecuenciasDeTaquilla(slots: readonly string[]): string[] {
  return slots.filter((s) => s.trim() !== '');
}

/** Cuántas bolsas ofrecer: 1..max (§ el spec: "máximo de bolsas, 1-5"). `max` inválido o menor a 1
 *  cae a 1 — siempre hay al menos una bolsa que pedir. */
export function bolsasDeTaquilla(max: number): number[] {
  const n = Number.isFinite(max) && max >= 1 ? Math.floor(max) : 1;
  return Array.from({ length: n }, (_, i) => i + 1);
}

/**
 * El segmento de molienda del resumen/mensaje, o `null` si no aplica — ninguna fila que mostrar,
 * nada que decirle al mensajero. `nombreSeleccionado` sólo importa en modo 'eleccion' (la fila con
 * las opciones disponibles); en 'automatica' la única opción manda sola, sin fila que elegir.
 */
export function segmentoMolienda(decision: DecisionMolienda, nombreSeleccionado: string | null): string | null {
  if (decision.modo === 'automatica') return `Molienda ${decision.nombre}`;
  if (decision.modo === 'eleccion' && nombreSeleccionado) return `Molienda ${nombreSeleccionado}`;
  return null; // 'ninguna' y 'agotada': nada que decidir, nada que decir
}

export interface ResumenTaquillaInput {
  bolsas: number;
  peso: number;
  segmentoMolienda: string | null;
  frecuenciaEtiqueta: string;
}

/**
 * «2 × 250 G · MOLIENDA MEDIO · CADA MES» — el texto YA en mayúscula (la serif mayúscula del
 * resumen es tipografía, § refero-onix-paginas.md; este helper no depende de que el CSS la ponga,
 * para que el test afirme el texto final sin levantar DOM).
 */
export function resumenTaquilla({ bolsas, peso, segmentoMolienda: seg, frecuenciaEtiqueta }: ResumenTaquillaInput): string {
  const partes = [`${bolsas} × ${peso} G`, ...(seg ? [seg.toUpperCase()] : []), `CADA ${frecuenciaEtiqueta.toUpperCase()}`];
  return partes.join(' · ');
}

/**
 * «Referencia: 2 × $20.000, precio de tienda por bolsa.» — el multiplicador sólo aparece con más de
 * una bolsa (§ la maqueta de Onix: el `n>1?` de su `pintar()`); con una sola bolsa, el precio solo.
 */
export function referenciaPrecioTaquilla(bolsas: number, precioUnitario: number): string {
  const multiplicador = bolsas > 1 ? `${bolsas} × ` : '';
  return `Referencia: ${multiplicador}${formatCOP(precioUnitario)}, precio de tienda por bolsa.`;
}

export interface MensajeTaquillaInput {
  nombreProducto: string;
  bolsas: number;
  peso: number;
  segmentoMolienda: string | null;
  frecuenciaEtiqueta: string;
}

/** El mensaje EXACTO que se manda por WhatsApp — el texto que el botón promete, impreso debajo. */
export function mensajeTaquilla({ nombreProducto, bolsas, peso, segmentoMolienda: seg, frecuenciaEtiqueta }: MensajeTaquillaInput): string {
  const partes = [
    `${bolsas} ${bolsas > 1 ? 'bolsas' : 'bolsa'} de ${peso} g`,
    ...(seg ? [seg.toLowerCase()] : []),
    `cada ${frecuenciaEtiqueta.toLowerCase()}`,
  ];
  return `Hola, quiero suscribirme a ${nombreProducto}: ${partes.join(', ')}.`;
}

/** Los créditos del trato, cardinalidad FIJA 4 (§ el docstring de `SuscripcionPlanesContent`). Sólo
 *  las filas CON etiqueta y valor — una fila a medias no se muestra (mismo criterio que
 *  `creditosVisibles`/`filasCompletas`, lib/tienda/creditos.ts). */
export function creditosDeTaquilla(p: SuscripcionPlanesContent): { etiqueta: string; valor: string }[] {
  return [
    { etiqueta: p.credito1Etiqueta, valor: p.credito1Valor },
    { etiqueta: p.credito2Etiqueta, valor: p.credito2Valor },
    { etiqueta: p.credito3Etiqueta, valor: p.credito3Valor },
    { etiqueta: p.credito4Etiqueta, valor: p.credito4Valor },
  ].filter((c) => c.etiqueta.trim() !== '' && c.valor.trim() !== '');
}

/** Re-exportado para que los consumidores de este módulo no necesiten importar `decidirMolienda`
 *  de `@duna/core` por separado sólo para tipar su resultado. */
export { decidirMolienda };
export type { DecisionMolienda };
