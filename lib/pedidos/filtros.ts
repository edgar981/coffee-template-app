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
  /** De quién es el pedido. La FK, no el snapshot — ver `filtrarPorCliente`. */
  cliente_id?: string | null;
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

// ─── EL CLIENTE ES UN ALCANCE, NO UN CARRIL ──────────────────────────────────
//
// Los siete carriles son excluyentes entre sí y responden "¿dónde está este
// pedido?". El cliente responde otra cosa —"¿de quién son estos pedidos?"— y se
// combina con cualquiera de los siete. Por eso no entra a `FILTROS_PEDIDOS`: un
// octavo pill apagaría al que estuviera puesto.
//
// Se aplica ANTES que el carril, y eso decide también los CONTEOS: con un cliente
// puesto, "Necesitan atención · 5" tiene que decir cinco DE ESE CLIENTE. Contar
// sobre la lista entera dejaría un número que al hacer clic muestra otro — que es
// justo lo que la regla de "el contador cuadra con lo que hay debajo" prohíbe.
//
// Existe porque el sol de la fila de un cliente TIENE que llevar a sus pedidos.
// Un punto de atención que no se puede seguir manda al operador a buscar a mano
// cuál de todos era.
export function filtrarPorCliente<T extends { cliente_id?: string | null }>(
  ordenes: T[],
  clienteId: string | null,
): T[] {
  // Sin cliente no filtra — se distingue de "filtra y no matchea nada". Y una
  // orden sin `cliente_id` nunca entra a un alcance de cliente: no consta de
  // quién es (misma regla que `pedidosPorAtenderPorCliente`).
  return clienteId ? ordenes.filter(o => o.cliente_id === clienteId) : ordenes;
}

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
