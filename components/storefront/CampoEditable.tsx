'use client';

import type { ReactNode } from 'react';
import { useModoEditorActivo } from '@/components/storefront/ModoEditor';
import { ATRIBUTO_EDITOR_CAMPO, ATRIBUTO_EDITOR_LINEA } from '@/lib/admin/editor-iframe';
import { ATRIBUTO_EDITOR_CAMPO_IMAGEN } from '@/lib/storefront/campo-editable';

// MARCA un nodo de TEXTO como editable — SÓLO en modo editor (§ EDITOR-TIENDA-CAMPO-EDITABLE-1,
// docs/editor-tienda/EDICION-INLINE.md § 2.3). Fuera de modo editor — el 99.99% del tráfico —
// devuelve `children` TAL CUAL: cero atributos, cero wrapper, byte-idéntico a hoy (el MISMO
// contrato que ya cumple `data-editor-seccion` vía `bandaNodo()` en `app/(storefront)/page.tsx`).
//
// SIN overlay propio: el `<input>`/`<textarea>` que se monta ENCIMA del nodo real vive en
// `EditorPuenteVivo.tsx` (§ su docstring) — este componente sólo MARCA el nodo para que ese
// listener (DOM puro, `closest('[data-editor-campo]')`) sepa qué campo es y qué ruta mandar. Ni
// React ni este componente saben si hay un overlay abierto encima; el marcador es toda la
// responsabilidad.
//
// PRIMER CONSUMIDOR REAL (§ EDITOR-TIENDA-CAMPO-EDITABLE-HERO-1, fila 2 de § 6.4): las cuatro
// variantes del hero (`HeroCurtina`/`HeroFicha`/`HeroMedia`/`HeroMediaMarquesina`) y la banda suelta
// `Marquesina.tsx`. El resto de las secciones (brandStory, origen, presentaciones…) sigue sin
// instrumentar — fila 4 de § 6.4, `EDITOR-TIENDA-CAMPO-EDITABLE-RESTO-1..N`.
//
// `tipo='imagen'` (§ EDITOR-TIENDA-CAMPO-EDITABLE-IMAGEN-1, fila 3 de § 6.4): marca una IMAGEN o un
// VIDEO en vez de texto. Dos diferencias con el default ('texto'), las dos a propósito:
//   - El ATRIBUTO es OTRO (`ATRIBUTO_EDITOR_CAMPO_IMAGEN`, no `ATRIBUTO_EDITOR_CAMPO`): un clic ahí
//     nunca debe abrir el overlay de texto — `EditorPuenteVivo.tsx` decide el comportamiento mirando
//     CUÁL de los dos marcadores matchea, sin tener que resolver tipos contra el REGISTRY en cada
//     clic (§ el docstring de `ATRIBUTO_EDITOR_CAMPO_IMAGEN`, `lib/storefront/campo-editable.ts`).
//   - El envoltorio es `display:contents` — invisible en el layout, nunca `display:inline` como el
//     de texto. `children` acá es un `<Image fill>`/`<video>` cuyo recorte depende del PADRE directo
//     (Next exige `position:relative`/`display:block` en ese padre para `fill`); un `<span>` inline
//     normal violaría esa condición. `display:contents` deja que el hijo real sea efectivamente el
//     único box en el árbol de layout (como el `.puente-tarjetas` de `TiendaSeccionEditor`, mismo
//     patrón para un wrapper que sólo necesita existir para el `closest()` del clic, nunca para
//     calcular una geometría — a diferencia del campo de texto, que SÍ mide su nodo con
//     `getBoundingClientRect()` para posicionar el overlay encima).
export default function CampoEditable({
  campo,
  tipo = 'texto',
  multilinea = false,
  children,
}: {
  /** La ruta COMPLETA: "seccion.campo" (plano) o "seccion.items.N.campo" (ítem de repeater) —
   *  § `parsearRutaCampo`, `lib/storefront/campo-editable.ts`. */
  campo: string;
  /** 'texto' (default) abre el campo flotante al clickear; 'imagen' manda al selector de archivos
   *  real del panel (§ el docstring de arriba). */
  tipo?: 'texto' | 'imagen';
  /** SÓLO aplica a `tipo:'texto'`. `<textarea>` (Enter inserta salto de línea) si `true`;
   *  `<input>` (Enter commitea y cierra) si `false` (el default). */
  multilinea?: boolean;
  children: ReactNode;
}) {
  const activo = useModoEditorActivo();
  if (!activo) return <>{children}</>;
  if (tipo === 'imagen') {
    return (
      <span style={{ display: 'contents' }} {...{ [ATRIBUTO_EDITOR_CAMPO_IMAGEN]: campo }}>
        {children}
      </span>
    );
  }
  // Atributos por NOMBRE COMPUTADO (`{[ATRIBUTO_EDITOR_CAMPO]: campo}`), no el literal
  // `data-editor-campo=` a mano — misma razón que el resto del puente: una sola definición del
  // nombre, compartida con quien lo LEE (`EditorPuenteVivo.tsx`), para que no puedan divergir.
  return (
    <span {...{ [ATRIBUTO_EDITOR_CAMPO]: campo, [ATRIBUTO_EDITOR_LINEA]: multilinea ? 'multiple' : 'unica' }}>
      {children}
    </span>
  );
}
