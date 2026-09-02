// Configuración del sitio — lo ESTRUCTURADO del tenant que sigue en código (v1).
//
// Los campos PLANOS (nombre, tagline, descripcionFooter, whatsapp, instagram,
// emailRemitente, emailReplyTo) se MUDARON a `SiteSetting` (base, editables en
// Configuración) — ver `lib/config/site-settings*.ts`. Acá quedan sólo los
// ESTRUCTURADOS, que un formulario simple no edita: la paleta de correos
// (`emailColors`) y la navegación del footer (`footerNav`/`legalNav`). Su día de
// editable es el multi-tenant (§ CLAUDE.md · Datos de negocio editables).
//
// Las funciones (whatsappUrl, formatWhatsappDisplay, instagramUrl) NO son datos de
// tenant: son helpers puros y se quedan acá.

export interface NavLink {
  label: string;
  href: string;
}

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

export const siteConfig = {
  // ─── Paleta de correos al cliente (ESTRUCTURADO) ─────────────────────────────
  // Los correos al cliente llevan la marca de la TIENDA (cream/espresso), NUNCA el
  // ámbar del admin. Hex inline porque los clientes de correo no leen CSS variables.
  // `buildBrand()` la inyecta junto con los planos (nombre/tagline/remitente), que
  // ya vienen de SiteSetting. Es un editor rico, no un input de texto → se queda en
  // código hasta el multi-tenant.
  tienda: {
    emailColors: {
      crema:    "#faf7f2",
      papel:    "#ffffff",
      espresso: "#2a1a10",
      cafe:     "#8b4513",
      muted:    "#8b6650",
      borde:    "#e8dccd",
    },
  },

  footerNav: {
    // C3: los 2 atajos de categoría café ("Café en Grano"/"Café Molido" → cat=…) se RETIRARON —
    // eran literales café, y footerNav es ESTRUCTURA estática que StoreFooter lee sin tocar el
    // catálogo; derivar links de categoría exigiría pasarle el catálogo al footer. Un cliente que
    // quiera atajos de categoría en el footer es footerNav→editable (su propio ítem), no esto.
    tienda: [
      { label: "Todos los productos", href: "/tienda" },
      { label: "Suscripciones", href: "/suscripciones" },
    ] satisfies NavLink[],

    // Solo rutas de página real. "Contacto" SALIÓ: era un link de WhatsApp horneado con
    // el número —una SEGUNDA fuente del número— mientras las otras son rutas. El contacto
    // de WhatsApp lo renderiza StoreFooter desde `SiteSetting.whatsapp` (una sola fuente).
    // Eliminados antes por no existir: Política de Envíos, Devoluciones.
    ayuda: [
      { label: "Rastrear Pedido", href: "/rastrear-pedido" },
      { label: "Preguntas Frecuentes", href: "/preguntas-frecuentes" },
    ] satisfies NavLink[],

    // "Nuestra Historia" → la página /nosotros (antes ancla `/#nuestra-historia` a la home). El
    // footer la OCULTA cuando la página está apagada (§ paginas.nosotros, StoreFooter).
    empresa: [
      { label: "Nuestra Historia", href: "/nosotros" },
    ] satisfies NavLink[],
  },

  // legalNav vacío temporalmente — páginas legales pendientes de redacción
  // con el cliente antes de lanzamiento (Ley 1581 / Estatuto del Consumidor).
  // La fila legal del footer solo se renderiza si este array tiene elementos.
  legalNav: [] as NavLink[],
} as const;
