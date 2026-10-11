// § EDITOR-PUBLICAR-CONSISTENTE-1 — `resumenCambios` (lib/admin/resumen-cambios.ts, fuera de
// `touches:` de este slice) IGNORA EN SILENCIO, por diseño propio (ver su docstring: "no hay cómo
// resumir un cambio cuya forma no se conoce"), cualquier clave de `pendientes` que no resuelva a
// una `SeccionConfig` de `SECCIONES_TIENDA` ni a 'orden'/'tema'/'seccionesHome' — hoy
// 'encabezado'/'menu'/'footer', los bloques BESPOKE de cromo (§ EDITOR-TIENDA-CROMO-1), que NO son
// `SeccionVista`.
//
// Esa omisión deja el popover de «Publicar» con MENOS filas que claves pendientes: el BADGE del
// botón y `publicarPendientes()` cuentan 'encabezado' (vía `TiendaPaginas.listaPendientes()`), pero
// el popover —que titula "N cambios sin publicar" con `cambios.length`, § `ResumenPublicar.tsx`—
// mostraba 0. Medido (owner, 2026-10-10): subir el ÍCONO DE LA PESTAÑA en el editor de Onix dejó el
// botón en «Publicar 1» y, al abrirlo, "0 cambios sin publicar" — el defecto que este slice cierra.
//
// `completarResumenPendiente` cierra la brecha SIN tocar `resumen-cambios.ts` (fuera de `touches:`):
// por cada clave de `pendientes` que NINGUNA fila de `cambios` describe, agrega una fila GENÉRICA
// («Encabezado · cambiado») con el título que el llamador ya usa para esa clave. El resultado nunca
// tiene MENOS filas que claves pendientes —cada clave aporta como mínimo una—, así que el badge, lo
// que se publica y lo que el popover lista describen siempre la MISMA cantidad de claves. Puede
// seguir habiendo MÁS filas que claves (una sección con varios campos cambiados sigue aportando
// varias, eso no cambia — es el comportamiento ya documentado en `ResumenPublicar.tsx`).
import type { CambioResumen } from '@/lib/admin/resumen-cambios';

export function completarResumenPendiente(
  pendientes: readonly string[],
  cambios: readonly CambioResumen[],
  tituloDe: (clave: string) => string | undefined,
): CambioResumen[] {
  const descritas = new Set(cambios.map((c) => c.clave));
  const faltantes: CambioResumen[] = pendientes
    .filter((clave) => !descritas.has(clave))
    .map((clave) => {
      const tituloSeccion = tituloDe(clave) ?? clave;
      return { clave, tituloSeccion, elemento: '', tipo: 'cambiado' as const, etiqueta: `${tituloSeccion} · cambiado` };
    });
  return [...cambios, ...faltantes];
}
