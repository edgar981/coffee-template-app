import { z } from 'zod';

// Forma EDITABLE del contenido del storefront. La corren el PATCH (la que MANDA) y el editor
// (aviso temprano) — como el schema de SiteSetting.
//
// SOFT a propósito: todo OPCIONAL y SIN `min(1)` —el vacío es un estado legítimo—, al
// revés de `siteSettingsEditableSchema` (que exige no-vacío porque su loader falla ruidoso).
// Acá se valida sólo el TIPO; el resolver aplica default (requerido) u omisión (opcional).
const heroEditableSchema = z.object({
  visible: z.boolean().optional(),
  eyebrow: z.string().optional(),
  titulo: z.string().optional(),
  tituloEnfasis: z.string().optional(),
  subtitulo: z.string().optional(),
  ctaPrimarioLabel: z.string().optional(),
  ctaSecundarioLabel: z.string().optional(),
  // Path estático (`/images/…`) o URL de Blob — el modelo acepta ambos, así que sólo string.
  imagen: z.string().optional(),
});

export const siteContentEditableSchema = z.object({
  hero: heroEditableSchema.optional(),
});

export type SiteContentEditable = z.infer<typeof siteContentEditableSchema>;
