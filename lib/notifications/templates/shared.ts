import { siteConfig } from '@/lib/config/site';

// Shared building blocks for the customer emails. Table-based + inline styles only
// (Gmail/Outlook safe — no flex/grid, no <style> blocks, no external CSS). Storefront
// palette (cream/espresso), NEVER the admin's amber design system.

export const C = siteConfig.tienda.emailColors;

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Full HTML document wrapper: centered cream page + white card, brand header + footer. */
export function shell(opts: { heading: string; bodyRows: string; preheader: string }): string {
  const { nombre } = siteConfig.tienda;
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:${C.crema};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.crema};padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${C.papel};border:1px solid ${C.borde};border-radius:14px;overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
      <tr><td style="padding:24px 28px 8px;">
        <p style="margin:0;font-size:18px;font-weight:700;color:${C.espresso};letter-spacing:.2px;">${esc(nombre)}</p>
        <p style="margin:2px 0 0;font-size:12px;color:${C.muted};">${esc(siteConfig.brand.tagline)}</p>
      </td></tr>
      <tr><td style="padding:8px 28px 0;">
        <h1 style="margin:12px 0 4px;font-size:20px;font-weight:700;color:${C.espresso};">${esc(opts.heading)}</h1>
      </td></tr>
      ${opts.bodyRows}
      <tr><td style="padding:20px 28px 26px;border-top:1px solid ${C.borde};">
        <p style="margin:0;font-size:12px;line-height:1.6;color:${C.muted};">
          ${esc(nombre)} · ${esc(siteConfig.brand.tagline)}<br>
          Este es un correo automático de tu pedido; no necesitas responder.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

/** A padded content row inside the card. */
export const row = (inner: string) => `<tr><td style="padding:12px 28px 0;">${inner}</td></tr>`;

export const p = (text: string, extra = '') =>
  `<p style="margin:0 0 10px;font-size:15px;line-height:1.55;color:${C.espresso};${extra}">${text}</p>`;

export const muted = (text: string) =>
  `<p style="margin:0 0 10px;font-size:13px;line-height:1.5;color:${C.muted};">${text}</p>`;

export { esc };
