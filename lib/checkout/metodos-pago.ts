import { formatWhatsappDisplay } from '../config/site';
import { opcionTransferencia } from './transferencia';

// Los MÉTODOS de pago del checkout son una LISTA (§ PAGOS-METODOS-MODELO-1, revierte el modelo de
// "4 booleanos fijos + un número compartido"): el dueño AGREGA/QUITA métodos desde Configuración, y
// cada uno lleva SU PROPIA config. Set CERRADO de CINCO tipos — no un motor de métodos arbitrarios
// (§ backlog: Wompi/pasarelas). ESTAR EN LA LISTA ES OFRECERLO: un solo eje, sin encendido/apagado
// aparte. La regla "¿se muestra, y con qué?" vive ACÁ (puro, capa 1): un método aparece si está en
// la lista *y* tiene sus datos completos. El checkout guarda el tipo como string libre en la orden
// — `derivarCondicionPago` sólo distingue el id EXACTO `'efectivo'` (§ el guardián de esa cadena);
// quitar un método no huerfaniza órdenes viejas.

export type MetodoPagoTipo = 'nequi' | 'daviplata' | 'breb' | 'transferencia' | 'efectivo';

/** El orden CANÓNICO — el que ve el cliente en el checkout, y el que devuelve `parseMetodosPago`
 *  sin importar el orden de guardado. */
export const METODOS_PAGO_ORDEN: MetodoPagoTipo[] = ['nequi', 'daviplata', 'breb', 'transferencia', 'efectivo'];

const TIPOS_VALIDOS = new Set<string>(METODOS_PAGO_ORDEN);

/** Un método tal como vive en `SiteSetting.metodosPago`: su tipo + sus datos (todo string). */
export interface MetodoPagoGuardado {
  tipo: MetodoPagoTipo;
  datos: Record<string, string>;
}

export interface MetodoCheckout {
  id: MetodoPagoTipo;
  label: string;
  /** La línea que ve el cliente ("Enviar a 315 …", "Bancolombia · Ahorros · …"). */
  desc: string;
}

function trim(v: string | undefined): string {
  return (v ?? '').trim();
}

/** La instrucción "Enviar a <número>" compartida por Nequi y Daviplata — mismo formateo de
 *  siempre (`formatWhatsappDisplay` sin el `+57 `). `null` = sin número, incompleto. */
function movilDesc(datos: Record<string, string>): string | null {
  const numero = trim(datos.numero);
  if (!numero) return null;
  return `Enviar a ${formatWhatsappDisplay(numero).replace(/^\+57\s*/, '')}`;
}

/** La opción de transferencia, DERIVADA de `opcionTransferencia` (la definición única de "cuenta
 *  servible") — traduce los nombres de `datos` (banco/tipoCuenta/numeroCuenta/titular) a los que
 *  ese helper espera, sin cambiar su interfaz ni su regla. */
function transferenciaDesc(datos: Record<string, string>): string | null {
  const op = opcionTransferencia({
    bancoNombre:       datos.banco ?? null,
    bancoTipoCuenta:   datos.tipoCuenta ?? null,
    bancoNumeroCuenta: datos.numeroCuenta ?? null,
    bancoTitular:      datos.titular ?? null,
  });
  return op ? op.desc : null;
}

function brebDesc(datos: Record<string, string>): string | null {
  const llave = trim(datos.llave);
  // La llave se MUESTRA tal cual la escribió el dueño: el checkout no la valida ni la parsea,
  // sólo la exhibe para que el cliente la copie.
  return llave ? `Enviar a la llave ${llave}` : null;
}

interface TipoMetodoDef {
  label: string;
  /** El campo requerido que, si falta, deja el método INCOMPLETO — y la frase para decirlo. */
  faltante: string;
  /** La instrucción que ve el cliente, o `null` si al método le faltan sus datos. */
  descripcion: (datos: Record<string, string>) => string | null;
}

const TIPOS: Record<MetodoPagoTipo, TipoMetodoDef> = {
  nequi:         { label: 'Nequi',                  faltante: 'Falta el número', descripcion: movilDesc },
  daviplata:     { label: 'Daviplata',               faltante: 'Falta el número', descripcion: movilDesc },
  breb:          { label: 'Bre-B',                   faltante: 'Falta la llave',  descripcion: brebDesc },
  transferencia: { label: 'Transferencia Bancaria',  faltante: 'Falta la cuenta', descripcion: transferenciaDesc },
  efectivo:      { label: 'Contra entrega',          faltante: '',                descripcion: () => 'Solo disponible en Bogotá D.C.' },
};

/** Los campos que el EDITOR pide para cada tipo (vacío = nada que configurar). */
export const CAMPOS_METODO: Record<MetodoPagoTipo, { name: string; label: string }[]> = {
  nequi:         [{ name: 'numero', label: 'Número' }],
  daviplata:     [{ name: 'numero', label: 'Número' }],
  breb:          [{ name: 'llave', label: 'Llave Bre-B' }],
  transferencia: [
    { name: 'banco',        label: 'Banco' },
    { name: 'tipoCuenta',   label: 'Tipo de cuenta' },
    { name: 'numeroCuenta', label: 'Número de cuenta' },
    { name: 'titular',      label: 'Titular (opcional)' },
  ],
  efectivo: [],
};

export function labelMetodo(tipo: MetodoPagoTipo): string {
  return TIPOS[tipo].label;
}

/**
 * Lee `SiteSetting.metodosPago` (el JSON crudo de la base) SOFT — nunca lanza. Descarta lo que no
 * sea un objeto con `tipo` dentro del set cerrado, se queda con el PRIMERO de cada tipo repetido,
 * normaliza `datos` a cadenas, y devuelve la lista en el ORDEN CANÓNICO (no el de guardado). Un
 * dato raro no puede tumbar el checkout — mismo criterio SOFT que el resolver de SiteContent.
 */
export function parseMetodosPago(valor: unknown): MetodoPagoGuardado[] {
  if (!Array.isArray(valor)) return [];
  const porTipo = new Map<MetodoPagoTipo, MetodoPagoGuardado>();
  for (const item of valor) {
    if (!item || typeof item !== 'object') continue;
    const tipoRaw = (item as { tipo?: unknown }).tipo;
    if (typeof tipoRaw !== 'string' || !TIPOS_VALIDOS.has(tipoRaw)) continue;
    const tipo = tipoRaw as MetodoPagoTipo;
    if (porTipo.has(tipo)) continue; // el PRIMERO de un tipo repetido gana
    const datosRaw = (item as { datos?: unknown }).datos;
    const datos: Record<string, string> = {};
    if (datosRaw && typeof datosRaw === 'object') {
      for (const [k, v] of Object.entries(datosRaw as Record<string, unknown>)) {
        datos[k] = typeof v === 'string' ? v : String(v ?? '');
      }
    }
    porTipo.set(tipo, { tipo, datos });
  }
  return METODOS_PAGO_ORDEN.filter(t => porTipo.has(t)).map(t => porTipo.get(t)!);
}

/**
 * Los métodos que el checkout MUESTRA, en orden CANÓNICO. Un método aparece si está EN LA LISTA
 * *y* tiene sus datos completos; `efectivo` además sólo en Bogotá (`isBogota`, regla de ENVÍO, no
 * de config). Puede devolver VACÍO — el checkout lo maneja con su guarda defensiva.
 */
export function metodosDisponibles(metodos: MetodoPagoGuardado[], opts: { isBogota: boolean }): MetodoCheckout[] {
  const out: MetodoCheckout[] = [];
  for (const tipo of METODOS_PAGO_ORDEN) {
    const m = metodos.find(x => x.tipo === tipo);
    if (!m) continue;
    if (tipo === 'efectivo' && !opts.isBogota) continue;
    const desc = TIPOS[tipo].descripcion(m.datos);
    if (desc === null) continue;
    out.push({ id: tipo, label: TIPOS[tipo].label, desc });
  }
  return out;
}

/**
 * `null` si el método tiene todo lo que necesita para mostrarse; si no, la frase "Falta …" que el
 * editor pinta en su chip ámbar. `efectivo` nunca está incompleto (nada que configurar).
 */
export function metodoIncompleto(m: MetodoPagoGuardado): string | null {
  return TIPOS[m.tipo].descripcion(m.datos) === null ? TIPOS[m.tipo].faltante : null;
}
