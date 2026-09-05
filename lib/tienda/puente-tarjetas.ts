import type { SeccionConfig, BloqueConfig } from '@/components/admin/tienda-secciones';

// EL PUENTE vista→formulario del editor de la tienda (§ Backlog #46, Fase 1). Un clic en una tarjeta
// de la VISTA PREVIA salta a su BLOQUE-tarjeta en el FORMULARIO. Este módulo es la parte PURA del
// puente —el mapeo SLOT → BLOQUE—, extraída para afirmarla en capa 1 (el resto es DOM/eventos, que
// vive en `TiendaSeccionEditor`).
//
// EL MAPEO ES POR SLOT, NO POR POSICIÓN: la posición visible miente cuando una tarjeta opcional se
// llena fuera de orden (slot 4 lleno con el 3 vacío = 3ª tarjeta visible). Cada tarjeta es un BLOQUE
// con su `slot` (§ BloqueConfig · tarjeta), y el marcador `data-sf-tarjeta` del storefront lleva el
// slot. Con bloques, el destino del scroll es el bloque, no un encabezado de grupo (que se retiró).

type BloqueTarjeta = Extract<BloqueConfig, { tipo: 'tarjeta' }>;

/**
 * El BLOQUE-tarjeta del slot `slot`, o `null` si el slot no existe en la sección (o la sección no
 * declara bloques). Sale del descriptor (`config.bloques`), fuente única.
 */
export function bloqueDeTarjeta(config: SeccionConfig, slot: number): BloqueTarjeta | null {
  const b = config.bloques?.find(b => b.tipo === 'tarjeta' && b.slot === slot);
  return b?.tipo === 'tarjeta' ? b : null;
}

// Los campos que forman una tarjeta de Presentaciones. `slotVacio` mira estos cuatro; el criterio de
// VISIBILIDAD del storefront (`tarjetasDePresentaciones`) mira sólo `label` O `imagen` — por eso una
// tarjeta VISIBLE nunca está "vacía" (tiene al menos uno de esos dos) y por tanto NUNCA se colapsa.
// Esa es la garantía de que el puente y la pieza opcional no chocan (afirmada en el test).
const CAMPOS_TARJETA = ['label', 'copy', 'categoria', 'imagen'] as const;

/** ¿El slot es OPCIONAL? (los 3-4 de Presentaciones). Deriva del `opcional` de su BLOQUE-tarjeta —
 *  fuente única—. Un slot sin bloque-tarjeta (otra sección) → false. */
export function slotOpcional(config: SeccionConfig, slot: number): boolean {
  return bloqueDeTarjeta(config, slot)?.opcional === true;
}

/** ¿El slot está VACÍO? — sus cuatro campos (label/copy/categoria/imagen) en blanco. Un grupo opcional
 *  vacío es el que el editor colapsa a "+ Agregar tarjeta"; en cuanto tiene ALGO escrito deja de estarlo
 *  y no se vuelve a colapsar solo. */
export function slotVacio(form: Record<string, unknown>, slot: number): boolean {
  return CAMPOS_TARJETA.every(pre => String(form[`${pre}${slot}`] ?? '').trim() === '');
}
