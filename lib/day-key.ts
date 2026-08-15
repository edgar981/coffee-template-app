// ─── LA CLAVE DE DÍA Y SU `Date` LOCAL ───────────────────────────────────────
//
// `YYYY-MM-DD` es el formato que ya habla todo el panel: es lo que emite un
// `<input type="date">`, lo que viaja en `?desde=` / `?hasta=`, lo que guarda
// `Shipping.fecha_programada` y lo que compara `zonedDayKey`. Estas dos funciones
// son el puente hacia el `Date` que el calendario necesita, y de vuelta.
//
// ── POR QUÉ SALEN DE `DateRangePicker` A UN ARCHIVO PROPIO ──────────────────
//
// Vivían dentro de ese componente, y el segundo consumidor —el campo de fecha de
// Programar entrega— las habría copiado. Dos definiciones de la misma conversión
// es cómo terminan discrepando: es el mismo modo de falla que `razonDelServidor`
// y `cruzoMinimo`, que este repo ya pagó dos veces.
//
// ── Y POR QUÉ NO USAN `Date` UTC ────────────────────────────────────────────
//
// Se construyen y se leen con los componentes LOCALES del `Date` a propósito. Un
// `new Date('2026-05-14')` se parsea como MEDIANOCHE UTC, así que en Bogotá
// (UTC-5) ese `Date` es el 13 de mayo a las 19:00 — y un calendario que pinta
// "el día seleccionado" marcaría el 13. El día 14 no es un instante: es una
// etiqueta, y estas funciones la tratan como tal.
//
// La zona del NEGOCIO entra por otro lado: quien necesita "qué día es hoy en
// Bogotá" usa `zonedDayKey(new Date(), BUSINESS_TZ)` y recién ahí convierte.

/** `'2026-05-14'` → el `Date` de ese día a medianoche LOCAL. */
export function dayKeyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Un `Date` → `'2026-05-14'`, leyendo sus componentes locales. */
export function dateToDayKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}
