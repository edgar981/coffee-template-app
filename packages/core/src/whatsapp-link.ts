// Normalización de teléfonos de CLIENTE para wa.me. Client-safe: sólo arma URLs y
// normaliza números — no envía nada (el envío automático vive en el stub de Meta).
//
// El número de la TIENDA salió de acá: era `WHATSAPP_PEDIDOS`/`whatsappHref` leyendo
// `siteConfig` (una const de módulo, build-time). Ahora el número del negocio es runtime
// (`SiteSetting.whatsapp`) y sus enlaces los arma `whatsappUrl(number, msg)` de site.ts
// desde el provider del storefront. Esto DECOPLA core de `siteConfig` — este archivo ya
// no importa nada de la app.

// Normaliza un teléfono colombiano a formato internacional wa.me (dígitos, con
// prefijo 57): "300 000 0000" o "+573000000000" → "573000000000". Devuelve null
// si no reconoce un móvil colombiano de 10 dígitos (empieza por 3).
export function toWhatsappNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (/^573\d{9}$/.test(digits)) return digits;          // ya tiene indicativo país
  if (/^3\d{9}$/.test(digits)) return `57${digits}`;      // móvil de 10 dígitos
  return null;
}

// THE single phone normalizer — canonical stored/compared form of a Colombian
// mobile: E.164 "+57" + 10 digits ("+573XXXXXXXXX"). Strips spaces/dashes/parens
// via `toWhatsappNumber` and prepends "+"; returns null for anything that isn't a
// Colombian mobile. Used at EVERY point a phone is written (Customer.telefono and
// the order snapshot) AND at every lookup — phone matching is worthless unless
// BOTH sides pass through here, so a stored "+57 310 234 5678" and a typed
// "3102345678" resolve to the same "+573102345678".
export function normalizeCustomerPhone(phone: string | null | undefined): string | null {
  const digits = toWhatsappNumber(phone); // "573XXXXXXXXX" | null
  return digits ? `+${digits}` : null;
}

// Enlace wa.me para escribirle AL CLIENTE (distinto de whatsappHref, que usa el
// número del negocio). Devuelve null si el teléfono no es válido.
export function customerWhatsappHref(phone: string | null | undefined, mensaje: string): string | null {
  const num = toWhatsappNumber(phone);
  if (!num) return null;
  return `https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`;
}
