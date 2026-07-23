// Enlace de WhatsApp de pedidos (mismo número que el footer). Client-safe:
// solo arma la URL wa.me con mensaje precargado — no envía nada (eso es
// lib/whatsapp.ts, server-side vía Twilio).
//
// Fuente única del número: lib/config/site.ts (contacto.whatsapp).
import { siteConfig, whatsappUrl } from "@/lib/config/site";

export const WHATSAPP_PEDIDOS = siteConfig.contacto.whatsapp.replace(/\D/g, "");

export function whatsappHref(mensaje: string): string {
  return whatsappUrl(mensaje);
}

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

// Enlace wa.me para escribirle AL CLIENTE (distinto de whatsappHref, que usa el
// número del negocio). Devuelve null si el teléfono no es válido.
export function customerWhatsappHref(phone: string | null | undefined, mensaje: string): string | null {
  const num = toWhatsappNumber(phone);
  if (!num) return null;
  return `https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`;
}
