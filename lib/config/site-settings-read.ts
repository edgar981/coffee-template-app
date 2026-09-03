import prisma from '@duna/core';

/**
 * Config EDITABLE del negocio, resuelta a un objeto plano (serializable, para pasar
 * del server layout al provider cliente). Sólo los campos PLANOS — los estructurados
 * (`emailColors`, `footerNav`, `legalNav`) siguen en `siteConfig` (código) en v1.
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
  // Cuenta para transferencias del checkout (§ el número de pago es config). Null = vacío → el
  // método "Transferencia" no se muestra.
  bancoNombre:       string | null;
  bancoTipoCuenta:   string | null;
  bancoNumeroCuenta: string | null;
  bancoTitular:      string | null;
  // Métodos de pago del checkout: encender/apagar + el número de pago móvil propio.
  pagoNequiActivo:         boolean;
  pagoDaviplataActivo:     boolean;
  pagoTransferenciaActivo: boolean;
  pagoEfectivoActivo:      boolean;
  pagoMovilNumero:         string | null;
  // La PALETA ya no está acá: se mudó a `SiteContent.content.tema` (§ Backlog #55). El storefront
  // la lee de `getSiteContent()`, no de este loader.
}

/**
 * El lector RAW de la config del negocio. FALLA RUIDOSO si la fila no existe —SIN
 * fallback a los valores de código—. Un fallback mostraría datos rancios sin que nada
 * falle, que es el peor modo (§ discovery). La fila la garantiza la migración (INSERT),
 * así que su ausencia es un deploy roto y debe fallar fuerte.
 *
 * Vive acá, SIN `server-only` ni `react/cache`, a propósito: lo consumen contextos que
 * NO son renders —route handlers, el motor de automatizaciones y el CARRIL de
 * integración (tsx/node)—, donde `server-only` no resuelve y `cache()` no aplica. El
 * wrapper cacheado para RENDERS (layouts, páginas) es `getSiteSettings` en
 * `site-settings.ts`, que envuelve a éste. Una sola query, dos entradas por contexto.
 */
export async function readSiteSettings(): Promise<SiteSettings> {
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
    bancoNombre:       s.bancoNombre,
    bancoTipoCuenta:   s.bancoTipoCuenta,
    bancoNumeroCuenta: s.bancoNumeroCuenta,
    bancoTitular:      s.bancoTitular,
    pagoNequiActivo:         s.pagoNequiActivo,
    pagoDaviplataActivo:     s.pagoDaviplataActivo,
    pagoTransferenciaActivo: s.pagoTransferenciaActivo,
    pagoEfectivoActivo:      s.pagoEfectivoActivo,
    pagoMovilNumero:         s.pagoMovilNumero,
  };
}
