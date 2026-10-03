'use client';

import { createContext, useContext, type ReactNode } from 'react';

// EL CONTEXTO QUE LE FALTABA A CADA COMPONENTE DE SECCIÓN (§ EDITOR-TIENDA-CAMPO-EDITABLE-1, docs/
// editor-tienda/EDICION-INLINE.md § 2.3): "Hoy NINGÚN componente de sección sabe que está en modo
// editor" — `app/(storefront)/page.tsx` envuelve cada banda en `<div data-editor-seccion={id}>`
// DESDE AFUERA (`bandaNodo()`), así que el JSX que escribe `{hero.titulo}` DENTRO de `HeroSection`
// no tiene ninguna señal propia. `CampoEditable` (y cualquier componente de sección futuro) la lee
// con `useModoEditorActivo()`.
//
// HERMANO de `SiteContentProvider`, no un campo más de su `Ctx`: ese contexto expone
// `SiteContentData` DIRECTO (no un objeto `{content, …}`) y lo leen ~40 componentes
// destructurando campos (`const { trustBadges } = useSiteContent();`) — agregarle una clave nueva
// tocaría los ~40. Un contexto chico y propio no toca ninguno.
//
// MONTADO SIEMPRE desde `app/(storefront)/layout.tsx`, con el MISMO booleano que ya recibe
// `EditorPuenteVivo activo={enModoEditor}` (`modoEditorActivo()`, computado server-side: sesión
// OWNER/MANAGER real + `?editor=1`) — gratis en cómputo, una sola fuente.
const Ctx = createContext(false);

export function ModoEditorProvider({ activo, children }: { activo: boolean; children: ReactNode }) {
  return <Ctx.Provider value={activo}>{children}</Ctx.Provider>;
}

/**
 * `true` SÓLO en modo editor — el 99.99% del tráfico (cualquier visitante real) lee `false` sin
 * tocar sesión ni base, porque el valor ya viene resuelto desde el layout. Fuera del provider (no
 * debería ocurrir en producción: el layout SIEMPRE lo monta) el default de `createContext` es
 * `false` — el caso SEGURO, nunca lanza, mismo criterio que la guarda de `EditorPuenteVivo` (que
 * también decide su propio silencio con un booleano, no con un throw).
 */
export function useModoEditorActivo(): boolean {
  return useContext(Ctx);
}
