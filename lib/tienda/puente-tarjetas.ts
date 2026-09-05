import type { SeccionConfig } from '@/components/admin/tienda-secciones';

// EL PUENTE vista→formulario del editor de la tienda (§ Backlog #46, Fase 1). Un clic en una tarjeta
// de la VISTA PREVIA salta a su grupo "Tarjeta N" en el FORMULARIO. Este módulo es la única parte
// PURA del puente —el mapeo SLOT → nombre de grupo—, extraída para afirmarla en capa 1 (el resto es
// DOM/eventos, que vive en `TiendaSeccionEditor`).
//
// SÓLO PRESENTACIONES por ahora (owner: "probar y decidir antes de replicar"). El mapeo encodifica su
// convención de campos: la tarjeta N la forman `label${N}`/`copy${N}`/`categoria${N}`/`imagen${N}`,
// que comparten `grupo`. Así el nombre del grupo sale del DESCRIPTOR (fuente única, § tienda-secciones)
// y no se duplica acá: si el grupo se renombra en el descriptor, este mapeo lo sigue.

/**
 * El nombre del grupo del formulario ("Tarjeta 3 (opcional)") al que pertenece la tarjeta `slot`
 * (1-4), o `null` si el slot no existe en la sección. Deriva del campo `label${slot}` del descriptor,
 * NO de un literal — el grupo es lo que el descriptor diga.
 */
export function grupoDeTarjeta(config: SeccionConfig, slot: number): string | null {
  return config.campos.find(c => c.name === `label${slot}`)?.grupo ?? null;
}

// Los campos que forman una tarjeta de Presentaciones. `slotVacio` mira estos cuatro; el criterio de
// VISIBILIDAD del storefront (`tarjetasDePresentaciones`) mira sólo `label` O `imagen` — por eso una
// tarjeta VISIBLE nunca está "vacía" (tiene al menos uno de esos dos) y por tanto NUNCA se colapsa.
// Esa es la garantía de que el puente y el colapso no chocan (afirmada en el test).
const CAMPOS_TARJETA = ['label', 'copy', 'categoria', 'imagen'] as const;

/** ¿El slot es OPCIONAL? (los 3-4 de Presentaciones). Deriva del `opcional` del campo `label${slot}`
 *  del descriptor — no de un número mágico. Un slot sin ese campo (otra sección) → false. */
export function slotOpcional(config: SeccionConfig, slot: number): boolean {
  return config.campos.find(c => c.name === `label${slot}`)?.opcional === true;
}

/** ¿El slot está VACÍO? — sus cuatro campos (label/copy/categoria/imagen) en blanco. Un grupo opcional
 *  vacío es el que el editor colapsa a "+ Agregar tarjeta"; en cuanto tiene ALGO escrito deja de estarlo
 *  y no se vuelve a colapsar solo. */
export function slotVacio(form: Record<string, unknown>, slot: number): boolean {
  return CAMPOS_TARJETA.every(pre => String(form[`${pre}${slot}`] ?? '').trim() === '');
}
