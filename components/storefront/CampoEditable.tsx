'use client';

import type { ReactNode } from 'react';
import { useModoEditorActivo } from '@/components/storefront/ModoEditor';
import { ATRIBUTO_EDITOR_CAMPO, ATRIBUTO_EDITOR_LINEA } from '@/lib/admin/editor-iframe';

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
// NINGUNA sección de la tienda usa este componente todavía (§ EDICION-INLINE.md § 6.4, fila 1 —
// "SIN aplicarlo todavía a ninguna sección real"): esto es sólo la PLOMERÍA, ejercitada por su
// propio test y por un nodo de arnés (§ el slice), no por `HeroSection`/`BrandStory`/etc.
export default function CampoEditable({
  campo,
  multilinea = false,
  children,
}: {
  /** La ruta COMPLETA: "seccion.campo" (plano) o "seccion.items.N.campo" (ítem de repeater) —
   *  § `parsearRutaCampo`, `lib/storefront/campo-editable.ts`. */
  campo: string;
  /** `<textarea>` (Enter inserta salto de línea) si `true`; `<input>` (Enter commitea y cierra) si
   *  `false` (el default: la mayoría de los campos de texto libre son de una sola línea). */
  multilinea?: boolean;
  children: ReactNode;
}) {
  const activo = useModoEditorActivo();
  if (!activo) return <>{children}</>;
  // Atributos por NOMBRE COMPUTADO (`{[ATRIBUTO_EDITOR_CAMPO]: campo}`), no el literal
  // `data-editor-campo=` a mano — misma razón que el resto del puente: una sola definición del
  // nombre, compartida con quien lo LEE (`EditorPuenteVivo.tsx`), para que no puedan divergir.
  return (
    <span {...{ [ATRIBUTO_EDITOR_CAMPO]: campo, [ATRIBUTO_EDITOR_LINEA]: multilinea ? 'multiple' : 'unica' }}>
      {children}
    </span>
  );
}
