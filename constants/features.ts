// Feature flags del storefront.
//
// SUBSCRIPTIONS_ENABLED: Nayoli aún NO opera suscripciones. La sección se
// conserva como PROPUESTA de valor (planes visibles + CTA "Me interesa" por
// WhatsApp), pero no transacciona: sin precios, sin descuentos, sin carrito ni
// checkout. Con `false`:
//   - se oculta el widget "Suscribirse y ahorrar…" de la página de producto,
//   - no se aplica ningún descuento de suscripción al precio.
// Para reactivar el flujo transaccional, poner en `true` (y definir el precio
// y el descuento reales con el cliente).
export const SUBSCRIPTIONS_ENABLED = false;

// Descuento de suscripción (pendiente de confirmar con el cliente). Solo se usa
// cuando SUBSCRIPTIONS_ENABLED === true.
export const SUBSCRIPTION_DISCOUNT = 0.15;
