import { isPorCobrar } from '@duna/core/metrics/order-stat-filters';
import { necesitaAtencion, type OrdenParaAtencion } from './atencion';
import type { OrderStatus, CondicionPago } from '@/types/order';
import type { ShippingEstado } from '@/types/shipping';

// ─── LOS FILTROS DE PEDIDOS · un registro, no ifs en el JSX ──────────────────
//
// Siete carriles, y el conjunto ES la decisión: el operador filtra por DÓNDE está
// el pedido en su camino, no por su estado de cobro. Los filtros de cobro
// (pendiente/pagado) que tenía la lista vieja desaparecen — el cobro pasó a ser
// una propiedad que se VE en cada fila (el badge), no un carril por el que se
// entra. Los dos que sobreviven del eje de plata son los que sí son un carril de
// trabajo: "Por cobrar" (hay que ir a cobrar) y "Cancelado" (que es un destino).
//
// Registro y no una cadena de `if` en la pantalla, por lo de siempre: el
// predicado de cada carril tiene que poder afirmarse en la capa 1, y agregar un
// carril tiene que ser una entrada más y no tocar el render.

export type FiltroKey =
  | 'todos' | 'atencion' | 'preparacion' | 'camino' | 'entregados' | 'por_cobrar' | 'cancelado';

/** Lo que un filtro necesita mirar. Une lo de atención con los dos ejes. */
export interface OrdenParaFiltro extends OrdenParaAtencion {
  estado: OrderStatus;
  condicion_pago?: CondicionPago | null;
  shipping?: {
    estado: ShippingEstado | string;
    mensajero?: string | null;
    fecha_programada?: string | null;
  } | null;
}

export interface FiltroPedidos {
  key: FiltroKey;
  label: string;
  /** `undefined` = no filtra (Todos). Se distingue de "filtra y no matchea nada". */
  aplica?: (orden: OrdenParaFiltro) => boolean;
}

// Un pedido CANCELADO no aparece en los carriles de fulfillment aunque su envío
// conserve un estado: al cancelar, el envío pasa a `cancelado`, así que la
// exclusión es automática. Se afirma en el test igual — depender de un efecto
// lateral de otra parte del sistema sin decirlo es cómo se rompe callado.
const enEtapa = (etapa: ShippingEstado) => (o: OrdenParaFiltro) => o.shipping?.estado === etapa;

export const FILTROS_PEDIDOS: FiltroPedidos[] = [
  { key: 'todos',       label: 'Todos' },
  { key: 'atencion',    label: 'Necesitan atención', aplica: necesitaAtencion },
  { key: 'preparacion', label: 'En preparación',     aplica: enEtapa('preparando') },
  { key: 'camino',      label: 'En camino',          aplica: enEtapa('en_ruta') },
  { key: 'entregados',  label: 'Entregados',         aplica: enEtapa('entregado') },
  // Se consume `isPorCobrar` de core: la misma definición que la tarjeta del
  // dashboard y la lista de Órdenes. Un recorte propio acá haría que dos pantallas
  // contaran distinto la misma plata.
  { key: 'por_cobrar',  label: 'Por cobrar',         aplica: isPorCobrar },
  { key: 'cancelado',   label: 'Cancelado',          aplica: (o) => o.estado === 'cancelado' },
];

/** `null` para una key que no existe — no se cae a "todos" en silencio: un
 *  parámetro de URL basura debe ser visible, no interpretado. */
export const filtroPorKey = (key: string): FiltroPedidos | null =>
  FILTROS_PEDIDOS.find(f => f.key === key) ?? null;

export function aplicarFiltro<T extends OrdenParaFiltro>(ordenes: T[], key: FiltroKey): T[] {
  const filtro = filtroPorKey(key);
  return filtro?.aplica ? ordenes.filter(filtro.aplica) : ordenes;
}

/** Conteo por carril, para el número del pill. Se calcula sobre la MISMA lista
 *  que se muestra: un contador que no cuadra con lo que hay debajo es peor que
 *  ninguno. */
export function conteos<T extends OrdenParaFiltro>(ordenes: T[]): Record<FiltroKey, number> {
  return FILTROS_PEDIDOS.reduce((acc, f) => {
    acc[f.key] = f.aplica ? ordenes.filter(f.aplica).length : ordenes.length;
    return acc;
  }, {} as Record<FiltroKey, number>);
}
