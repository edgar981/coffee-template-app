import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from '@/constants/upload';

// ─── Qué se acepta como comprobante ──────────────────────────────────────────
// Lista propia y NO la de las imágenes de producto (`TIPOS_PERMITIDOS`), porque
// acepta una cosa más: **PDF**. No es una concesión teórica — Bancolombia entrega
// sus soportes de transferencia en PDF, así que rechazarlos obligaría al cliente
// a fotografiar una pantalla para mandar algo peor.
//
// Por eso son dos listas y no una ampliada: una portada de catálogo en PDF sería
// un bug (`next/image` no la renderiza), y unificarlas lo volvería posible.
//
// El TOPE se comparte con el de imágenes a propósito: el límite real no es de
// producto, es de plataforma (el body de una función serverless de Vercel se
// corta en 4.5 MB antes de que el handler corra).
export const TIPOS_COMPROBANTE = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export type TipoComprobante = (typeof TIPOS_COMPROBANTE)[number];

/** Para el `accept` del input de archivo. */
export const ACCEPT_COMPROBANTE = TIPOS_COMPROBANTE.join(',');

export const MAX_COMPROBANTE_BYTES = MAX_UPLOAD_BYTES;
export const MAX_COMPROBANTE_MB    = MAX_UPLOAD_MB;

/** Prefijo del blob. El `dev/` por entorno lo antepone `lib/storage.ts`. */
export const PREFIJO_COMPROBANTES = 'comprobantes';
