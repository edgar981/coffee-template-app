// ── LA REGLA DEL RANGO DEL CALENDARIO ───────────────────────────────────────
//
// react-day-picker, con un rango COMPLETO en `selected`, NO empieza uno nuevo al
// clickear: deja `from` clavado y mueve sólo `to`. Medido con `addToRange` de la v10:
//
//   selected {1 ago, 19 ago} + clic 16 ago  →  {1 ago, 16 ago}   ← el clic es el FINAL
//   selected undefined       + clic 16 ago  →  {16 ago, 16 ago}  ← empieza bien
//
// Para el operador eso significa que **no puede cambiar de rango sin limpiar filtros**:
// cada clic reinterpreta el final del rango viejo. Estaba EN PRODUCCIÓN en las tres
// pantallas que usan el picker; los presets lo tapaban, y en Pagos muerde SIEMPRE
// porque esa pantalla nunca tiene el rango vacío (abre en el mes en curso).
//
// La regla vive acá y no en el componente porque es una DECISIÓN —qué significa un clic
// sobre un rango ya elegido— y no plumbing: dentro del JSX, un `if` cambiado la rompe
// sin que nada lo note.

export interface RangoDeDias { desde: string | null; hasta: string | null }

/**
 * Qué rango queda tras un clic en el calendario.
 *
 * **Un rango COMPLETO + un clic = un rango NUEVO que empieza en ese día**, no un final
 * movido. Sobre un rango incompleto (o vacío) se acepta lo que propone la librería, que
 * ahí sí hace lo correcto.
 *
 * @param actual    el rango que la pantalla tiene hoy
 * @param sugerido  lo que propuso react-day-picker
 * @param diaClic   el día que el operador acaba de tocar (`YYYY-MM-DD`), si lo hubo
 */
export function rangoTrasClic(
  actual: RangoDeDias,
  sugerido: RangoDeDias,
  diaClic: string | null,
): RangoDeDias {
  const estabaCompleto = Boolean(actual.desde && actual.hasta);
  if (estabaCompleto && diaClic) return { desde: diaClic, hasta: null };
  return sugerido;
}
