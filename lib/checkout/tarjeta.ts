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
