import { PRESETS, validarPreset, mergePresetEnContent } from './themes';
import type { SiteContentData } from './site-content-defaults';
import { cssPaleta } from './palette-style';
import { cssFuentes } from './fuentes-style';
import { linkFuentePar } from './fuentes';
import { cssForma } from './forma-style';

// EL MIRADOR DE PRESETS (§ TEMAS-MIRADOR-PRESET-1). `aplicarPreset` (`site-content-write.ts`)
// PERSISTE un preset — corre desde un runbook de onboarding, nunca desde el panel del cliente
// (§ themes.ts) — y hoy no tiene UN SOLO llamador: no hay forma de MIRAR una variante nueva sin
// mover al tenant que ya corre en la misma base que el despliegue de desarrollo comparte.
//
// Esta función es la mitad de sólo-lectura: superpone el preset EN MEMORIA, para esta respuesta
// nada más, reusando el MISMO merge quirúrgico que `aplicarPreset` usaría para escribir — no una
// segunda lógica de composición que pudiera divergir de la que persiste. NUNCA toca la base.
//
// NUNCA LANZA. `clave` ausente, o que no nombre un preset del catálogo, o un preset que
// `validarPreset` marque incompleto → se devuelve `content` TAL CUAL (byte-idéntico a no pedir
// nada). `validarPreset` es la autoridad sobre qué preset aplica hoy — un preset a medias
// dibujado a medias es peor que no dibujarlo, así que acá no se agrega un segundo criterio.
export function contenidoConPresetDeVista(
  content: SiteContentData,
  clave: string | undefined,
): SiteContentData {
  if (!clave) return content;
  const preset = PRESETS.find((p) => p.clave === clave);
  if (!preset) return content;
  if (validarPreset(preset).length > 0) return content;
  // `mergePresetEnContent` opera sobre `Record<string, unknown>` porque también lo consume
  // `aplicarPreset` contra el JSON crudo de la fila; acá el `content` de entrada YA es la forma
  // resuelta (`SiteContentData`, con cada sección completa), así que el resultado también lo es
  // — el merge sólo REEMPLAZA `tema`/`esquemas`/`orden`/`variantesBandas` y el campo `variante`
  // dentro de las secciones que el preset nombra, preservando todo lo demás intacto.
  return mergePresetEnContent(content as unknown as Record<string, unknown>, preset) as unknown as SiteContentData;
}

/** Las cuatro piezas del `<style>`/`<link>` del EJE COMPLETO del mirador — `null` cada una cuando
 * el eje correspondiente no tiene override (misma regla que ya rige el `<style>` del layout: sin
 * paleta/par/forma custom, no se emite nada). */
export interface MiradorCss {
  paletaCss: string | null;
  fuentesCss: string | null;
  fuentesLink: string | null;
  formaCss: string | null;
}

// EL EJE COMPLETO DEL MIRADOR (§ CORTE-MIRADOR-EJES-COMPLETOS-1). El `<style>` de `:root` que pinta
// paleta/par-tipográfico/forma lo emite `layout.tsx`, que NUNCA ve `searchParams` (§ el comentario de
// `page.tsx`) — así que sin esto el mirador cambiaba las BANDAS pero el `:root` seguía leyendo el
// content PUBLICADO. La salida es el ORDEN DE FUENTE: lo que `page.tsx` devuelve se renderiza DESPUÉS
// del `<style>` del layout, así que un segundo bloque con las MISMAS vars, emitido desde la página,
// gana sin subir especificidad y sin tocar el layout (que sigue sirviendo el árbol de siempre a quien
// no manda `?tema=`).
//
// REUSA los MISMOS constructores que ya usa `layout.tsx` para el content publicado — `cssPaleta`/
// `cssFuentes`/`linkFuentePar`/`cssForma` — nunca una segunda lógica de composición que pudiera
// divergir de la que el layout ya corre (la misma razón por la que este archivo reusa
// `mergePresetEnContent` en vez de reescribir el merge).
//
// `null` cuando `content === contentPublicado` (sin `?tema=`, clave que no nombra ningún preset, o
// preset incompleto — `contenidoConPresetDeVista` ya decidió eso arriba, y esta función NO agrega un
// segundo criterio): el mirador NUNCA LANZA, y un preset a medias dibujado a medias es peor que no
// dibujarlo. Con `content` sin cambios no hay NADA que reforzar — el `:root` del layout ya es correcto
// para lo que se está mostrando — así que ni siquiera se recalculan las cuatro piezas.
export function cssMiradorTema(
  content: SiteContentData,
  contentPublicado: SiteContentData,
): MiradorCss | null {
  if (content === contentPublicado) return null;
  const { fondo, tinta, acento, fuentePar, forma, origenTexto, origenAccion } = content.tema;
  // origenTexto/origenAccion (§ TEMAS-ROLES-DECLARADOS-POR-EL-PRESET-1): pasan a `cssPaleta` tal
  // cual — `null` (el default de TODO tenant real y de los otros 5 presets) se convierte en
  // `undefined`, que es lo que `derivarPaleta` entiende como "sin declarar". Hasta
  // `CROMO-EJES-PALETA-AL-RENDER-1` este era el ÚNICO punto de la cadena real donde estos dos
  // campos de `content.tema` llegaban a tener efecto; ese slice hizo que el layout del storefront
  // (`app/(storefront)/layout.tsx`) los honre también, con el MISMO mapeo null→undefined, para el
  // `:root` PERSISTIDO que sirve a todo visitante — acá siguen pasando para el `:root` del
  // MIRADOR (`?tema=`).
  return {
    paletaCss: cssPaleta(fondo, tinta, acento, {
      origenTexto: origenTexto ?? undefined,
      origenAccion: origenAccion ?? undefined,
    }),
    fuentesCss: cssFuentes(fuentePar),
    fuentesLink: linkFuentePar(fuentePar),
    formaCss: cssForma(forma),
  };
}
