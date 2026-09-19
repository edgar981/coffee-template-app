import { PRESETS, validarPreset, mergePresetEnContent } from './themes';
import type { SiteContentData } from './site-content-defaults';

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
