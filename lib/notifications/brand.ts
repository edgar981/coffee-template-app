// La FORMA de la marca que consumen los correos al cliente — sin un solo valor
// adentro. Es el contrato que hace agnóstico al núcleo de notificaciones: las
// plantillas y el canal reciben un `Brand`, nunca leen `siteConfig`. La app (que
// conoce el tenant actual) lo construye con `buildBrand()` y lo inyecta.
//
// Regla de core (Fase A): aquí no vive ningún color ni el nombre de un negocio.
// Solo el TIPO. Los valores (Nayoli) viven en la app, en `lib/config/site`.

export interface EmailColors {
  crema: string;
  papel: string;
  espresso: string;
  cafe: string;
  muted: string;
  borde: string;
}

export interface Brand {
  /** Nombre visible del negocio en asunto, encabezado y pie. */
  nombre: string;
  /** Línea bajo el nombre (ciudad/lema). */
  tagline: string;
  /** Paleta inline de los correos (los clientes de correo no leen CSS vars). */
  colors: EmailColors;
  /** Remitente `Nombre <correo@dominio>` de los correos al cliente. */
  remitente: string;
  /** Reply-To opcional; se omite si no hay correo de contacto propio. */
  replyTo?: string;
}
