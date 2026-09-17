// Validación PURA del formulario de tarjeta de la API directa (§ API-DIRECTA-CAPTURA-TARJETA-1).
// La pantalla sólo DIBUJA — estas reglas viven acá para poder testear cada una sin montar un
// componente, mismo criterio que `opcionTransferencia` y `metodosDisponibles` en este directorio.
//
// NINGUNA de estas funciones habla con la red ni con nuestro servidor: son las reglas que
// deciden si vale la pena intentar tokenizar contra el proveedor. Los datos de tarjeta nunca
// llegan a este módulo desde un fetch ni salen de él hacia uno — sólo entran por parámetro y
// devuelven un booleano o una estructura parseada.

/**
 * El dígito verificador (Luhn) de un número de tarjeta, ignorando espacios. Rechaza cualquier
 * cosa que no sean 13 a 19 dígitos (el rango real de los esquemas en circulación) antes de sumar,
 * para no correr el checksum sobre basura.
 */
export function numeroTarjetaValido(numeroCrudo: string): boolean {
  const numero = numeroCrudo.replace(/\s+/g, '');
  if (!/^\d{13,19}$/.test(numero)) return false;

  let suma = 0;
  let doblar = false;
  for (let i = numero.length - 1; i >= 0; i--) {
    let digito = numero.charCodeAt(i) - 48; // '0' → 48
    if (doblar) {
      digito *= 2;
      if (digito > 9) digito -= 9;
    }
    suma += digito;
    doblar = !doblar;
  }
  return suma % 10 === 0;
}

export interface Vencimiento {
  /** 1–12 */
  mes: number;
  /** Año de 4 dígitos — un "AA" de 2 dígitos se interpreta como 2000+AA. */
  anio: number;
}

/**
 * Parsea "MM/AA" o "MM/AAAA" (con espacios sueltos alrededor de la barra tolerados). `null` si
 * la forma no es esa o el mes no es 1–12 — el llamador no tiene que distinguir "vacío" de
 * "ilegible", los dos son "no hay vencimiento que evaluar".
 */
export function parseVencimiento(valorCrudo: string): Vencimiento | null {
  const m = valorCrudo.trim().match(/^(\d{1,2})\s*\/\s*(\d{2}|\d{4})$/);
  if (!m) return null;
  const mes = Number(m[1]);
  if (mes < 1 || mes > 12) return null;
  const anio = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
  return { mes, anio };
}

/**
 * `true` si el vencimiento AÚN NO PASÓ, comparado contra `ahora` (por defecto el reloj real —
 * parámetro para poder testear un borde de mes sin esperar al calendario). Una tarjeta vence al
 * CIERRE de su mes: el mes actual todavía es válido.
 */
export function vencimientoVigente(v: Vencimiento, ahora: Date = new Date()): boolean {
  const anioActual = ahora.getFullYear();
  const mesActual = ahora.getMonth() + 1; // Date.getMonth() es 0–11
  if (v.anio !== anioActual) return v.anio > anioActual;
  return v.mes >= mesActual;
}

/** El código de seguridad: 3 o 4 dígitos (Amex usa 4; el resto, 3) — el formulario no pide marca,
 *  así que se aceptan los dos largos sin distinguir de qué esquema es la tarjeta. */
export function codigoSeguridadValido(cvvCrudo: string): boolean {
  return /^\d{3,4}$/.test(cvvCrudo.trim());
}

/** El nombre del titular: no vacío y con algo más que una inicial — no valida que sea un nombre
 *  real, sólo que no sea el campo en blanco o un solo carácter suelto. */
export function nombreTitularValido(nombreCrudo: string): boolean {
  return nombreCrudo.trim().length >= 2;
}

// ── DETECCIÓN DE RED EMISORA (§ CHECKOUT-DETECCION-EMISOR-BIN-1) ────────────────────────────
//
// PURAMENTE LOCAL: `detectarRedTarjeta` sólo MIRA el prefijo de lo que el comprador ya tecleó.
// No hace ningún fetch, no consulta ningún servicio de BIN (existen, y mandarles el prefijo es
// mandar dato de tarjeta a un tercero que nadie eligió), no llama a ningún endpoint propio, y no
// registra nada en consola. Entra por parámetro y devuelve una estructura — el mismo contrato
// que el resto de este archivo.
//
// QUÉ REDES SE RECONOCEN, Y DE DÓNDE SALIÓ LA LISTA: se buscó en este repositorio (CLAUDE.md,
// DECISIONS.md, `types/payment.ts`, `lib/pagos/*`, `services/checkout.service.ts`) algo
// registrado sobre qué redes acepta Wompi — NO HAY NADA. Ni un enum, ni una lista, ni un
// comentario. Así que se cubren las CUATRO redes de uso corriente en Colombia: Visa, Mastercard,
// American Express y Diners Club (las mismas que `codigoSeguridadValido`, arriba, ya distingue
// por largo de CVV — Amex a 4 dígitos, el resto a 3). Discover y otras redes regionales quedan
// fuera por ser marginales en este mercado; si el owner confirma otra, se agrega acá, en un solo
// lugar.
//
// El PREFIJO de cada red es un rango numérico de N dígitos (los rangos IIN publicados de cada
// esquema, no datos de ninguna tarjeta particular): Visa siempre empieza en 4; Mastercard en
// 51–55, o en el rango nuevo 2221–2720; Amex en 34 o 37; Diners en 36, 38–39, 300–305 o 309. Los
// cuatro son DISJUNTOS entre sí (ningún par de rangos comparte un mismo segundo dígito), así que
// nunca hay dos redes reconocidas a la vez para un mismo prefijo.
export type RedTarjeta = 'visa' | 'mastercard' | 'amex' | 'diners';

/**
 * Resultado de la detección — «todavía no se sabe» es un caso de primera clase, no un error:
 * - `'reconocida'`  — el prefijo tecleado ya identifica una red sin ambigüedad.
 * - `'desconocido'` — hace falta más dígitos: lo tecleado hasta ahora podría todavía completarse
 *   hacia una red reconocida. Adivinar acá sería peor que callar.
 * - `'no_reconocida'` — hay dígitos de sobra y NINGUNA red conocida puede empezar así. Un
 *   resultado válido, no una excepción: la tarjeta puede ser real y de una red que este
 *   formulario simplemente no distingue.
 */
export type DeteccionRedTarjeta =
  | { estado: 'reconocida'; red: RedTarjeta }
  | { estado: 'desconocido' }
  | { estado: 'no_reconocida' };

interface RangoIin {
  /** Los primeros `largo` dígitos, interpretados como número, deben caer en [min, max]. */
  min: number;
  max: number;
  largo: number;
}

const REDES_ORDEN: RedTarjeta[] = ['visa', 'mastercard', 'amex', 'diners'];

const RANGOS_POR_RED: Record<RedTarjeta, RangoIin[]> = {
  visa: [{ min: 4, max: 4, largo: 1 }],
  mastercard: [
    { min: 51, max: 55, largo: 2 },
    { min: 2221, max: 2720, largo: 4 },
  ],
  amex: [
    { min: 34, max: 34, largo: 2 },
    { min: 37, max: 37, largo: 2 },
  ],
  diners: [
    { min: 36, max: 36, largo: 2 },
    { min: 38, max: 39, largo: 2 },
    { min: 300, max: 305, largo: 3 },
    { min: 309, max: 309, largo: 3 },
  ],
};

/**
 * Compara el prefijo YA TECLEADO (`digitos`) contra un rango IIN de `largo` dígitos:
 * - si ya hay `largo` dígitos o más, el prefijo exacto decide (`coincide` / `descartado`);
 * - si hay MENOS, se completa por abajo con ceros y por arriba con nueves para obtener el
 *   intervalo de TODOS los números que ese prefijo podría llegar a ser, y se compara ese
 *   intervalo contra el rango — `posible` si se solapan, `descartado` si no.
 */
function evaluarRango(digitos: string, { min, max, largo }: RangoIin): 'coincide' | 'posible' | 'descartado' {
  if (digitos.length >= largo) {
    const prefijo = Number(digitos.slice(0, largo));
    return prefijo >= min && prefijo <= max ? 'coincide' : 'descartado';
  }
  const piso = Number(digitos.padEnd(largo, '0'));
  const techo = Number(digitos.padEnd(largo, '9'));
  return techo >= min && piso <= max ? 'posible' : 'descartado';
}

/**
 * Detecta la red emisora a partir de lo que el comprador lleva tecleado en el campo de número
 * (espacios de agrupación tolerados, igual que `numeroTarjetaValido`). No exige que el número
 * esté completo ni que pase Luhn — es una pista visual mientras se escribe, no una validación.
 */
export function detectarRedTarjeta(numeroCrudo: string): DeteccionRedTarjeta {
  const digitos = numeroCrudo.replace(/\D+/g, '');
  if (digitos.length === 0) return { estado: 'desconocido' };

  let algoEsPosible = false;
  for (const red of REDES_ORDEN) {
    let coincide = false;
    let posible = false;
    for (const rango of RANGOS_POR_RED[red]) {
      const resultado = evaluarRango(digitos, rango);
      if (resultado === 'coincide') coincide = true;
      else if (resultado === 'posible') posible = true;
    }
    if (coincide) return { estado: 'reconocida', red };
    if (posible) algoEsPosible = true;
  }
  return algoEsPosible ? { estado: 'desconocido' } : { estado: 'no_reconocida' };
}
