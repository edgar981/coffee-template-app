import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import { CATEGORIAS } from '@/constants/product';
import { nonCancelledOrderCountByCustomer } from '@/lib/metrics/customer-order-stats';
import type { ProductCategory } from '@/types/product';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const now       = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);

  // ── All data needed in one query batch ──────────────────────────────────────

  const [orders, totalCustomers, products, orderItems, allProducts, ordenesByCustomer] = await Promise.all([
    prisma.order.findMany({
      where:   { createdAt: { gte: yearStart } },
      select:  { total: true, canal: true, estado: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.customer.count(),
    prisma.product.findMany({
      where:  { activo: true },
      select: { costo: true, precio: true, stock: true },
    }),
    // Line items for non-cancelled orders this year, for the sales-by-category
    // breakdown. `producto_id` may be null on older/imported items, so we also
    // keep the name to resolve the category by fallback below.
    prisma.orderItem.findMany({
      where:  { order: { createdAt: { gte: yearStart }, estado: { not: 'cancelado' } } },
      // `cantidad` se suma acá para el ranking de productos: es UNA columna más
      // sobre la consulta que ya se hacía para el desglose por categoría, no una
      // consulta nueva. Antes ese ranking (y el gráfico de ingresos por
      // producto) se pintaban con un fixture del repo.
      select: { subtotal: true, cantidad: true, producto_nombre: true, product: { select: { categoria: true } } },
    }),
    prisma.product.findMany({ select: { nombre: true, categoria: true } }),
    // Recurrentes uses the SHARED "N órdenes" definition (non-cancelled), not the
    // stale seed `numero_ordenes` — same as the Clientes page.
    nonCancelledOrderCountByCustomer(),
  ]);

  // ── KPIs ───────────────────────────────────────────────────────────────────

  const completedOrders = orders.filter(o => o.estado !== 'cancelado');
  const totalRevenue    = completedOrders.reduce((sum, o) => sum + o.total, 0);
  const ticketPromedio  = completedOrders.length > 0
    ? totalRevenue / completedOrders.length
    : 0;

  const recurrentes    = [...ordenesByCustomer.values()].filter(n => n > 1).length;
  const tasaRetencion  = totalCustomers > 0
    ? Math.round((recurrentes / totalCustomers) * 100)
    : 0;

  const margenBruto = products.length > 0
    ? Math.round(
        products.reduce((sum, p) => {
          if (!p.precio) return sum;
          return sum + ((p.precio - p.costo) / p.precio) * 100;
        }, 0) / products.length
      )
    : 0;

  // ── Sales by month ─────────────────────────────────────────────────────────

  const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  const salesByMonth = MESES.map((mes, i) => {
    const monthOrders = completedOrders.filter(o => new Date(o.createdAt).getMonth() === i);
    return {
      mes,
      ventas:  monthOrders.reduce((sum, o) => sum + o.total, 0),
      ordenes: monthOrders.length,
    };
  });

  // ── Canal distribution ─────────────────────────────────────────────────────

  const canalCounts = completedOrders.reduce<Record<string, number>>((acc, o) => {
    const canal = o.canal ?? 'directo';
    acc[canal]  = (acc[canal] ?? 0) + 1;
    return acc;
  }, {});

  const totalOrderCount = completedOrders.length || 1;
  const canalData = Object.entries(canalCounts)
    .map(([name, count]) => ({
      name:  name.charAt(0).toUpperCase() + name.slice(1),
      value: Math.round((count / totalOrderCount) * 100),
    }))
    .sort((a, b) => b.value - a.value);

  // ── Sales by product category ──────────────────────────────────────────────
  // Resolve each line item's category via its product relation, falling back to
  // a name match for items with no `producto_id`. Values are % of attributable
  // sales.

  const nameToCategoria = new Map(allProducts.map(p => [p.nombre, p.categoria]));

  const categoriaSales = orderItems.reduce<Record<string, number>>((acc, it) => {
    const categoria = it.product?.categoria ?? nameToCategoria.get(it.producto_nombre);
    if (!categoria) return acc;
    acc[categoria] = (acc[categoria] ?? 0) + it.subtotal;
    return acc;
  }, {});

  const totalCategoriaSales =
    Object.values(categoriaSales).reduce((sum, v) => sum + v, 0) || 1;

  const categoryData = Object.entries(categoriaSales)
    .map(([categoria, sales]) => ({
      name:  CATEGORIAS[categoria as ProductCategory] ?? categoria,
      value: Math.round((sales / totalCategoriaSales) * 100),
    }))
    .sort((a, b) => b.value - a.value);

  // ── Top productos ──────────────────────────────────────────────────────────
  // Ranking REAL por unidades, del mismo lote de line items de arriba. Se agrupa
  // por `producto_nombre` (el snapshot de la línea) y no por `producto_id`,
  // porque un item viejo puede no tener FK y aun así representa una venta que
  // ocurrió; agrupar por id perdería esas unidades.
  //
  // Alimenta DOS secciones —"Productos Más Vendidos" (unidades) e "Ingresos por
  // Producto" (subtotal)— que antes se pintaban con `constants/analytics`, un
  // fixture con productos que ni siquiera existen en el catálogo.

  const porProducto = orderItems.reduce<Record<string, { unidades: number; ingresos: number }>>((acc, it) => {
    const clave = it.producto_nombre;
    acc[clave] ??= { unidades: 0, ingresos: 0 };
    acc[clave].unidades += it.cantidad;
    acc[clave].ingresos += it.subtotal;
    return acc;
  }, {});

  const TOP_PRODUCTOS = 6;
  const topProducts = Object.entries(porProducto)
    .map(([producto, v]) => ({ producto, ...v }))
    .sort((a, b) => b.unidades - a.unidades)
    .slice(0, TOP_PRODUCTOS);

  // Orders-by-day-of-week moved to GET /api/analytics/weekly: the card now
  // shows ONE navigable Monday–Sunday week (Bogotá, SQL-bucketed) instead of
  // all-history aggregation — and the old code here silently zeroed Sundays.

  return NextResponse.json({
    kpis: {
      totalRevenue,
      ticketPromedio,
      tasaRetencion,
      margenBruto,
      totalOrders:    completedOrders.length,
      totalCustomers,
    },
    salesByMonth,
    canalData,
    categoryData,
    topProducts,
  });
}