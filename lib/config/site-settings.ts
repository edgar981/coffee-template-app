import 'server-only';
import { cache } from 'react';
import prisma from '@duna/core';

/**
 * Config EDITABLE del negocio, resuelta a un objeto plano (serializable, para pasar
 * del server layout del admin al provider cliente). Sólo los campos PLANOS — los
 * estructurados (`emailColors`, `footerNav`, `legalNav`) siguen en `siteConfig`
 * (código) en v1.
 */
export interface SiteSettings {
  nombre:            string;
  tagline:           string;
  descripcionFooter: string;
  whatsapp:          string;
  instagram:         string;
  emailRemitente:    string;
  emailReplyTo:      string | null;
  adminEmail:        string | null;
}

/**
 * LA fuente runtime de la config del negocio. FALLA RUIDOSO si la fila no existe —
 * SIN fallback a los valores de código. Un fallback mostraría datos rancios sin que
 * nada falle, que es el peor modo (§ discovery). La fila la garantiza la migración
 * (INSERT), así que su ausencia es un deploy roto y debe fallar fuerte.
 *
 * `cache()` dedupe por request: si el server layout y una página la leen en el mismo
 * request, es UNA sola query. Server-only: los lectores cliente (páginas del admin) la
 * reciben por props/provider, no la importan.
 */
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  const s = await prisma.siteSetting.findUniqueOrThrow({ where: { id: 'default' } });
  return {
    nombre:            s.nombre,
    tagline:           s.tagline,
    descripcionFooter: s.descripcionFooter,
    whatsapp:          s.whatsapp,
    instagram:         s.instagram,
    emailRemitente:    s.emailRemitente,
    emailReplyTo:      s.emailReplyTo,
    adminEmail:        s.adminEmail,
  };
});
