import { formatCOP } from '@duna/core/utils';
import { formatFecha } from '@duna/core/format-fecha';
import type { Brand } from '@duna/core/notifications/brand';
import type { NotifiableOrder } from '@duna/core/notifications/data';
import { trackOrderUrl } from '@duna/core/notifications/data';
import { row, esc, emailKit, type RenderedEmail } from './shared';

const firstName = (nombre: string | null) => (nombre?.trim().split(/\s+/)[0]) || 'Hola';

/** Por cobrar = contraentrega despachada sin pago registrado (la plata está en la calle). */
const isPorCobrar = (order: NotifiableOrder) =>
  order.condicion_pago === 'CONTRAENTREGA' && order.estado !== 'pagado';

function direccion(order: NotifiableOrder): string | null {
  if (!order.direccion_entrega) return null;
  return [order.direccion_entrega, order.direccion_detalle, order.ciudad_entrega].filter(Boolean).join(', ');
}

export function renderOrderEnRoute(order: NotifiableOrder, brand: Brand): RenderedEmail {
  const { C, p, shell } = emailKit(brand);
  const { nombre } = brand;
  const subject = `Tu orden ${order.numero_orden} va en camino`;
  const dir = direccion(order);
  const mensajero = order.shipping?.mensajero?.trim() || null;
  const fecha = order.shipping?.fecha_programada?.trim() || null;
  const porCobrar = isPorCobrar(order);
  const track = order.cliente_email ? trackOrderUrl(order.numero_orden, order.cliente_email) : null;

  const detalle = (label: string, value: string) =>
    `<tr>
       <td style="padding:6px 0;font-size:13px;color:${C.muted};white-space:nowrap;">${esc(label)}</td>
       <td style="padding:6px 0 6px 14px;font-size:14px;color:${C.espresso};">${esc(value)}</td>
     </tr>`;

  const detalleRows = [
    mensajero ? detalle('Mensajero', mensajero) : '',
    fecha ? detalle('Fecha programada', formatFecha(fecha)) : '',
    dir ? detalle('Entrega', dir) : '',
  ].join('');

  const bodyRows =
    row(p(`Hola ${esc(firstName(order.cliente_nombre))}, tu orden <strong>${esc(order.numero_orden)}</strong> salió y va en camino. 🚚`)) +
    (detalleRows ? row(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${detalleRows}</table>`) : '') +
    (porCobrar
      ? row(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.crema};border:1px solid ${C.borde};border-radius:10px;">
           <tr><td style="padding:12px 14px;font-size:14px;color:${C.espresso};">Total a pagar al recibir<br><span style="font-size:20px;font-weight:700;">${formatCOP(order.total)}</span></td></tr>
         </table>`)
      : '') +
    (track ? row(`<p style="margin:8px 0 4px;"><a href="${track}" style="display:inline-block;background:${C.cafe};color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 20px;border-radius:10px;">Seguir mi pedido</a></p>`) : '');

  const html = shell({ heading: 'Tu pedido va en camino', bodyRows, preheader: `Tu orden ${order.numero_orden} salió a ruta.` });

  // ── Plain-text alternative ──
  const lines: string[] = [
    `Hola ${firstName(order.cliente_nombre)}, tu orden ${order.numero_orden} salió y va en camino.`,
    '',
  ];
  if (mensajero) lines.push(`Mensajero: ${mensajero}`);
  if (fecha) lines.push(`Fecha programada: ${formatFecha(fecha)}`);
  if (dir) lines.push(`Entrega: ${dir}`);
  if (porCobrar) lines.push('', `Total a pagar al recibir: ${formatCOP(order.total)}`);
  if (track) lines.push('', `Seguir mi pedido: ${track}`);
  lines.push('', `${nombre} · ${brand.tagline}`);

  return { subject, html, text: lines.join('\n') };
}
