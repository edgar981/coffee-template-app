// ─── LOS CARRILES DE CLIENTES · un registro, no ifs en el JSX ────────────────
//
// Mismo criterio que `lib/pedidos/filtros.ts`: el predicado de cada carril tiene
// que poder afirmarse en la capa 1, y agregar un carril tiene que ser una entrada
// más y no tocar el render.
//
// SON CUATRO, y el conjunto es la decisión. Lo que NO hay es un carril de
// "inactivos": el dominio no tiene criterio de inactividad consultable —el único
// que existe vive dentro del handler del barrido de reactivación, con su umbral
// configurable por automatización— y fabricar uno acá sería inventar la regla en
// la pantalla, que es exactamente lo que este archivo existe para impedir.

export interface ClienteParaFiltro {
  nombre?:            string | null;
  email?:             string | null;
  telefono?:          string | null;
  /** Pedidos NO cancelados. La misma definición que muestra la fila. */
  ordenes?:           number;
  /** Pedidos suyos que piden acción (`pedidosPorAtenderPorCliente`). */
  pedidosPorAtender?: number;
}

import { conteosDeCola, type CarrilBase, type ConteosDeCola } from '@/lib/carriles';

export type CarrilKey = 'todos' | 'atencion' | 'recurrentes' | 'sin_compras';

export interface CarrilClientes extends CarrilBase<CarrilKey> {
  /** `undefined` = no filtra (Todos). Distinto de "filtra y no matchea nada". */
  aplica?: (c: ClienteParaFiltro) => boolean;
}

/**
 * ¿Este cliente tiene pedidos que atender?
 *
 * El conteo lo calcula el servidor con `necesitaAtencion` —la MISMA regla del
 * pill de Pedidos y del punto del nav—; acá sólo se lee. Si esta capa tuviera su
 * propio criterio, el carril y el sol de la fila podrían discrepar entre sí.
 */
export const tieneAtencion = (c: ClienteParaFiltro): boolean => (c.pedidosPorAtender ?? 0) > 0;

/**
 * RECURRENTE = más de un pedido no cancelado.
 *
 * ── ES UN DERIVADO, Y ESO HAY QUE DECIRLO ───────────────────────────────────
 *
 * No es "el cliente se suscribió": es "compró más de una vez". La INTENCIÓN de
 * recurrencia —un plan con su frecuencia y su descuento— NO EXISTE en este
 * dominio: no hay modelo, `SUBSCRIPTIONS_ENABLED` es `false`, los planes viven en
 * `lib/mock/` y el descuento está pendiente de definir con el cliente. Mientras no
 * exista, esto es lo único que se puede afirmar, y por eso el carril y su stat
 * declaran la fórmula en vez de insinuar una marca del negocio que nadie
 * registró.
 *
 * Y por eso mismo NO va como distintivo en la tarjeta. La lista vieja pintaba una
 * ★ a quien tuviera más de dos pedidos: un adorno que se lee como categoría de
 * cliente y que nadie decidió.
 */
export const esRecurrente = (c: ClienteParaFiltro): boolean => (c.ordenes ?? 0) > 1;

/** Registrado y sin un solo pedido vivo. */
export const sinCompras = (c: ClienteParaFiltro): boolean => (c.ordenes ?? 0) === 0;

export const CARRILES_CLIENTES: CarrilClientes[] = [
  { key: 'todos',       label: 'Todos',              tipo: 'acumulador' },
  { key: 'atencion',    label: 'Necesitan atención', tipo: 'cola',       aplica: tieneAtencion },
  { key: 'recurrentes', label: 'Recurrentes',        tipo: 'acumulador', aplica: esRecurrente },
  { key: 'sin_compras', label: 'Sin compras',        tipo: 'acumulador', aplica: sinCompras },
];

/** `null` para una key que no existe — no se cae a "todos" en silencio: un
 *  parámetro de URL basura debe ser visible, no interpretado. */
export const carrilPorKey = (key: string): CarrilClientes | null =>
  CARRILES_CLIENTES.find(c => c.key === key) ?? null;

export function aplicarCarril<T extends ClienteParaFiltro>(clientes: T[], key: CarrilKey): T[] {
  const carril = carrilPorKey(key);
  return carril?.aplica ? clientes.filter(carril.aplica) : clientes;
}

/**
 * Conteo de las COLAS, para el número del pill. Los acumuladores no traen número
 * y por eso no se cuentan (§ lib/carriles).
 *
 * Sobre la MISMA lista que se muestra: un contador que no cuadra con lo que hay
 * debajo es peor que ninguno.
 */
export const conteosClientes = <T extends ClienteParaFiltro>(clientes: T[]): ConteosDeCola<CarrilKey> =>
  conteosDeCola(CARRILES_CLIENTES, clientes);

// ─── LA BÚSQUEDA · qué significa "empatar" para un cliente ───────────────────
//
// Vive acá y no en el `SearchField` del design-system, que es el CAMPO y no sabe
// qué se busca. Empatar contra un cliente es dominio: nombre, correo y teléfono,
// y cada uno con su criterio.

const soloDigitos = (s: string): string => s.replace(/\D/g, '');

/**
 * ¿Este cliente empata con lo tecleado?
 *
 * ── EL TELÉFONO SE COMPARA POR DÍGITOS ──────────────────────────────────────
 *
 * La lista vieja hacía `c.telefono?.includes(search)` sobre el texto crudo, así
 * que un número guardado como `+573001234567` NO empataba con "300 123" ni con
 * "300-123": el operador teclea el número como se lo dictaron, no como quedó
 * canonizado. Se comparan los dígitos de los dos lados y el problema desaparece
 * sin tocar el dato.
 *
 * No se usa `normalizeCustomerPhone`: ésa canoniza un número COMPLETO y devuelve
 * `null` para un fragmento como "300", que es justo lo que se teclea al buscar.
 *
 * Consulta vacía = empata con todos (no filtrar es distinto de no encontrar).
 */
export function coincideCliente(c: ClienteParaFiltro, consulta: string): boolean {
  const q = consulta.trim().toLowerCase();
  if (!q) return true;

  if (c.nombre?.toLowerCase().includes(q)) return true;
  if (c.email?.toLowerCase().includes(q)) return true;

  const digitos = soloDigitos(q);
  // Sólo si lo tecleado TIENE dígitos: sin esta guarda, `''.includes('')` haría
  // que cualquier texto empatara con cualquier teléfono.
  return Boolean(digitos && c.telefono && soloDigitos(c.telefono).includes(digitos));
}

export function buscarClientes<T extends ClienteParaFiltro>(clientes: T[], consulta: string): T[] {
  return clientes.filter(c => coincideCliente(c, consulta));
}
