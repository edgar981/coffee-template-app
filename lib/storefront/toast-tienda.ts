// El estilo del toast de la tienda — TOAST-COMO-PROTOTIPO-1. `.toast`/`.toast.is-open` del
// prototipo (docs/prototipos/cafeone/css/app.css:832-844, js/app.js:151-162): banda oscura del
// tema, texto claro, esquinas rectas, abajo a la izquierda, duración visible. Puro y testeado, para
// que la decisión de cada valor no viva enterrada en el JSX de `ToasterTienda.tsx` — mismo criterio
// que `pdp-botones.ts`/`scroll-inercia.ts`.
//
// EL GATE (¿corte o no?) NO VIVE ACÁ: `corteAplicado` (`lib/config/themes.ts`) decide CUÁNDO;
// `configToasterTienda` sólo decide QUÉ, dado el booleano ya resuelto — la misma separación que
// `clasesBotonesCompra` (`pdp-botones.ts`).

/** Duración visible del toast bajo CORTE, la del prototipo (`js/app.js:162`,
 *  `setTimeout(..., 3200)`). Sin CORTE, `duration` queda `undefined` → sonner usa SU default
 *  (4000ms), el mismo que ya regía el Toaster de `app/layout.tsx` antes de este slice. */
export const DURACION_TOAST_TIENDA_CORTE_MS = 3200;

/** La config que decide `<Toaster/>` de la tienda (`ToasterTienda.tsx`).
 *
 * SIN CORTE: EXACTAMENTE la que tenía el Toaster genérico de `app/layout.tsx` antes de este slice
 * (`richColors position="top-center"`, sin `duration` ni `vars` propios) — Nayoli queda
 * byte-idéntico, sólo que ahora ese Toaster vive acá en vez de en la raíz (§ el porqué del
 * traslado, `components/ui/sonner.tsx`).
 *
 * CON CORTE: el estilo del prototipo. `richColors` se apaga — si quedara prendido, el verde/rojo
 * genérico de la librería pisaría la paleta del cliente en cada toast, que es justo lo que este
 * slice existe para sacar—. El color sale de las 3 raíces del tema vía las custom properties que
 * sonner YA expone y consume en su propia hoja de estilos (`--normal-bg`/`--normal-text`/
 * `--border-radius`): así el toast se recolorea sin pelear contra el CSS de la librería —layout,
 * ícono (el check de éxito ya es el default de sonner, `fill="currentColor"`, sigue a
 * `--normal-text`) y padding quedan intactos, sólo cambian de color y de radio—. El error se
 * distingue con un filete del acento del tema (`.toast-tienda [data-type="error"]`,
 * `app/globals.css`), no con el rojo genérico que `richColors` habría traído. */
export interface ConfigToasterTienda {
  position: 'top-center' | 'bottom-left';
  richColors: boolean;
  duration: number | undefined;
  /** Custom properties para el `style` del `<Toaster/>` (cascadean a cada toast). `undefined` sin
   *  CORTE — nada que inyectar, Nayoli no lleva `style` propio. */
  vars: Record<string, string> | undefined;
}

export function configToasterTienda(corte: boolean): ConfigToasterTienda {
  if (!corte) {
    return { position: 'top-center', richColors: true, duration: undefined, vars: undefined };
  }
  return {
    position: 'bottom-left',
    richColors: false,
    duration: DURACION_TOAST_TIENDA_CORTE_MS,
    vars: {
      '--normal-bg': 'var(--sf-tinta)',
      '--normal-text': 'var(--sf-fondo)',
      '--normal-border': 'var(--sf-tinta)',
      '--border-radius': '0px',
    },
  };
}
