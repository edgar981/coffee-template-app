// Configuración del sitio — fuente única de datos de marca/contacto.
//
// Objetivo de template: el CÓDIGO es fijo; lo que varía por cliente vive
// aquí (y en la data/DB). Esta primera pasada cubre solo footer + contacto;
// el resto del sitio se migrará en pasadas posteriores.

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

// Dígitos wa.me (sin "+" ni separadores) a partir de contacto.whatsapp.
const whatsappDigits = "+573155766064".replace(/\D/g, "");

/** URL wa.me con mensaje opcional precargado. Client-safe: solo arma la URL. */
export function whatsappUrl(mensaje?: string): string {
  const base = `https://wa.me/${whatsappDigits}`;
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base;
}

/** URL pública del perfil de Instagram a partir del handle en contacto. */
export function instagramUrl(handle: string): string {
  return `https://instagram.com/${handle}`;
}

export const siteConfig = {
  brand: {
    nombre: "Café Nayoli",
    tagline: "Supatá · Cundinamarca",
    descripcionFooter:
      "Café de especialidad colombiano. De nuestra finca en Supatá a tu taza.",
  },

  // ─── Identidad de la TIENDA para correos al cliente final ────────────────────
  // Los correos al cliente llevan la marca de la tienda, NO la de Duna. Un solo
  // lugar para el remitente/marca de todos los emails de notificación.
  tienda: {
    nombre: "Café Nayoli",
    // Remitente INTERINO hasta que exista dominio propio del cliente (Preguntas v2):
    // `mail.duna.solutions` ya está verificado en Resend. Cambiar aquí = cambia en
    // TODOS los correos. (El remitente muestra el nombre de la tienda, no "Duna".)
    emailRemitente: "Café Nayoli <pedidos@mail.duna.solutions>",
    // Sin correo de contacto propio de la tienda todavía → sin Reply-To (se omite).
    emailReplyTo: undefined as string | undefined,
    // Paleta del STOREFRONT (cream/espresso) para los correos — NUNCA el ámbar del
    // admin. Hex inline porque los clientes de correo no leen CSS variables.
    emailColors: {
      crema:    "#faf7f2",
      papel:    "#ffffff",
      espresso: "#2a1a10",
      cafe:     "#8b4513",
      muted:    "#8b6650",
      borde:    "#e8dccd",
    },
  },

  contacto: {
    // Formato internacional con "+" — usar whatsappUrl() para el enlace wa.me.
    whatsapp: "+573155766064",
    whatsappDisplay: "+57 315 576 6064",
    instagram: "cafenayoliorigen",
  },

  footerNav: {
    tienda: [
      { label: "Todos los productos", href: "/tienda" },
      { label: "Café en Grano", href: "/tienda?cat=cafe_grano" },
      { label: "Café Molido", href: "/tienda?cat=cafe_molido" },
      { label: "Suscripciones", href: "/suscripciones" },
    ] satisfies NavLink[],

    // Solo rutas con página real. "Contacto" apunta a WhatsApp (no hay página).
    // Eliminados por no existir: Política de Envíos, Devoluciones.
    ayuda: [
      { label: "Rastrear Pedido", href: "/rastrear-pedido" },
      { label: "Preguntas Frecuentes", href: "/preguntas-frecuentes" },
      { label: "Contacto", href: whatsappUrl() },
    ] satisfies NavLink[],

    empresa: [
      { label: "Nuestra Historia", href: "/#nuestra-historia" },
    ] satisfies NavLink[],
  },

  // legalNav vacío temporalmente — páginas legales pendientes de redacción
  // con el cliente antes de lanzamiento (Ley 1581 / Estatuto del Consumidor).
  // La fila legal del footer solo se renderiza si este array tiene elementos.
  legalNav: [] as NavLink[],
} as const;
