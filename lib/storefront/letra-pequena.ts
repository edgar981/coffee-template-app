// LA LETRA PEQUEÑA de /suscripciones (§ ONIX-SUSCRIPCION-LETRA-CIERRE-1) — la composición
// 'letraPequena' de `suscripcionFaq` (§ PreguntasFrecuentes.tsx): un acordeón de preguntas donde
// SÓLO UNA respuesta está abierta a la vez. Puro, sin React, para poder afirmar la regla en un test
// sin jsdom (el repo no lo tiene) — mismo criterio que el resto de las reglas de `lib/storefront/`.

/** Clickear la pregunta YA abierta la CIERRA; clickear otra la ABRE (y cierra la anterior, por
 *  construcción: el estado es un único índice nullable, nunca un conjunto). Replica el JS de la
 *  maqueta de Onix (`.scratch/onix-paginas/onix-suscripciones-nosotros.html`, el handler de
 *  `.preg button`: cierra TODAS, luego abre la clickeada sólo si no era ya la abierta). */
export function siguienteAbierta(actual: number | null, clic: number): number | null {
  return actual === clic ? null : clic;
}
