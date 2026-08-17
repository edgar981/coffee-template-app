"use client";
import { useSyncExternalStore } from 'react';
import { DUNA_MQ_SHEET_ABAJO } from '@duna/design-system/layout';

// ─── ¿EL SHEET DEL DETALLE SALE DE ABAJO O DEL LADO? ─────────────────────────
//
// Sólo importa cuando el detalle YA es sheet (por debajo del umbral de
// `useDetalleAlLado`). Responde la pregunta A —"¿es el chrome de una mano?"— y
// por eso comparte su umbral (960) con el rail y la barra inferior:
//
//   • `true`  (<960): chrome móvil. El sheet sale de ABAJO —grip, `--duna-safe-b`,
//     ancho completo—, que es geometría acoplada a la barra inferior.
//   • `false` (960–1080): chrome de escritorio, con rail y sin barra inferior. El
//     sheet sale del LADO (junto al rail), la misma superficie que los drawers de
//     formulario a esos anchos.
//
// Nombrado por el EFECTO (de dónde sale el sheet), no por el dispositivo — es la
// misma disciplina que separó `useDetalleAlLado` de "useEsMovil". Se usa así:
// `anclaje={sheetDesdeAbajo ? 'abajo' : 'lado'}`.
//
// `useSyncExternalStore` por lo mismo que `useDetalleAlLado`: sin parpadeo, sin
// `setState` en efecto. El snapshot del SERVIDOR es `false` —escritorio, sale del
// lado—: en el prerender no hay ventana que medir y se elige el lado que no monta
// una barra inferior que la hidratación tendría que quitar.

let lista: MediaQueryList | null = null;
const consultar = () => (lista ??= window.matchMedia(DUNA_MQ_SHEET_ABAJO));

const suscribir = (avisar: () => void) => {
  const mq = consultar();
  mq.addEventListener('change', avisar);
  return () => mq.removeEventListener('change', avisar);
};
// Consulta positiva: `true` cuando estoy DEBAJO de 960 (max-width).
const leer           = () => consultar().matches;
const leerEnServidor = () => false;

export function useSheetDesdeAbajo(): boolean {
  return useSyncExternalStore(suscribir, leer, leerEnServidor);
}
