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
// QUÉ REDES SE RECONOCEN, Y DE DÓNDE SALIÓ LA LISTA: Visa, Mastercard, American Express y Diners
// Club partieron de una SUPOSICIÓN — "de uso corriente en Colombia", sin fuente del proveedor
// detrás, porque en su momento no se encontró nada registrado en este repositorio (CLAUDE.md,
// DECISIONS.md, `types/payment.ts`, `lib/pagos/*`, `services/checkout.service.ts`) sobre qué
// redes acepta Wompi. ESE COMENTARIO YA NO ES CIERTO: `SPIKE-REDES-QUE-PROCESA-1` tokenizó de
// verdad contra el sandbox del proveedor y MIDIÓ que UnionPay SÍ procesa — y este detector la
// marcaba `no_reconocida`. Es el defecto INVERSO al que parece obvio: no le prometíamos al
// comprador un cobro que iba a fallar, le NEGÁBAMOS uno que sí iba a funcionar (CHECKOUT-
// DETECTOR-UNIONPAY-1). Se agrega acá, con el rango publicado de su esquema.
//
// Discover sigue fuera por marginal en este mercado (sin medir contra el proveedor). El mismo
// spike nombra OTRA red más, que el proveedor cita en su propio mensaje de error, pero NINGÚN
// número de prueba logró tokenizarla: no hay forma de afirmar ni descartar que el proveedor la
// procese. Agregarla sin esa confirmación crearía el defecto CONTRARIO al que este slice arregla
// (prometer una red que el proveedor rechace), así que se queda AFUERA — pregunta abierta,
// `CHECKOUT-RED-SIN-CONFIRMAR-1`, hasta que algo la tokenice de verdad o el proveedor la
// descarte explícitamente.
//
// El PREFIJO de cada red es un rango numérico de N dígitos (los rangos IIN publicados de cada
// esquema, no datos de ninguna tarjeta particular): Visa siempre empieza en 4; Mastercard en
// 51–55, o en el rango nuevo 2221–2720; Amex en 34 o 37; Diners en 36, 38–39, 300–305 o 309;
// UnionPay en 62. Las cinco son DISJUNTAS entre sí (ningún par de rangos comparte un mismo
// segundo dígito), así que nunca hay dos redes reconocidas a la vez para un mismo prefijo.
export type RedTarjeta = 'visa' | 'mastercard' | 'amex' | 'diners' | 'unionpay';

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

const REDES_ORDEN: RedTarjeta[] = ['visa', 'mastercard', 'amex', 'diners', 'unionpay'];

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
  unionpay: [{ min: 62, max: 62, largo: 2 }],
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

// ── FORMATEO DE PANTALLA (§ CHECKOUT-FORMATEO-CAMPOS-TARJETA-1) ─────────────────────────────
//
// TODO lo de acá abajo es formateo VISUAL, nunca dato: entra un string tecleado/pegado y sale un
// string para mostrar en el input. Ninguna de estas funciones habla con la red ni decide si un
// valor es válido — eso lo sigue haciendo `numeroTarjetaValido`/`parseVencimiento`, arriba, sobre
// el MISMO valor formateado (los separadores que insertan estas funciones ya los toleran esas
// dos: `numeroTarjetaValido` los quita con `replace(/\s+/g, '')` y `parseVencimiento` espera la
// barra). Lo que viaja al proveedor sigue sin separadores: `FormularioTarjeta` arma el body de
// `tokenizarTarjeta` quitándolos (`numero.replace(/\s+/g, '')`) y `parseVencimiento` entrega
// `{ mes, anio }` ya separados de la barra — el string CON separador nunca sale de la pantalla.

const TOPE_DIGITOS_NUMERO = 19; // el mismo tope de `numeroTarjetaValido`.
const TOPE_DIGITOS_VENCIMIENTO = 6; // MM (2) + AAAA (4), el año largo que `parseVencimiento` acepta.

/**
 * Agrupa el número de tarjeta en bloques de 4 separados por un espacio ("4242 4242 4242 4242").
 * Descarta cualquier carácter que no sea dígito ANTES de reagrupar — así da igual si `valorCrudo`
 * ya trae separadores (se re-derivan) o no: pegar formateado o pegar en crudo termina en el mismo
 * resultado. Cortado a 19 dígitos, el tope real de un PAN.
 */
export function formatearNumeroTarjeta(valorCrudo: string): string {
  const digitos = valorCrudo.replace(/\D+/g, '').slice(0, TOPE_DIGITOS_NUMERO);
  return digitos.replace(/(\d{4})(?=\d)/g, '$1 ');
}

/**
 * Formatea el vencimiento como "MM/AA" (o "MM/AAAA" si se pega un año largo): la barra se inserta
 * SOLA apenas hay 2 dígitos —"12" pasa a "12/" sin que el comprador la teclee—, y desde ahí el
 * resto de los dígitos tecleados o pegados cae detrás de ella. Con 0 o 1 dígito no hay mes
 * completo todavía, así que no se inserta nada. Igual que el número: cualquier separador que ya
 * traiga `valorCrudo` se descarta y se re-deriva, así que pegar con o sin barra da lo mismo.
 */
export function formatearVencimientoCampo(valorCrudo: string): string {
  const digitos = valorCrudo.replace(/\D+/g, '').slice(0, TOPE_DIGITOS_VENCIMIENTO);
  if (digitos.length < 2) return digitos;
  return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
}

/** Cuántos dígitos hay en `valor` antes (sin incluir) la posición `hasta` — un separador no cuenta. */
function digitosAntesDe(valor: string, hasta: number): number {
  let n = 0;
  for (let i = 0; i < hasta && i < valor.length; i++) {
    if (/\d/.test(valor[i])) n++;
  }
  return n;
}

/**
 * La posición, dentro de `formateado`, que queda INMEDIATAMENTE DESPUÉS de haber visto `n`
 * dígitos (o al final si `formateado` tiene menos de `n` dígitos). Un separador nunca "atrapa" el
 * cursor: si el dígito `n` es el último antes de un separador, el cursor queda pegado a ese
 * dígito, nunca del otro lado.
 */
function cursorTrasNDigitos(formateado: string, n: number): number {
  if (n <= 0) return 0;
  let vistos = 0;
  for (let i = 0; i < formateado.length; i++) {
    if (/\d/.test(formateado[i])) {
      vistos++;
      if (vistos === n) return i + 1;
    }
  }
  return formateado.length;
}

export interface CampoTarjetaFormateado {
  valor: string;
  /** Dónde debe quedar el cursor dentro de `valor` tras reformatear. */
  cursor: number;
}

/**
 * Reformatea el valor de un campo tras una edición (tecla, borrado o pegado) y recoloca el
 * cursor por CANTIDAD DE DÍGITOS vistos, no por índice de carácter — el índice cambia cada vez
 * que un separador se inserta o se retira, y por eso reposicionar por índice es lo que hace que
 * un input enmascarado "salte al final" o quede atrapado contra un separador que se reinserta
 * solo. `valorNuevo`/`cursorNuevo` son el valor y la posición del cursor QUE YA DEJÓ el navegador
 * tras la edición (p. ej. `e.target.value` y `e.target.selectionStart`) — esta función no sabe
 * nada de eventos del DOM, sólo recibe strings y números.
 *
 * Cubre las cuatro formas de editar que le importan a un campo enmascarado:
 * - teclear de corrido: el cursor avanza con cada dígito nuevo, nunca se cae para atrás;
 * - borrar sobre un separador: al borrar el carácter separador el conteo de dígitos ANTES del
 *   cursor no cambia, así que el cursor reformateado queda pegado al dígito de al lado — el
 *   próximo borrado sí quita un dígito real, nunca hace falta borrar "contra la nada";
 * - pegar (con o sin separadores): el cursor pegado al final del pegado cae al final del
 *   resultado reformateado, sin importar cuántos separadores insertó o quitó el formateo.
 */
export function reformatearCampoTarjeta(
  formatear: (valor: string) => string,
  valorNuevo: string,
  cursorNuevo: number,
): CampoTarjetaFormateado {
  const digitosAntesDelCursor = digitosAntesDe(valorNuevo, cursorNuevo);
  const valor = formatear(valorNuevo);
  return { valor, cursor: cursorTrasNDigitos(valor, digitosAntesDelCursor) };
}
