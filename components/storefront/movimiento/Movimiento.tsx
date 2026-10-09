'use client';

// EL COMPONENTE (§ MOVIMIENTO-MARCO-GSAP-1) — la cáscara genérica que cualquier sección del
// storefront puede envolver alrededor de SU contenido para pedir una animación del catálogo
// (`lib/movimiento/catalogo.ts`) por id. Toda la decisión (¿corre?, ¿cuál?, ¿con qué gates?) vive
// en `useMovimiento.ts`; este archivo es sólo el JSX.
//
// `id` AUSENTE (`undefined`/`''`, = «Ninguna») es el caso que PROTEGE la byte-identidad: sin un id,
// este componente NO renderiza ningún nodo propio — devuelve `children` DIRECTO, sin wrapper, sin
// ref, sin clase. Es lo que hace cierto "ausente → el HTML de la tienda no cambia ni un byte": una
// sección que nunca declara `animacion` nunca ve un elemento de más en su árbol.
//
// `id` PRESENTE (aunque el motor todavía no lo implemente, o esté apagado por el editor/reduced-
// motion, § `useMovimiento.ts`) SIEMPRE monta la `Etiqueta` — el contenido queda visible igual
// (nada se oculta por CSS estático; lo que T04 oculta, lo pone y lo quita GSAP por estilo inline,
// § `animaciones.ts` — este componente no importa NINGÚN `.css`, a propósito: nada en este árbol
// debe depender de que un consumidor recuerde cargar una hoja de estilos aparte).
import { forwardRef, useImperativeHandle, type ReactNode, type Ref } from 'react';
import { useMovimiento } from './useMovimiento';

/** El set de etiquetas que una sección del storefront necesita para envolver su contenido — MISMO
 *  criterio acotado que `EtiquetaRevelo` de `RevelarBloque.tsx` (un wrapper genérico no necesita
 *  aceptar cualquier tag HTML, sólo las que un bloque de contenido real usa). */
export type EtiquetaMovimiento = 'div' | 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'section' | 'article' | 'li';

export interface MovimientoProps {
  /** El id del catálogo (`lib/movimiento/catalogo.ts`, p. ej. `'T01'`), o ausente/`''` = «Ninguna». */
  id?: string;
  as?: EtiquetaMovimiento;
  className?: string;
  /** § MOVIMIENTO-NIVEL-EDITORIAL-1 — pasa-mano al nodo que SÍ se monta (S01 lo usa para heredar el
   *  `style` que la banda ya trae del esquema asignado, § `page.tsx`). Como con `id` ausente este
   *  componente no monta NINGÚN nodo propio (§ el docstring de cabecera), `style` se IGNORA en esa
   *  rama — nunca puede alterar la byte-identidad de «Ninguna». */
  style?: React.CSSProperties;
  children: ReactNode;
  /** § MOVIMIENTO-EDITOR-EXPOSICION-1 — `false`: no se auto-dispara por scroll; sólo corre vía el
   *  `ref` imperativo (`reproducir()`). Ver `useMovimiento.ts`. Default `true`. */
  auto?: boolean;
}

/** El handle que expone `ref` — el botón «Ver animación» del editor lo usa para disparar un play
 *  único, sin que el componente que envuelve (una sección cualquiera del storefront) tenga que
 *  saber nada de esto: sólo pasa el `ref` hacia abajo. */
export interface MovimientoHandle {
  reproducir: () => void;
}

const Movimiento = forwardRef<MovimientoHandle, MovimientoProps>(function Movimiento(
  { id, as: Etiqueta = 'div', className, style, children, auto },
  refExterno,
) {
  const { ref, reproducir } = useMovimiento(id, { auto });
  useImperativeHandle(refExterno, () => ({ reproducir }), [reproducir]);
  if (!id) return <>{children}</>;
  return (
    <Etiqueta ref={ref as Ref<never>} className={className} style={style}>
      {children}
    </Etiqueta>
  );
});

export default Movimiento;
