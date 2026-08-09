import { formatCOP } from '@/lib/utils';
import type { Brand, EmailColors } from '@/lib/notifications/brand';
import type { NotifiableOrder } from '@/lib/notifications/data';
import { trackOrderUrl } from '@/lib/notifications/data';
import { row, esc, emailKit, type RenderedEmail } from './shared';

const firstName = (nombre: string | null) => (nombre?.trim().split(/\s+/)[0]) || 'Hola';

// Next-step line, by payment condition. Never invents payment data (no account
// numbers, no links): anticipado-pendiente points to WhatsApp; contraentrega says
// "pay on delivery"; an already-paid order confirms.
function siguientePaso(order: NotifiableOrder): string {
  if (order.condicion_pago === 'CONTRAENTREGA') {
    return 'Pagas al recibir tu pedido (contraentrega).';
  }
  if (order.estado === 'pagado') {
    return 'Tu pago está confirmado. Preparamos tu pedido y te avisamos cuando vaya en camino.';
  }
  return 'Te escribiremos por WhatsApp para coordinar el pago y la entrega.';
}

function itemsTable(order: NotifiableOrder, C: EmailColors): string {
  const rows = order.items.map((it) => {
    const sub = it.moliendaSeleccionada
      ? `<span style="color:${C.muted};font-size:12px;"> · ${esc(it.moliendaSeleccionada)}</span>`
      : '';
    const unit = it.precio_unitario != null
      ? `<span style="color:${C.muted};font-size:12px;"> (${formatCOP(it.precio_unitario)} c/u)</span>`
      : '';
    return `<tr>
      <td style="padding:8px 0;border-bottom:1px solid ${C.borde};font-size:14px;color:${C.espresso};">
        ${esc(it.producto_nombre)}${sub}<br><span style="color:${C.muted};font-size:12px;">Cantidad: ${it.cantidad}${unit}</span>
      </td>
      <td style="padding:8px 0;border-bottom:1px solid ${C.borde};font-size:14px;color:${C.espresso};text-align:right;white-space:nowrap;">${formatCOP(it.subtotal)}</td>
    </tr>`;
  }).join('');

  const itemsSubtotal = order.items.reduce((s, it) => s + it.subtotal, 0);
  const totalRow = (label: string, value: string, strong = false) => `<tr>
      <td style="padding:6px 0;font-size:${strong ? '15px' : '13px'};color:${strong ? C.espresso : C.muted};${strong ? 'font-weight:700;' : ''}">${esc(label)}</td>
      <td style="padding:6px 0;font-size:${strong ? '15px' : '13px'};color:${strong ? C.espresso : C.muted};text-align:right;white-space:nowrap;${strong ? 'font-weight:700;' : ''}">${value}</td>
    </tr>`;

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    ${rows}
    ${totalRow('Subtotal', formatCOP(itemsSubtotal))}
    ${totalRow('Envío', order.costo_envio > 0 ? formatCOP(order.costo_envio) : 'Gratis')}
    ${totalRow('Total', formatCOP(order.total), true)}
  </table>`;
}

function direccion(order: NotifiableOrder): string | null {
  if (!order.direccion_entrega) return null;
  const parts = [order.direccion_entrega, order.direccion_detalle, order.ciudad_entrega].filter(Boolean);
  return parts.join(', ');
}

export function renderOrderCreated(order: NotifiableOrder, brand: Brand): RenderedEmail {
  const { C, p, muted, shell } = emailKit(brand);
  const { nombre } = brand;
  const subject = `Tu orden ${order.numero_orden} en ${nombre}`;
  const dir = direccion(order);
  const track = order.cliente_email ? trackOrderUrl(order.numero_orden, order.cliente_email) : null;

  const bodyRows =
    row(p(`Hola ${esc(firstName(order.cliente_nombre))}, recibimos tu orden <strong>${esc(order.numero_orden)}</strong>. ¡Gracias por tu compra!`)) +
    row(`<p style="margin:14px 0 6px;font-size:13px;font-weight:700;color:${C.muted};text-transform:uppercase;letter-spacing:.5px;">Resumen</p>${itemsTable(order, C)}`) +
    (dir ? row(`<p style="margin:14px 0 2px;font-size:13px;font-weight:700;color:${C.muted};text-transform:uppercase;letter-spacing:.5px;">Entrega</p>${p(esc(dir))}`) : '') +
    row(muted(siguientePaso(order))) +
    (track ? row(`<p style="margin:6px 0 4px;"><a href="${track}" style="display:inline-block;background:${C.cafe};color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 20px;border-radius:10px;">Ver estado de mi pedido</a></p>`) : '');

  const html = shell({ heading: '¡Recibimos tu orden!', bodyRows, preheader: `Tu orden ${order.numero_orden} fue registrada.` });

  // ── Plain-text alternative ──
  const lines: string[] = [
    `Hola ${firstName(order.cliente_nombre)}, recibimos tu orden ${order.numero_orden}. ¡Gracias por tu compra!`,
    '',
    'Resumen:',
    ...order.items.map((it) => `- ${it.producto_nombre}${it.moliendaSeleccionada ? ` (${it.moliendaSeleccionada})` : ''} x${it.cantidad}  ${formatCOP(it.subtotal)}`),
    `Envío: ${order.costo_envio > 0 ? formatCOP(order.costo_envio) : 'Gratis'}`,
    `Total: ${formatCOP(order.total)}`,
  ];
  if (dir) lines.push('', `Entrega: ${dir}`);
  lines.push('', siguientePaso(order));
  if (track) lines.push('', `Ver estado: ${track}`);
  lines.push('', `${nombre} · ${brand.tagline}`);

  return { subject, html, text: lines.join('\n') };
}
