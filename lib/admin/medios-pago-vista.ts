import {
  METODOS_PAGO_ORDEN, CAMPOS_METODO, labelMetodo, metodoIncompleto, metodosDisponibles,
  type MetodoPagoGuardado, type MetodoPagoTipo, type MetodoCheckout,
} from '@/lib/checkout/metodos-pago';
import { ETIQUETA_PAGO_PASARELA, subtituloPagoPasarela } from '@/lib/pagos/metodos-pasarela';

// ─── La PRESENTACIÓN de «Cómo te pueden pagar» (§ PANEL-CONFIG-PAGOS-1) ──────────────────────
//
// Puro, capa 1. NINGUNA regla de "¿se muestra, y con qué?" se redefine acá — eso sigue
// viviendo en `metodoIncompleto`/`metodosDisponibles` (`lib/checkout/metodos-pago.ts`), la
// MISMA fuente que consulta el checkout real. Lo que este archivo agrega es sólo FORMATO para
// la lista del panel: las iniciales del chip, el "dato clave" resumido de una fila, el orden
// de la lista y la fila-por-método que el componente dibuja — de modo que la lista del panel y
// la vista previa del cliente lean el mismo dato, con el mismo criterio de qué está completo,
// sin una segunda definición que pudiera divergir.

/** Las dos letras del chip de cada fila — fijas, no derivadas de un nombre (a diferencia del
 *  avatar de usuario/negocio): acá lo que identifica es el TIPO, no una persona. */
export const INICIALES_MEDIO: Record<MetodoPagoTipo, string> = {
  nequi:         'NQ',
  daviplata:     'DP',
  breb:          'BB',
  transferencia: 'TR',
  efectivo:      'EF',
};

/** La nota fija de "Contra entrega" — la MISMA que ya mostraba el bloque antes de este slice
 *  (§ GRUPOS_PAGO), movida acá porque ahora también la necesita el "dato clave" de la fila. */
export const NOTA_CONTRAENTREGA = 'Solo Bogotá · el cliente paga al recibir, la orden nace contraentrega.';

/** El nombre de la fila — el label del tipo, con el banco pegado para transferencia (el
 *  prototipo lo pide así: "transferencia con su banco"). Sin banco guardado, es sólo el label;
 *  no es un campo nuevo, es el mismo `datos.banco` que ya existe. */
export function nombreMedioPago(m: MetodoPagoGuardado): string {
  if (m.tipo === 'transferencia') {
    const banco = (m.datos.banco ?? '').trim();
    return banco ? `${labelMetodo(m.tipo)} · ${banco}` : labelMetodo(m.tipo);
  }
  return labelMetodo(m.tipo);
}

/** Los últimos `n` dígitos de un valor — el valor completo si tiene `n` dígitos o menos. Sirve
 *  para enmascarar el número de cuenta en la lista ("···· 4821"), nunca para validar nada. */
function ultimosDigitos(valor: string, n = 4): string {
  const digitos = valor.replace(/\D/g, '');
  return digitos.length > n ? digitos.slice(-n) : digitos;
}

/**
 * El "dato clave" de la fila — lo que el cliente va a leer en el checkout, resumido para la
 * lista (§ el prototipo: "número, llave, cuenta con los últimos cuatro dígitos, a nombre de
 * quién"). `null` cuando el método no tiene nada propio que mostrar todavía.
 */
export function datoClaveMedioPago(m: MetodoPagoGuardado): string | null {
  switch (m.tipo) {
    case 'nequi':
    case 'daviplata': {
      const numero = (m.datos.numero ?? '').trim();
      return numero || null;
    }
    case 'breb': {
      const llave = (m.datos.llave ?? '').trim();
      return llave || null;
    }
    case 'transferencia': {
      const tipoCuenta = (m.datos.tipoCuenta ?? '').trim();
      const numeroCuenta = (m.datos.numeroCuenta ?? '').trim();
      const titular = (m.datos.titular ?? '').trim();
      const cuenta = numeroCuenta ? `···· ${ultimosDigitos(numeroCuenta)}` : '';
      const tipoYCuenta = [tipoCuenta, cuenta].filter(Boolean).join(' ');
      const linea = [tipoYCuenta, titular].filter(Boolean).join(' · ');
      return linea || null;
    }
    case 'efectivo':
      // Nada que configurar — el dato clave es la REGLA, no un valor que el dueño escribió.
      return NOTA_CONTRAENTREGA;
  }
}

export interface FilaMedioPago {
  medio:      MetodoPagoGuardado;
  tipo:       MetodoPagoTipo;
  iniciales:  string;
  nombre:     string;
  datoClave:  string | null;
  /** `true` si el checkout lo muestra (§ `metodoIncompleto`) — la MISMA regla, no una copia. */
  activo:     boolean;
  /** `null` si `activo`; si no, la frase "Falta …" que ya usa el checkout/editor viejo. */
  faltante:   string | null;
}

/** Una fila, a partir del método guardado. */
export function filaMedioPago(m: MetodoPagoGuardado): FilaMedioPago {
  const faltante = metodoIncompleto(m);
  return {
    medio:     m,
    tipo:      m.tipo,
    iniciales: INICIALES_MEDIO[m.tipo],
    nombre:    nombreMedioPago(m),
    datoClave: datoClaveMedioPago(m),
    activo:    faltante === null,
    faltante,
  };
}

/** La lista completa, en el orden CANÓNICO del checkout (`METODOS_PAGO_ORDEN`) — nunca el
 *  orden de guardado, que es justamente lo que esta tanda deja de ofrecer reordenar (§ el
 *  reporte del slice: sin asa de arrastre, por falta de un campo de orden propio). */
export function filasMediosPago(metodos: MetodoPagoGuardado[]): FilaMedioPago[] {
  const porTipo = new Map(metodos.map(m => [m.tipo, m] as const));
  return METODOS_PAGO_ORDEN
    .map(t => porTipo.get(t))
    .filter((m): m is MetodoPagoGuardado => m !== undefined)
    .map(filaMedioPago);
}

/** Los campos que el editor pide para un tipo — re-exportado desde `metodos-pago.ts` para que
 *  el componente no tenga que importar de dos sitios para dibujar una fila. */
export { CAMPOS_METODO };

// ─── «Así lo ve tu cliente» ───────────────────────────────────────────────────────────────────
//
// La vista previa reusa las MISMAS funciones que el checkout real, nunca una copia: si el
// checkout cambiara su criterio de "¿qué se muestra?", esta vista lo heredaría sola.

/**
 * Lo que el checkout mostraría con esta config — `metodosDisponibles`, la función real,
 * asumiendo Bogotá. La vista previa de Configuración no conoce la dirección de un cliente real
 * (eso lo decide el envío de CADA pedido, no la config del negocio), así que asume el caso que
 * deja ver el catálogo completo; `efectivo` lleva su propia nota en la fila para que quede
 * dicho que, fuera de Bogotá, el checkout real no lo ofrece.
 */
export function vistaClienteMetodos(metodos: MetodoPagoGuardado[]): MetodoCheckout[] {
  return metodosDisponibles(metodos, { isBogota: true });
}

export interface OpcionPasarelaVista {
  label: string;
  desc:  string;
}

/** La opción "Pago en línea" tal como la vería el cliente — el MISMO copy que genera el
 *  checkout real (`subtituloPagoPasarela`), nunca un texto inventado acá. */
export function vistaClientePasarela(metodosOtros: string[]): OpcionPasarelaVista {
  return { label: ETIQUETA_PAGO_PASARELA, desc: subtituloPagoPasarela(metodosOtros) };
}
