// El SET CERRADO de íconos de badge (TrustBadges, la ficha de producto — § CONTENIDO-CAFE-A-DATO-
// B-EXT-1, cierra `CONTENIDO-CAFE-ICONO-COFFEE-1`). El DATO guarda un NOMBRE (`badgeNIcono`,
// `site-content-defaults.ts`), NUNCA un componente lucide; este archivo es el mapa nombre→lucide,
// declarado UNA VEZ (patrón `HERO_HREFS`: destino de un conjunto conocido, nunca arbitrario) para
// que `TrustBadges.tsx` y la ficha de producto no diverjan sobre qué ícono corresponde a qué nombre.
//
// Vive en `components/storefront/`, NO en `lib/config/site-content-defaults.ts`: el modelo del
// contenido es PURO —sin React—; este mapa SÍ necesita `lucide-react` (componentes), así que va
// donde vive el render. Mismo criterio que separa `lib/config/fuentes.ts` (CSS puro) de sus
// consumidores en `components/` (el `<link>` del layout, el picker del panel).
//
// UN NOMBRE FUERA DEL SET —incluida la cadena vacía del DEFAULT NEUTRO (§ TrustBadgesContent)— CAE
// AL ÍCONO NEUTRO, NUNCA a `Coffee`: es el clamp real de "un nombre fuera del set no se puede
// elegir", y vive ACÁ (no en `resolverSiteContent`) porque es un asunto de RENDER, no de contenido —
// ver el porqué completo en el comentario de `TrustBadgesContent`.
import { BadgeCheck, Leaf, Coffee, Truck, Shield, RotateCcw, CheckCircle, type LucideIcon } from 'lucide-react';

export const NOMBRES_ICONO_BADGE = ['leaf', 'coffee', 'truck', 'shield', 'rotate', 'check'] as const;
export type NombreIconoBadge = (typeof NOMBRES_ICONO_BADGE)[number];

const MAPA_ICONO_BADGE: Record<NombreIconoBadge, LucideIcon> = {
  leaf: Leaf,
  coffee: Coffee,
  truck: Truck,
  shield: Shield,
  rotate: RotateCcw,
  check: CheckCircle,
};

const esNombreIconoBadge = (v: string): v is NombreIconoBadge =>
  (NOMBRES_ICONO_BADGE as readonly string[]).includes(v);

/**
 * El ícono lucide para el NOMBRE guardado en `badgeNIcono`, o el NEUTRO (`BadgeCheck`) si el
 * nombre está vacío (el DEFAULT), es basura, o quedó de un set viejo. Nunca lanza — mismo "SOFT"
 * que el resto de los loaders de SiteContent.
 */
export function iconoBadge(nombre: string | undefined | null): LucideIcon {
  return nombre && esNombreIconoBadge(nombre) ? MAPA_ICONO_BADGE[nombre] : BadgeCheck;
}
