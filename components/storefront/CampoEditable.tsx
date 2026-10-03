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

// EL HUECO de una imagen OPCIONAL VACÍA (§ EDITOR-TIENDA-CAMPO-EDITABLE-CIERRE-1, cierra
// `CAMPO-EDITABLE-IMAGEN-SLOT-VACIO-OPCIONAL-1`, nombrado en `EDITOR-TIENDA-CAMPO-EDITABLE-HOME-1`).
// Seis sitios (`brandStory.imagen2/3/4` en sus dos variantes, `subscriptionCTA.imagenFondo` en
// `SubscriptionCTALinea`, `nosotrosHistoria.imagen`, `nosotrosCierre.imagenFondo`) OMITEN el bloque
// entero —no sólo la imagen— cuando el campo está vacío (`.filter()`/`&&`), así que no quedaba NINGÚN
// nodo donde clickear para AGREGAR la primera foto: el dueño sólo podía hacerlo desde el formulario
// de la lista, el estorbo que este programa existe para evitar (§ EDICION-INLINE.md § 0).
//
// SÓLO EN MODO EDITOR, igual que `CampoEditable`: fuera de él devuelve `null` — CERO nodos, nunca el
// chip visible sin su gate de clic. El llamador decide CUÁNDO llamarlo (sólo cuando el campo real
// está vacío); este componente no vuelve a comprobar el valor, porque no lo recibe — sería una
// tercera fuente de la misma condición que el llamador ya evaluó para decidir qué rama renderizar.
//
// REUSA `tipo="imagen"` de `CampoEditable` — el MISMO mensaje al puente
// (`TIPO_MENSAJE_CAMPO_IMAGEN_CLICK`) y el MISMO flujo de subida real del panel (§ EDITOR-TIENDA-
// CAMPO-EDITABLE-IMAGEN-1) — nunca un selector propio. No hay diferencia de MECANISMO entre "cambiar
// una foto que ya existe" y "agregar la primera": las dos terminan en el mismo
// `abrirSelectorImagen(campo)`.
//
// EL CLICK ABARCA TODA LA CAJA (`className` del llamador — el MISMO tamaño/posición que ocuparía la
// imagen real: `absolute inset-0`, `aspect-[3/4]`…), pero LO VISIBLE es un CHIP CHICO centrado — no
// un rectángulo opaco que tape el fondo/el texto de la sección. "Discreto" es sobre todo esto: en los
// casos full-bleed (`subscriptionCTA.imagenFondo`/`nosotrosCierre.imagenFondo`) el fondo sólido de
// siempre sigue viéndose detrás del chip, y el texto de la banda sigue legible.
//
// ESTILO LITERAL, nunca un token `--sf-*`/`--duna-*` (mismo criterio que el chip de sesión vencida
// de `EditorPuenteVivo.tsx`, § su docstring): es chrome del EDITOR superpuesto sobre el documento del
// VISITANTE, no contenido de ese documento — no tiene que adaptarse al tema del tenant, sólo verse
// igual de discreto sobre cualquier fondo (claro u oscuro).
export function HuecoImagenOpcional({
  campo,
  className = '',
}: {
  /** La ruta COMPLETA del campo de imagen — igual que `CampoEditable campo=` con `tipo="imagen"`. */
  campo: string;
  /** El tamaño/posición de la caja clickeable, decidido por el llamador: el MISMO que ocuparía el
   *  nodo de imagen real que este hueco reemplaza. */
  className?: string;
}) {
  const activo = useModoEditorActivo();
  if (!activo) return null;
  return (
    <CampoEditable campo={campo} tipo="imagen">
      <div className={`flex cursor-pointer items-center justify-center ${className}`}>
        <span className="rounded-md border-2 border-dashed border-black/30 bg-white/90 px-3 py-2 text-xs font-medium whitespace-nowrap text-black/60 shadow-sm">
          + Agregar foto
        </span>
      </div>
    </CampoEditable>
  );
}
