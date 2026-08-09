import type { Brand } from '@/lib/notifications/brand';

// Bloques compartidos de los correos al cliente. Solo tablas + estilos inline
// (seguro en Gmail/Outlook — sin flex/grid, sin <style>, sin CSS externo). El
// color y la identidad NO se conocen a nivel de módulo: llegan por `brand`.

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export { esc };

/** Fila de contenido con padding — SIN color, segura a nivel de módulo. */
export const row = (inner: string) => `<tr><td style="padding:12px 28px 0;">${inner}</td></tr>`;

/**
 * Helpers cerrados sobre la marca (colores + nombre + tagline). Cada plantilla
 * llama `emailKit(brand)` una vez y usa lo que devuelve — así ningún color ni
 * negocio queda incrustado en el módulo. `esc`/`row` no dependen de la marca y
 * viven afuera.
 */
export function emailKit(brand: Brand) {
  const C = brand.colors;

  const p = (text: string, extra = '') =>
    `<p style="margin:0 0 10px;font-size:15px;line-height:1.55;color:${C.espresso};${extra}">${text}</p>`;

  const muted = (text: string) =>
    `<p style="margin:0 0 10px;font-size:13px;line-height:1.5;color:${C.muted};">${text}</p>`;

  /** Documento HTML completo: página crema centrada + tarjeta blanca, header + footer. */
  const shell = (opts: { heading: string; bodyRows: string; preheader: string }): string =>
    `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:${C.crema};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.crema};padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${C.papel};border:1px solid ${C.borde};border-radius:14px;overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
      <tr><td style="padding:24px 28px 8px;">
        <p style="margin:0;font-size:18px;font-weight:700;color:${C.espresso};letter-spacing:.2px;">${esc(brand.nombre)}</p>
        <p style="margin:2px 0 0;font-size:12px;color:${C.muted};">${esc(brand.tagline)}</p>
      </td></tr>
      <tr><td style="padding:8px 28px 0;">
        <h1 style="margin:12px 0 4px;font-size:20px;font-weight:700;color:${C.espresso};">${esc(opts.heading)}</h1>
      </td></tr>
      ${opts.bodyRows}
      <tr><td style="padding:20px 28px 26px;border-top:1px solid ${C.borde};">
        <p style="margin:0;font-size:12px;line-height:1.6;color:${C.muted};">
          ${esc(brand.nombre)} · ${esc(brand.tagline)}<br>
          Este es un correo automático de tu pedido; no necesitas responder.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  return { C, p, muted, shell };
}
