import { z } from 'zod';
import { formatWhatsappDisplay } from '../config/site';
import { opcionTransferencia } from './transferencia';

// Los MÉTODOS de pago del checkout son una LISTA (§ PAGOS-METODOS-MODELO-1, revierte el modelo de
// "4 booleanos fijos + un número compartido"): el dueño AGREGA/QUITA métodos desde Configuración, y
// cada uno lleva SU PROPIA config. Set CERRADO de CINCO tipos — no un motor de métodos arbitrarios
// (por qué Wompi no es uno de ellos: el comentario junto a `MetodoPagoTipo`, abajo). ESTAR EN LA
// LISTA ES OFRECERLO: un solo eje, sin encendido/apagado aparte. La regla "¿se muestra, y con qué?"
// vive ACÁ (puro, capa 1): un método aparece si está en la lista *y* tiene sus datos completos. El
// checkout guarda el tipo como string libre en la orden — `derivarCondicionPago` sólo distingue el
// id EXACTO `'efectivo'` (§ el guardián de esa cadena); quitar un método no huerfaniza órdenes viejas.

// ESTE TIPO ES «LOS MÉTODOS QUE EL DUEÑO CONFIGURA EN SU PANEL» — no todo lo que puede pagar una
// orden. Wompi NO entra acá, y no por olvido: es un toggle de DESPLIEGUE, no de panel. Se enciende
// al configurar el despliegue de un cliente (una decisión que se toma una vez, al contratar — el
// mismo patrón que ya sigue el mark), no algo que el dueño
// prenda o apague desde Configuración como hace con Nequi o Bre-B. Sumar `'wompi'` a esta lista le
// daría un toggle de panel que la pasarela no tiene.
//
// `WOMPI` SÍ va a vivir en el OTRO enum de método de pago — `MetodoPago` en
// `packages/core/prisma/schema.prisma` (el de mayúsculas, el de `Payment`) — porque ahí la pregunta
// es otra: no «qué le ofrezco a elegir al cliente», sino «cómo llegó la plata». Ahí es donde entra.
export type MetodoPagoTipo = 'nequi' | 'daviplata' | 'breb' | 'transferencia' | 'efectivo';

/** El orden CANÓNICO — el que ve el cliente en el checkout, y el que devuelve `parseMetodosPago`
 *  sin importar el orden de guardado. */
export const METODOS_PAGO_ORDEN: MetodoPagoTipo[] = ['nequi', 'daviplata', 'breb', 'transferencia', 'efectivo'];

const TIPOS_VALIDOS = new Set<string>(METODOS_PAGO_ORDEN);

/**
 * El `z.enum` del tipo de método, DERIVADO de `METODOS_PAGO_ORDEN` — no una lista literal
 * repetida a mano (§ METODOS-TRES-LISTAS-1: la trampa era `app/api/checkout/route.ts`
 * re-escribiendo los cinco tipos como un arreglo aparte, sin importar esta fuente). Un método
 * nuevo agregado ACÁ queda aceptado por el checkout sin tocar el endpoint. Mismo cast que ya
 * usa `lib/config/site-settings-schema.ts` (zod exige una tupla no vacía para `z.enum`, y
 * `METODOS_PAGO_ORDEN` es un array plano).
 */
export const metodoPagoTipoSchema = z.enum(METODOS_PAGO_ORDEN as [MetodoPagoTipo, ...MetodoPagoTipo[]]);

/** Un método tal como vive en `SiteSetting.metodosPago`: su tipo + sus datos (todo string). */
export interface MetodoPagoGuardado {
  tipo: MetodoPagoTipo;
  datos: Record<string, string>;
}

export interface MetodoCheckout {
  id: MetodoPagoTipo;
  label: string;
  /** La línea que ve el cliente ("Enviar a 315 …", "Bancolombia · Ahorros · …"). Con VARIAS
   *  cuentas de transferencia (§ PAGOS-VARIAS-CUENTAS-1) es la frase introductoria
   *  (`INTRO_VARIAS_CUENTAS`) y el detalle de cada cuenta vive en `cuentas`. */
  desc: string;
  /** SÓLO transferencia con 2+ cuentas COMPLETAS: una línea por cuenta ("Bancolombia · Ahorros
   *  · … · Titular"). Con una sola cuenta queda `undefined` — el checkout sigue viéndose
   *  BYTE-IDÉNTICO a como se veía con una sola cuenta posible (§ el reporte del slice). */
  cuentas?: string[];
}

/** La frase que introduce la lista cuando hay VARIAS cuentas de transferencia completas — el
 *  checkout sigue ofreciendo UNA sola opción "Transferencia Bancaria" (el id que viaja al
 *  servidor no cambia), pero con más de una cuenta no puede quedarse en una sola línea de
 *  `desc`: tiene que decir que cualquiera de las cuentas sirve. */
export const INTRO_VARIAS_CUENTAS = 'Puedes transferir a cualquiera de estas cuentas:';

function trim(v: string | undefined): string {
  return (v ?? '').trim();
}

/**
 * LA FRASE QUE DECLARA QUE ESTE MÉTODO ES MANUAL (§ CHECKOUT-COPY-NEQUI-MANUAL-1).
 *
 * Nequi, Daviplata y Bre-B son instrumentos que TAMBIÉN puede cobrar la pasarela API directa
 * (`lib/pagos/metodos-pasarela.ts`) — cuando eso pasa, los dos métodos conviven en el MISMO
 * paso de pago (§ `SelectorMetodoPasarela`, `components/storefront/checkout/`), y compartir el
 * nombre del riel es coincidencia, no el mismo producto: uno lo confirma una persona del
 * equipo, el otro se confirma solo. `DECISIONS.md`, `BREB-SOLAPAMIENTO-ASIENTO-1` §4
 * (2026-09-16) ya fijó la regla para el caso de Bre-B — "SON DOS MÉTODOS DISTINTOS […] Lo que
 * hay que resolver es COPY, no arquitectura" — y esta constante es esa resolución, aplicada a
 * los TRES tipos manuales que pueden coincidir con un medio de la pasarela (no sólo Bre-B):
 * nequi, daviplata, breb. `transferencia` y `efectivo` quedan AFUERA — ninguno comparte nombre
 * de riel con un tipo de la pasarela (§ el reporte del slice).
 *
 * Describe la CONSECUENCIA que vive el comprador, no el mecanismo: no dice "esto es manual" ni
 * nombra una pasarela, que el comprador no tiene por qué conocer. Y NO promete un plazo — sólo
 * el HECHO de que un humano lo revisa, nunca un "en N horas" que el negocio no puede garantizar.
 *
 * UNA sola fuente para los tres tipos: dos copias de la misma frase es cómo una tanda futura las
 * deja divergir sin que nadie lo note (misma familia que `razonDelServidor`/`cruzoMinimo`,
 * CLAUDE.md).
 *
 * TEXTO PROVISIONAL — PENDIENTE DE TEXTO DEL OWNER (§ el reporte del slice).
 */
export const CONFIRMA_EL_EQUIPO = 'El equipo confirma tu pago.';

/** La instrucción "Enviar a <número>" compartida por Nequi y Daviplata — mismo formateo de
 *  siempre (`formatWhatsappDisplay` sin el `+57 `), + `CONFIRMA_EL_EQUIPO` (arriba). `null` =
 *  sin número, incompleto. */
function movilDesc(datos: Record<string, string>): string | null {
  const numero = trim(datos.numero);
  if (!numero) return null;
  return `Enviar a ${formatWhatsappDisplay(numero).replace(/^\+57\s*/, '')}. ${CONFIRMA_EL_EQUIPO}`;
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
  // sólo la exhibe para que el cliente la copie. + `CONFIRMA_EL_EQUIPO` (arriba).
  return llave ? `Enviar a la llave ${llave}. ${CONFIRMA_EL_EQUIPO}` : null;
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
 * La CLAVE de identidad de UN medio guardado (§ PAGOS-VARIAS-CUENTAS-1) — el tipo solo, salvo
 * `transferencia`, que puede tener VARIAS cuentas y por eso lleva además su `datos.id` (el
 * identificador estable que el sistema genera al crear la cuenta, nunca la posición ni un nombre
 * editable). Una cuenta LEGADO sin `id` —guardada antes de esta tanda; como mucho una, porque la
 * validación vieja prohibía repetir `transferencia`— cae a la cadena vacía, así que sigue siendo
 * identificable hasta que se autorrepare con un id real al guardarla de nuevo. La usan el panel
 * (identificar qué fila se edita/quita) y `FilaMedioPago.clave` (`lib/admin/medios-pago-vista.ts`)
 * — una sola definición para que las dos no puedan divergir.
 */
export function claveMedioPago(m: MetodoPagoGuardado): string {
  return m.tipo === 'transferencia' ? `transferencia:${m.datos.id ?? ''}` : m.tipo;
}

/**
 * Lee `SiteSetting.metodosPago` (el JSON crudo de la base) SOFT — nunca lanza. Descarta lo que no
 * sea un objeto con `tipo` dentro del set cerrado, normaliza `datos` a cadenas, y devuelve la
 * lista en el ORDEN CANÓNICO (no el de guardado). Un dato raro no puede tumbar el checkout —
 * mismo criterio SOFT que el resolver de SiteContent.
 *
 * `transferencia` es la EXCEPCIÓN del dedup (§ PAGOS-VARIAS-CUENTAS-1): el negocio puede tener
 * varias cuentas, así que TODAS se conservan, en su orden de aparición. Los demás cuatro tipos
 * siguen siendo singleton — el PRIMERO de un tipo repetido gana, igual que siempre.
 */
export function parseMetodosPago(valor: unknown): MetodoPagoGuardado[] {
  if (!Array.isArray(valor)) return [];
  const porTipoUnico = new Map<MetodoPagoTipo, MetodoPagoGuardado>();
  const transferencias: MetodoPagoGuardado[] = [];
  for (const item of valor) {
    if (!item || typeof item !== 'object') continue;
    const tipoRaw = (item as { tipo?: unknown }).tipo;
    if (typeof tipoRaw !== 'string' || !TIPOS_VALIDOS.has(tipoRaw)) continue;
    const tipo = tipoRaw as MetodoPagoTipo;
    const datosRaw = (item as { datos?: unknown }).datos;
    const datos: Record<string, string> = {};
    if (datosRaw && typeof datosRaw === 'object') {
      for (const [k, v] of Object.entries(datosRaw as Record<string, unknown>)) {
        datos[k] = typeof v === 'string' ? v : String(v ?? '');
      }
    }
    if (tipo === 'transferencia') {
      transferencias.push({ tipo, datos });
      continue;
    }
    if (porTipoUnico.has(tipo)) continue; // el PRIMERO de un tipo repetido gana
    porTipoUnico.set(tipo, { tipo, datos });
  }
  const out: MetodoPagoGuardado[] = [];
  for (const tipo of METODOS_PAGO_ORDEN) {
    if (tipo === 'transferencia') { out.push(...transferencias); continue; }
    const m = porTipoUnico.get(tipo);
    if (m) out.push(m);
  }
  return out;
}

/**
 * Los métodos que el checkout MUESTRA, en orden CANÓNICO. Un método aparece si está EN LA LISTA
 * *y* tiene sus datos completos; `efectivo` además sólo en Bogotá (`isBogota`, regla de ENVÍO, no
 * de config). Puede devolver VACÍO — el checkout lo maneja con su guarda defensiva.
 *
 * `transferencia` sigue siendo UNA sola opción (§ PAGOS-VARIAS-CUENTAS-1: el id que viaja al
 * servidor sigue siendo `'transferencia'`, la ruta del checkout no cambia) aunque el negocio
 * tenga varias cuentas — cada cuenta INCOMPLETA se descarta por su cuenta (misma regla de
 * siempre, por cuenta), y entre las que quedan completas: CERO → el método no aparece (igual que
 * hoy); UNA → `desc` es su línea, byte-idéntico a como se veía con una sola cuenta posible; DOS O
 * MÁS → `desc` pasa a ser la frase introductoria y `cuentas` lleva una línea por cuenta.
 */
export function metodosDisponibles(metodos: MetodoPagoGuardado[], opts: { isBogota: boolean }): MetodoCheckout[] {
  const out: MetodoCheckout[] = [];
  for (const tipo of METODOS_PAGO_ORDEN) {
    if (tipo === 'transferencia') {
      const cuentasGuardadas = metodos.filter(x => x.tipo === tipo);
      if (cuentasGuardadas.length === 0) continue;
      const descs = cuentasGuardadas
        .map(m => TIPOS[tipo].descripcion(m.datos))
        .filter((d): d is string => d !== null);
      if (descs.length === 0) continue;
      out.push(
        descs.length === 1
          ? { id: tipo, label: TIPOS[tipo].label, desc: descs[0] }
          : { id: tipo, label: TIPOS[tipo].label, desc: INTRO_VARIAS_CUENTAS, cuentas: descs },
      );
      continue;
    }
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
