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
// Los dos ciclos de una orden —pago y entrega— son independientes; esto define
// SÓLO cuándo puede programarse la entrega respecto al pago.
//
// La política dejó de ser por tienda: ahora la determina la CONDICIÓN de pago
// de cada orden (Order.condicion_pago) vía policyForCondicion() en
// lib/fulfillment.ts — ANTICIPADO → 'REQUIRE_PAYMENT' (la entrega se crea sólo
// al confirmar el pago), CONTRAENTREGA → 'ALLOW_UNPAID' (preparar/despachar
// primero, cobrar al entregar). En ambas: una orden cancelada nunca es
// programable, y transitionOrder sigue siendo el único que mueve Order.estado.
// El tipo se queda aquí (config/domain compartido); el const por tienda se
// eliminó al introducir la condición por orden.
export type FulfillmentPolicy = 'REQUIRE_PAYMENT' | 'ALLOW_UNPAID';

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
