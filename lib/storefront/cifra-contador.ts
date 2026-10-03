// lib/storefront/cifra-contador.ts — § ORIGEN-CONTADOR-MILES-1
//
// EL DEFECTO (medido leyendo `OrigenContador`, `components/storefront/home/Origen.tsx`): el
// contador de la banda Origen sólo animaba si el texto ENTERO cumplía `/^-?\d+$/`. "1.600" (el
// separador de miles que cualquiera tecleraría para "mil seiscientos" en es-CO) NO lo cumple — el
// punto no es un dígito —, así que caía al mismo camino que "N/D": se mostraba LITERAL, sin
// animar. "12" y "52" (hectáreas, años) sí pasaban porque son números chicos sin separador — de ahí
// la asimetría que el owner reportó: dos cifras contaban y la tercera no.
//
// `Number("1.600")` da 1.6, no 1600 — el comentario viejo ya lo advertía (el motivo de exigir el
// string ENTERO en vez de "despojar caracteres y parsear lo que quede") —, así que el separador no
// se puede ignorar a ciegas: hay que RECONOCERLO y usarlo, no descartarlo.
//
// `cifraContador` extiende el reconocimiento viejo (entero sin separador) a dos formas MÁS: grupos
// de EXACTAMENTE tres dígitos separados por el MISMO carácter, punto o coma ("1.600", "12.500",
// "1,600", "1.234.567"). Cualquier otra cosa — vacío, "N/D", un grupo de 1 o 2 dígitos ("1.6",
// "1.60", el caso que corrompía el dato), separadores mezclados — sigue sin ser válida: el llamador
// la muestra TAL CUAL y no anima. Preferir callar/mostrar-literal a inventar un cero es el MISMO
// criterio que ya regía el regex viejo (§ CLAUDE.md, el resto del storefront con datos que no se
// pueden validar) — esta función no lo relaja, sólo amplía qué cuenta como "válido".
//
// `formatoCifraContador` es la mitad de RENDER: dado un valor numérico (el paso intermedio del
// conteo, o el destino final) y el separador detectado, devuelve el string a mostrar CON ese mismo
// separador — "0 → 1.600" cuenta con puntos si el dato los tenía, con comas si los tenía comas.
// `separador: null` (el caso sin separador, hectáreas/años) se queda EXACTAMENTE como hoy
// (`toLocaleString('es-CO')`, el mismo call que `OrigenContador` ya hacía) — "sin separador, como
// hoy" es literal, no una aproximación: no se reimplementa con un formateador propio un caso que ya
// funcionaba.

export interface CifraContador {
  /** El valor numérico ENTERO, sin el separador — lo que `useContadorAnimado` cuenta hacia. */
  valor: number;
  /** El carácter que el dato usaba para agrupar de tres en tres, o `null` si no llevaba ninguno. */
  separador: '.' | ',' | null;
}

// Entero sin separador — el regex viejo, intacto. Sigue siendo el camino de "12"/"52".
const SIN_SEPARADOR = /^-?\d+$/;

// Entero CON separador de miles: 1-3 dígitos, luego uno o más grupos de EXACTAMENTE 3, todos con el
// MISMO carácter (la referencia hacia atrás `\1` es lo que impide "1.600,50" o "1.60,000" — un
// separador no puede cambiar de carácter a mitad del número). Un grupo de 1 o 2 dígitos después del
// primer separador ("1.6", "1.60") NO matchea el `\d{3}` obligatorio: sigue siendo inválido, el
// mismo caso que el comentario de `Number('1.600')` ya advertía.
const CON_SEPARADOR_MILES = /^-?\d{1,3}([.,])\d{3}(?:\1\d{3})*$/;

/**
 * Reconoce un entero, con o sin separador de miles consistente. `null` para cualquier otra cosa
 * (vacío, no-numérico, un grupo mal formado) — el llamador decide qué hacer con el string literal.
 */
export function cifraContador(texto: string): CifraContador | null {
  const limpio = texto.trim();
  if (SIN_SEPARADOR.test(limpio)) {
    return { valor: Number(limpio), separador: null };
  }
  const m = CON_SEPARADOR_MILES.exec(limpio);
  if (!m) return null;
  const separador = m[1] as '.' | ',';
  return { valor: Number(limpio.split(separador).join('')), separador };
}

/**
 * El string a mostrar para un valor (paso intermedio del conteo, o el destino final), con el MISMO
 * separador que el dato original llevaba. `separador: null` reproduce el formateo de siempre
 * (`toLocaleString('es-CO')`) para el caso sin separador — no cambia nada para hectáreas/años.
 */
export function formatoCifraContador(valor: number, separador: '.' | ',' | null): string {
  const entero = Math.round(valor);
  if (separador === null) return entero.toLocaleString('es-CO');
  const signo = entero < 0 ? '-' : '';
  const digitos = String(Math.abs(entero));
  const agrupado = digitos.replace(/\B(?=(\d{3})+(?!\d))/g, separador);
  return signo + agrupado;
}
