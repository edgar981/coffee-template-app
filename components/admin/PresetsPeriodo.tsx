'use client';

import type { OpcionPreset } from '@/lib/metrics/periodo';

// La fila de presets de período — extraída de Inventario para compartirla con Pagos.
// Es la MISMA fila que estaba inline; con dos consumidores, una copia en cada uno
// divergiría (el criterio de `activo`, la clase del pill, el orden). La CONDUCTA —qué
// hace un preset— la pone el consumidor por `onSelect` (Inventario navega por URL,
// Pagos setea estado local); acá sólo la FORMA.
//
// Sin "Todo"/"Sin rango": los presets son ventanas acotadas. Un rango sin límite
// reabriría el corte silencioso que el filtro server-side cerró.
export function PresetsPeriodo({ opciones, desde, hasta, onSelect }: {
  opciones: OpcionPreset[];
  /** El rango puesto, para marcar el preset activo (coincidencia exacta de day keys).
   *  `null`/'' —sin rango— no coincide con ningún preset, que es lo correcto. */
  desde: string | null;
  hasta: string | null;
  onSelect: (desde: string, hasta: string) => void;
}) {
  return (
    <>
      {opciones.map(o => {
        const activo = desde === o.desde && hasta === o.hasta;
        return (
          <button
            key={o.label}
            type="button"
            className={`duna-pill${activo ? ' is-on' : ''}`}
            aria-pressed={activo}
            onClick={() => onSelect(o.desde, o.hasta)}
          >
            {o.label}
          </button>
        );
      })}
    </>
  );
}
