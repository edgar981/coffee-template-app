// EL MECANISMO de condición-por-campo (§ EDITOR-ORDEN-Y-LIENZO-1, item 4). PURO, capa 1: no monta
// nada, no sabe de React — `TiendaSeccionEditor.tsx` lo consume para avisar, DENTRO del campo, por
// qué un valor que el dueño ya escribió no se ve hoy en la tienda, con la salida accionable.
//
// EL DEFECTO QUE ESTO CIERRA (reporte del owner, 2026-10-12): "Etiqueta de la fila de molienda" no
// se muestra si en la tienda no hay configurados otros tipos de molienda, y quien usa el panel no
// sabe por qué. El hint estático ("Sólo con la composición 'Taquilla', y sólo si el producto ofrece
// elegir molienda") explica la CONDICIÓN pero no dice si HOY se cumple — el dueño tiene que adivinar
// si su catálogo la satisface. Esta función la EVALÚA contra el catálogo real que el panel ya carga.
//
// `CampoTexto.condicion` (tienda-secciones.ts) es un SET CERRADO de claves — nunca una función: el
// config cruza server→client como prop (serializable), igual que `opcionesDinamicas`/`seMuestraSiCampo`
// ya lo son por la misma razón.

import { decidirMolienda } from '@duna/core/moliendas-opciones';
import type { Product } from '@/types/product';

export type CondicionCampo = 'molienda-multiple';

/**
 * El RESUMEN de una tarjeta repetida colapsada (§ item 2 del spec: "mostrando su resumen, p. ej.
 * «Pedido · Por WhatsApp»") — sus dos primeros campos de texto, valor ACTUAL, unidos por " · ".
 * MISMO criterio que `resumenDe` de `RepeaterEditor.tsx` (principal/detalle), aplicado a campos
 * PLANOS de un bloque `tarjeta` en vez de a un ítem de repeater — no una segunda idea, la misma,
 * para la forma de dato que corresponde acá (slots fijos, no una lista).
 */
export function resumenBloqueTarjeta(
  camposBloque: readonly { name: string }[],
  form: Record<string, unknown>,
): string {
  return camposBloque
    .slice(0, 2)
    .map((c) => String(form[c.name] ?? '').trim())
    .filter((v) => v !== '')
    .join(' · ');
}

export interface CondicionCampoResultado {
  /** El mensaje a mostrar DENTRO del campo — la razón, en el mismo tono que un hint. */
  mensaje: string;
  /** El enlace accionable ("configurala en Productos"), o ausente si no hay una salida clara. */
  enlace?: { href: string; etiqueta: string };
}

/**
 * ¿El campo `condicion` aplica HOY contra el catálogo real? `null` = sí aplica (o no hay condición
 * declarada, o el catálogo todavía no cargó — preferir callar a afirmar sobre un dato que no se
 * tiene, § el criterio de `destinoInexistente`/`productoInexistente` ya establecido en este
 * archivo). Un resultado no-null es el AVISO: la condición NO se cumple hoy.
 */
export function condicionCampoInactiva(
  condicion: CondicionCampo | undefined,
  catalogoReal: readonly Product[],
  catalogoListo: boolean,
): CondicionCampoResultado | null {
  if (!condicion || !catalogoListo) return null;
  if (condicion === 'molienda-multiple') {
    // MISMA regla que decide si la tienda real ofrece elegir molienda (§ SuscripcionTaquilla.tsx/
    // TiendaTaquilla.tsx, `decision.modo === 'eleccion'`) — nunca una segunda cuenta que pudiera
    // divergir de la que la tienda consulta para decidir si pinta la fila.
    const algunoOfreceEleccion = catalogoReal.some((p) => decidirMolienda(p.moliendasOpciones).modo === 'eleccion');
    if (algunoOfreceEleccion) return null;
    return {
      mensaje: 'Se muestra sólo cuando un producto tiene más de una molienda disponible. Hoy ninguno la tiene.',
      enlace: { href: '/admin/productos', etiqueta: 'Configurala en Productos' },
    };
  }
  return null;
}
