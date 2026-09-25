// Configuración del sitio — lo ESTRUCTURADO del tenant que sigue en código (v1).
//
// Los campos PLANOS (nombre, tagline, descripcionFooter, whatsapp, instagram,
// emailRemitente, emailReplyTo) se MUDARON a `SiteSetting` (base, editables en
// Configuración) — ver `lib/config/site-settings*.ts`. La paleta de correos se DERIVA
// de la paleta del storefront (§ Tanda C2, `lib/config/email-colors.ts`).
//
// La navegación del footer (`footerNav`/`legalNav`) SE RETIRÓ de acá (§ MUESTRARIO-FOOTER-TEMA-1):
// el pie pasó a ser sección del REGISTRY (`REGISTRY.footer`, site-content-defaults.ts) — sus
// encabezados de columna y las etiquetas de sus enlaces son DATO editable (`content.footer`), y la
// fila legal es su repeater `legales`. `StoreFooter.tsx` ya no importa `siteConfig.footerNav`ni
// `.legalNav`; son UNA sola fuente (`DEFAULTS.footer`), no dos listas que puedan divergir.
//
// Las funciones (whatsappUrl, formatWhatsappDisplay, instagramUrl) NO son datos de
// tenant: son helpers puros y se quedan acá.

// ─── Política de fulfillment (POR ORDEN) ─────────────────────────────────────
// Los dos ciclos de una orden —pago y entrega— son independientes. La CONDICIÓN
// de pago (Order.condicion_pago) ya no se elige en un formulario: se DERIVA del
// método (derivarCondicionPago en lib/orders.ts) y puede cambiar por la acción de
// despachar sin pago. Por eso el gate ya no vive aquí: PREPARAR un envío es libre
// para cualquier orden no cancelada (decideShippingSchedulable en
// lib/fulfillment.ts), y el control real es la confirmación explícita al
// DESPACHAR una orden sin pago (shippings PATCH). transitionOrder sigue siendo el
// único que mueve Order.estado.

/** URL wa.me con mensaje opcional. Recibe el NÚMERO (una sola fuente: `SiteSetting.whatsapp`
 *  vía el provider del storefront); ya no hay constante de módulo. Puro, client-safe. */
export function whatsappUrl(number: string, mensaje?: string): string {
  const digits = number.replace(/\D/g, "");
  const base = `https://wa.me/${digits}`;
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base;
}

/** Número crudo → display CO ("+573155766064" → "+57 315 576 6064"). Se DERIVA del mismo
 *  número, sin un segundo campo (whatsappDisplay) que pudiera divergir. */
export function formatWhatsappDisplay(whatsapp: string): string {
  const nat = whatsapp.replace(/\D/g, "").replace(/^57/, "");
  const m = nat.match(/^(\d{3})(\d{3})(\d{4})$/);
  return m ? `+57 ${m[1]} ${m[2]} ${m[3]}` : whatsapp;
}

/** URL pública del perfil de Instagram a partir del handle. */
export function instagramUrl(handle: string): string {
  return `https://instagram.com/${handle}`;
}

// ─── Redes sociales (§ MUESTRARIO-REDES-ADICIONALES-1) ───────────────────────────────
// `SiteSetting.redes` es una LISTA `{tipo, valor}`, MISMO patrón que `metodosPago`: reemplaza
// las DOS columnas fijas `instagram`/`whatsapp` como fuente del riel lateral y del ícono del
// footer. Set CERRADO de CINCO tipos — sólo instagram/whatsapp tienen ícono hoy (§ el ícono es
// asset por-tipo, abajo); facebook/x/pinterest se ofrecen sin asset hasta que el owner lo decida.

export type RedSocialTipo = 'instagram' | 'whatsapp' | 'facebook' | 'x' | 'pinterest';

/** El orden CANÓNICO — el que ve el visitante en el riel/footer, y el que devuelve
 *  `parseRedesSociales` sin importar el orden de guardado. Instagram y whatsapp primero:
 *  preserva el orden que el riel/footer ya pintaban antes de este slice (byte-idéntico). */
export const REDES_SOCIALES_ORDEN: RedSocialTipo[] = ['instagram', 'whatsapp', 'facebook', 'x', 'pinterest'];

const TIPOS_RED_VALIDOS = new Set<string>(REDES_SOCIALES_ORDEN);

/** Una red guardada: su tipo (dentro del set cerrado) + su valor. Para instagram/whatsapp,
 *  `valor` es el handle/número (mismo dato que las columnas viejas); para las demás, la URL
 *  completa tal cual el dueño la pegó. */
export interface RedSocialGuardada {
  tipo: RedSocialTipo;
  valor: string;
}

/**
 * Lee `SiteSetting.redes` (el JSON crudo de la base) SOFT — nunca lanza. Descarta lo que no sea
 * un objeto con `tipo` dentro del set cerrado, se queda con el PRIMERO de cada tipo repetido, y
 * devuelve la lista en el ORDEN CANÓNICO — mismo criterio que `parseMetodosPago`
 * (`lib/checkout/metodos-pago.ts`).
 */
export function parseRedesSociales(valor: unknown): RedSocialGuardada[] {
  if (!Array.isArray(valor)) return [];
  const porTipo = new Map<RedSocialTipo, RedSocialGuardada>();
  for (const item of valor) {
    if (!item || typeof item !== 'object') continue;
    const tipoRaw = (item as { tipo?: unknown }).tipo;
    if (typeof tipoRaw !== 'string' || !TIPOS_RED_VALIDOS.has(tipoRaw)) continue;
    const tipo = tipoRaw as RedSocialTipo;
    if (porTipo.has(tipo)) continue; // el PRIMERO de un tipo repetido gana
    const valorRaw = (item as { valor?: unknown }).valor;
    porTipo.set(tipo, { tipo, valor: typeof valorRaw === 'string' ? valorRaw : String(valorRaw ?? '') });
  }
  return REDES_SOCIALES_ORDEN.filter(t => porTipo.has(t)).map(t => porTipo.get(t)!);
}

/** La URL final que abre el botón — instagram/whatsapp COMPONEN desde su handle/número (los
 *  helpers de siempre); el resto usa `valor` TAL CUAL (ya es la URL completa). */
export function urlDeRedSocial(red: RedSocialGuardada): string {
  if (red.tipo === 'instagram') return instagramUrl(red.valor);
  if (red.tipo === 'whatsapp') return whatsappUrl(red.valor);
  return red.valor;
}

// `siteConfig` (footerNav/legalNav) SE RETIRÓ ENTERO (§ MUESTRARIO-FOOTER-TEMA-1): era el único
// contenido que quedaba acá, y con su traslado a `REGISTRY.footer` (site-content-defaults.ts) el
// objeto quedaría vacío. Las funciones puras de arriba (whatsappUrl, formatWhatsappDisplay,
// instagramUrl, parseRedesSociales, urlDeRedSocial) son lo que sobrevive de este módulo.
