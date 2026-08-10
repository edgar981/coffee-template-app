import prisma from '@duna/core';
import { formatCOP } from '@duna/core/utils';
import { formatFecha } from '@duna/core/format-fecha';
import { BUSINESS_TZ, startOfZonedDay, startOfZonedWeek, zonedDayKey } from '@duna/core/timezone';
import { NOT_CANCELLED, REVENUE_ORDER_SCOPE, POR_COBRAR_WHERE, ORDENES_REALES } from '@duna/core/metrics/prisma-scopes';
import type { RenderedEmail } from '@duna/core/notifications/templates/shared';

// Los reportes al EQUIPO. Todas las cifras salen de los scopes compartidos
// (lib/metrics/prisma-scopes) — los mismos que cuenta /api/dashboard/stats — para
// que el correo del lunes y el panel no puedan decir cosas distintas:
//   · ingreso = libro de PAGOS (Payment), no el total de las órdenes;
//   · sólo órdenes reales (`CN-`), nunca canceladas;
//   · "por cobrar" = contraentrega despachada y sin pagar.

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Paleta neutra del PANEL — ni la crema del storefront ni el ámbar sólido del
// admin. Es un correo interno: debe leerse como una herramienta, no como marca.
const T = {
  fondo: '#f5f5f4', papel: '#ffffff', texto: '#1c1917',
  muted: '#78716c', borde: '#e7e5e4', dato: '#0c0a09',
};

interface Fila { label: string; valor: string; nota?: string }

function shellEquipo(titulo: string, subtitulo: string, filas: Fila[], cierre: string): RenderedEmail['html'] {
  const filasHtml = filas.map(f => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid ${T.borde};">
        <span style="font-size:13px;color:${T.muted};">${esc(f.label)}</span>
        ${f.nota ? `<br><span style="font-size:11px;color:${T.muted};">${esc(f.nota)}</span>` : ''}
      </td>
      <td align="right" style="padding:10px 0;border-bottom:1px solid ${T.borde};">
        <span style="font-size:16px;font-weight:700;color:${T.dato};">${esc(f.valor)}</span>
      </td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:${T.fondo};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${T.fondo};padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${T.papel};border:1px solid ${T.borde};border-radius:14px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
      <tr><td style="padding:24px 28px 4px;">
        <h1 style="margin:0;font-size:19px;font-weight:700;color:${T.texto};">${esc(titulo)}</h1>
        <p style="margin:4px 0 0;font-size:13px;color:${T.muted};">${esc(subtitulo)}</p>
      </td></tr>
      <tr><td style="padding:12px 28px 4px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filasHtml}</table>
      </td></tr>
      <tr><td style="padding:16px 28px 24px;">
        <p style="margin:0;font-size:12px;line-height:1.6;color:${T.muted};">${esc(cierre)}</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

const textoDe = (titulo: string, subtitulo: string, filas: Fila[], cierre: string) =>
  [`${titulo}`, subtitulo, '', ...filas.map(f => `${f.label}: ${f.valor}${f.nota ? ` (${f.nota})` : ''}`), '', cierre].join('\n');

// ─── Reporte SEMANAL ─────────────────────────────────────────────────────────
// Corre los lunes y reporta la semana COMPLETA que acaba de cerrar (lunes a
// domingo pasados), no la que empieza hoy: un reporte de una semana con horas de
// vida no le sirve a nadie.
export async function construirReporteSemanal(now: Date): Promise<RenderedEmail> {
  const inicio = startOfZonedWeek(now, BUSINESS_TZ, -1);
  const fin    = startOfZonedWeek(now, BUSINESS_TZ, 0);

  const [ingresos, ordenes, porCobrar, items] = await Promise.all([
    prisma.payment.aggregate({
      where: { ...REVENUE_ORDER_SCOPE, fecha: { gte: inicio, lt: fin } },
      _sum:  { monto: true }, _count: true,
    }),
    prisma.order.count({
      where: { ...NOT_CANCELLED, ...ORDENES_REALES, createdAt: { gte: inicio, lt: fin } },
    }),
    prisma.order.aggregate({ where: POR_COBRAR_WHERE, _sum: { total: true }, _count: true }),
    // Top producto de la semana, por unidades vendidas.
    prisma.orderItem.groupBy({
      by:      ['producto_nombre'],
      where:   { order: { ...NOT_CANCELLED, ...ORDENES_REALES, createdAt: { gte: inicio, lt: fin } } },
      _sum:    { cantidad: true },
      orderBy: { _sum: { cantidad: 'desc' } },
      take:    1,
    }),
  ]);

  const top = items[0];
  const filas: Fila[] = [
    { label: 'Ventas de la semana', valor: formatCOP(ingresos._sum.monto ?? 0),
      nota: `${ingresos._count} pago${ingresos._count === 1 ? '' : 's'} recibido${ingresos._count === 1 ? '' : 's'}` },
    { label: 'Órdenes nuevas', valor: String(ordenes) },
    { label: 'Por cobrar', valor: formatCOP(porCobrar._sum.total ?? 0),
      nota: `${porCobrar._count} orden${porCobrar._count === 1 ? '' : 'es'} contraentrega sin pagar` },
    { label: 'Producto más vendido',
      valor: top?.producto_nombre ?? '—',
      nota:  top ? `${top._sum.cantidad ?? 0} unidades` : 'sin ventas en la semana' },
  ];

  const subtitulo = `Del ${formatFecha(inicio)} al ${formatFecha(new Date(fin.getTime() - 1))}`;
  const titulo    = 'Reporte semanal de ventas';
  const cierre    = 'Cifras del panel de Café Nayoli. Los ingresos cuentan pagos recibidos, no órdenes creadas.';

  return {
    subject: `Reporte semanal · ${formatCOP(ingresos._sum.monto ?? 0)} en ventas`,
    html:    shellEquipo(titulo, subtitulo, filas, cierre),
    text:    textoDe(titulo, subtitulo, filas, cierre),
  };
}

// ─── Resumen DIARIO ──────────────────────────────────────────────────────────
export async function construirResumenDiario(now: Date): Promise<RenderedEmail> {
  const ayer = startOfZonedDay(now, BUSINESS_TZ, -1);
  const hoy  = startOfZonedDay(now, BUSINESS_TZ, 0);
  const hoyKey = zonedDayKey(now, BUSINESS_TZ);

  const [ingresos, ordenes, porCobrar, despachosHoy] = await Promise.all([
    prisma.payment.aggregate({
      where: { ...REVENUE_ORDER_SCOPE, fecha: { gte: ayer, lt: hoy } },
      _sum:  { monto: true },
    }),
    prisma.order.count({
      where: { ...NOT_CANCELLED, ...ORDENES_REALES, createdAt: { gte: ayer, lt: hoy } },
    }),
    prisma.order.aggregate({ where: POR_COBRAR_WHERE, _sum: { total: true }, _count: true }),
    // Programados para HOY y todavía sin salir. `fecha_programada` es una fecha de
    // calendario (`YYYY-MM-DD`), por eso se compara contra la clave de día local.
    prisma.shipping.count({
      where: { fecha_programada: hoyKey, estado: { in: ['preparando', 'en_ruta'] } },
    }),
  ]);

  const filas: Fila[] = [
    { label: 'Ventas de ayer', valor: formatCOP(ingresos._sum.monto ?? 0) },
    { label: 'Órdenes nuevas de ayer', valor: String(ordenes) },
    { label: 'Por cobrar', valor: formatCOP(porCobrar._sum.total ?? 0),
      nota: `${porCobrar._count} orden${porCobrar._count === 1 ? '' : 'es'} contraentrega sin pagar` },
    { label: 'Despachos programados para hoy', valor: String(despachosHoy) },
  ];

  const titulo    = 'Resumen diario';
  const subtitulo = `Ayer, ${formatFecha(ayer)}`;
  const cierre    = 'Cifras del panel de Café Nayoli. Los ingresos cuentan pagos recibidos, no órdenes creadas.';

  return {
    subject: `Resumen diario · ${formatCOP(ingresos._sum.monto ?? 0)} ayer`,
    html:    shellEquipo(titulo, subtitulo, filas, cierre),
    text:    textoDe(titulo, subtitulo, filas, cierre),
  };
}
