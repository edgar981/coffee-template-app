'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { DunaTooltip } from '@/components/admin/DunaTooltip';
import { getDashboardStats } from '@/lib/api/dashboard';
import { getAnalytics } from '@/lib/api/analytics';
import { getProducts } from '@/lib/api/products';
import { getCustomers } from '@/lib/api/customers';
import { getDashboardPrefs, saveDashboardPrefs } from '@/lib/api/dashboardPrefs';
import type { Order } from '@/types/order';
import type { Product } from '@/types/product';
import type { Customer } from '@/types/customer';
import type { DashboardStats } from '@/types/dashboard';
import type { AnalyticsData } from '@/types/analytics';
import { formatCOP } from '@duna/core/utils';
import StatCard from '@/components/admin/StatCard';
import DashboardCustomizer from '@/components/admin/DashboardCustomizer';
import CurvaPedidosHoy from '@/components/admin/CurvaPedidosHoy';
import { curvaDibuja } from '@/lib/dashboard/hoy';
import type { Trend } from '@/lib/metrics/trend';
import { computeTrend, NEUTRAL_TREND } from '@/lib/metrics/trend';
import { currentMonthOrdersQuery, currentMonthRange } from '@duna/core/metrics/order-stat-filters';
import { isLowStock } from '@duna/core/metrics/inventory-filters';
import {
  WIDGET_MAP, DEFAULT_WIDGET_KEYS, chipTono,
  type WidgetFormato, type WidgetHrefContext,
} from '@/constants/dashboard-widgets';
import { formatFecha } from '@duna/core/format-fecha';
import type { WidgetInsightData } from '@/lib/metrics/insights';

// ─── Eyebrow con reloj vivo ───────────────────────────────────────────────────
// Fecha y hora en Bogotá (la hora de operación, no la del navegador), actualizadas
// cada minuto ALINEADAS al borde del minuto: un `setTimeout` hasta el próximo `:00`
// de segundos y luego un `setInterval` de 60s, para que el número cambie cuando el
// reloj lo hace y no con lag. AISLADO en su propio componente a propósito —sólo esto
// re-renderiza cada minuto, no el Dashboard (stats, grid, listas)—. Una hora
// congelada al cargar envejecería en pantalla, que es peor que no tenerla.
const FMT_EYEBROW_FECHA = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'long',
});
const FMT_EYEBROW_HORA = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit', hour12: true,
});
function EyebrowReloj() {
  // El inicializador captura el minuto correcto al montar; el intervalo alineado lo
  // refresca en cada borde de minuto. No hay setState síncrono en el efecto (sólo en
  // los callbacks de los timers), así que no dispara renders en cascada (§ #27).
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    let intervalo: ReturnType<typeof setInterval> | undefined;
    const alProximoMinuto = 60_000 - (Date.now() % 60_000);
    const arranque = setTimeout(() => {
      setAhora(new Date());
      intervalo = setInterval(() => setAhora(new Date()), 60_000);
    }, alProximoMinuto);
    return () => { clearTimeout(arranque); if (intervalo) clearInterval(intervalo); };
  }, []);
  // es-CO da "jueves, 6 de agosto" y "4:20 p. m." (meridiano con espacio/NBSP): se
  // capitaliza el día y se compacta "p. m." → "p.m.".
  const fecha = FMT_EYEBROW_FECHA.format(ahora);
  const hora  = FMT_EYEBROW_HORA.format(ahora)
    .replace(/\s+/g, ' ').replace(/([ap])\. m\./i, '$1.m.');
  // `suppressHydrationWarning`: el reloj es dinámico por diseño, así que la hora del
  // SSR y la del cliente pueden diferir sin que sea un bug.
  return (
    <p className="duna-eyebrow" style={{ margin: 0 }} suppressHydrationWarning>
      {fecha.charAt(0).toUpperCase() + fecha.slice(1)} · {hora}
    </p>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter();
  const [stats, setStats]           = useState<DashboardStats | null>(null);
  const [analytics, setAnalytics]   = useState<AnalyticsData | null>(null);
  const [products, setProducts]     = useState<Product[]>([]);
  const [customers, setCustomers]   = useState<Customer[]>([]);
  // The admin's chosen stat-card layout (ordered visible widget keys). Defaults to
  // the registry default until the persisted preference loads.
  const [widgetKeys, setWidgetKeys] = useState<string[]>(DEFAULT_WIDGET_KEYS);
  const [customizing, setCustomizing] = useState(false);
  const [loading, setLoading]       = useState(true);

  // Core dashboard data. Each source settles INDEPENDENTLY so one failing fetch
  // can't blank the rest. A rejected source is set to null/empty (not left stale),
  // so the UI can show `—` + a retry banner instead of a lying `0`. `setLoading` on
  // finish only — the mount path leaves the initial `loading=true` untouched.
  const fetchCore = useCallback(() => {
    Promise.allSettled([getDashboardStats(), getAnalytics(), getProducts(), getCustomers()])
      .then(([s, a, p, c]) => {
        setStats(s.status === 'fulfilled' ? s.value : null);
        setAnalytics(a.status === 'fulfilled' ? a.value : null);
        if (p.status === 'fulfilled') setProducts(p.value);
        if (c.status === 'fulfilled') setCustomers(c.value);
        setLoading(false);
      });
  }, []);

  // Banner "Reintentar": back to the skeleton, then re-fetch.
  const retry = useCallback(() => { setLoading(true); fetchCore(); }, [fetchCore]);

  useEffect(() => {
    fetchCore(); // `loading` already starts true, so no synchronous setState here.
    // Layout preference is a SEPARATE concern: if it fails, keep the default
    // layout — it must never affect the data widgets/donut/Recientes.
    getDashboardPrefs()
      .then(setWidgetKeys)
      .catch(() => {/* keep DEFAULT_WIDGET_KEYS */});
  }, [fetchCore]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const lowStock       = products.filter(isLowStock).length;
  const activeProducts = products.filter(p => p.activo !== false).length;

  // Deep-link context (America/Bogota day keys + the shared month query), fed to
  // each widget's href builder so a card links to exactly the rows it counts.
  const monthQuery = currentMonthOrdersQuery();
  const { desde: monthStartKey, hasta: todayKey } = currentMonthRange();
  const hrefCtx: WidgetHrefContext = { today: todayKey, monthStart: monthStartKey, monthQuery };

  // Month-over-month trend pills: current calendar month vs previous complete
  // month. The anti-noise floor lives in lib/metrics/trend.ts.
  const m = stats?.monthly;
  const revenueTrend = m ? computeTrend(m.revenue.current,   m.revenue.previous,   m.prevMonthOrders) : NEUTRAL_TREND;
  const ordersTrend  = m ? computeTrend(m.orders.current,    m.orders.previous,    m.prevMonthOrders) : NEUTRAL_TREND;
  const avgTrend     = m ? computeTrend(m.avgTicket.current, m.avgTicket.previous, m.prevMonthOrders) : NEUTRAL_TREND;
  // "Clientes Recurrentes" MoM needs per-month cohort logic the metrics endpoint
  // doesn't have yet → neutral fallback (reported as backend-pending).
  const recurrentesTrend = NEUTRAL_TREND;

  const porCobrarN = stats?.porCobrar ?? 0;

  // Lo que cada widget necesita para su insight: serie mensual (tarjetas de mes) o
  // último evento + día de referencia (tarjetas de scope HOY, que no tienen serie).
  // Sin stats no hay nada → sin insight (la tarjeta ya muestra `—`).
  const insightData: Record<string, WidgetInsightData | undefined> = stats ? {
    ingresos_mes:   { serie: stats.serieMensual.revenue },
    ordenes_mes:    { serie: stats.serieMensual.orders },
    ventas_hoy:     { ultimoEvento: stats.ultimoPago,     hoy: stats.hoyKey },
    despachos_hoy:  { ultimoEvento: stats.ultimoDespacho, hoy: stats.hoyKey },
    pedidos_hoy:    { ultimoEvento: stats.ultimaOrden,    hoy: stats.hoyKey },
  } : {};

  // The ONE place widgets meet data: key → { raw value, live sub, trend }, or
  // `undefined` when THIS widget's source failed to load. `undefined` renders as
  // `—` (a lying `0` is worse than a dash) — stats widgets go blank when the stats
  // endpoint rejected; clientes_recurrentes when analytics did. Registry holds the
  // rest (title, icon, colour, formato, href, static subtitle).
  const widgetValues: Record<string, { raw: number; sub?: string; trend?: Trend } | undefined> = {
    ventas_hoy:           stats ? { raw: stats.ventasHoy } : undefined,
    // Estado, no período: "Nada por cobrar" es el saldo vigente. Sin etiqueta de
    // ventana temporal (ver el comentario de `scopeSuffix` en el registry).
    por_cobrar:           stats ? { raw: stats.porCobrarMonto, sub: porCobrarN > 0 ? `${porCobrarN} ${porCobrarN === 1 ? 'orden' : 'órdenes'} contraentrega` : 'Nada por cobrar' } : undefined,
    despachos_hoy:        stats ? { raw: stats.despachosHoy } : undefined,
    pedidos_hoy:          stats ? { raw: stats.pedidosHoy } : undefined,
    // Sub del registry ("Pagos del mes en curso"): el histórico se fue a su
    // propio widget en vez de colgar de esta tarjeta.
    ingresos_mes:         stats ? { raw: stats.revenueMonth, trend: revenueTrend } : undefined,
    ingresos_historicos:  stats ? { raw: stats.revenueTotal, sub: stats.revenueSince ? `Desde ${formatFecha(stats.revenueSince)}` : undefined } : undefined,
    ordenes_mes:          stats ? { raw: stats.monthly.orders.current, trend: ordersTrend } : undefined,
    // El cross-reference con "Por cobrar" SE QUEDA, pero cambió de signo y por eso
    // cambia el texto: antes las dos tarjetas eran un conjunto y su COMPLEMENTO
    // ("N por cobrar aparte", descontadas de este número); ahora por-cobrar es uno
    // de los cuatro motivos de atención, así que va INCLUIDA. Dejar el "aparte"
    // habría sido la misma frase afirmando lo contrario de lo que pasa.
    // Lo que no cambia es por qué existe la línea: dos tarjetas que hablan de
    // conjuntos que se tocan tienen que decir cómo se tocan, o se leen como cifras
    // rivales. Sin por-cobrar cae al sub del registry.
    pedidos_por_atender:  stats ? { raw: stats.porAtender, sub: porCobrarN > 0 ? `Incluye ${porCobrarN} por cobrar` : undefined } : undefined,
    promedio_por_orden:   stats ? { raw: stats.avgTicket, trend: avgTrend } : undefined,
    // products/customers default to []/[] and load independently of stats.
    alertas_stock:        { raw: lowStock },
    productos_activos:    { raw: activeProducts },
    clientes_totales:     { raw: customers.length },
    // `recurrencia.pct` es el MISMO número que traía `kpis.tasaRetencion`
    // (recurrentes sobre el total de clientes); el rediseño de Analítica solo lo
    // movió a un campo que dice qué es. La fórmula sigue viviendo en un único
    // lugar del server, así que esta tarjeta y la de Clientes no pueden divergir.
    clientes_recurrentes: analytics ? { raw: analytics.recurrencia.pct, trend: recurrentesTrend } : undefined,
  };

  const formatValue = (formato: WidgetFormato, raw: number) =>
    formato === 'cop' ? formatCOP(raw) : formato === 'pct' ? `${raw}%` : String(raw);

  // A metrics source (stats or analytics) failed after loading finished — surface
  // ONE banner with a retry instead of a grid full of dashes with no explanation.
  const metricsFailed = !loading && (stats === null || analytics === null);

  // Optimistic: re-render the grid immediately, then persist. On failure, a toast
  // whose "Reintentar" reuses the SAME keys that failed (captured here, not read
  // from state which may have moved on).
  const applyWidgets = (keys: string[]) => {
    setWidgetKeys(keys);
    const persist = (attemptKeys: string[]) =>
      saveDashboardPrefs(attemptKeys).catch(() =>
        toast.error('No se pudo guardar la configuración del panel', {
          action: { label: 'Reintentar', onClick: () => persist(attemptKeys) },
        }),
      );
    persist(keys);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  // La pantalla es del DÍA. Dos cifras, DOS CONJUNTOS DISTINTOS, y cada una lo DECLARA
  // (§ contrato del período): el HERO mide PAGOS RECIBIDOS hoy —de pedidos de
  // cualquier día—; la CURVA mide PEDIDOS CREADOS hoy —pagados o no—. Ésa es la
  // distinción que el operador necesita (dinero-que-entró vs pedidos-que-llegaron),
  // no la de canceladas (un detalle de definición que no va en la copy).
  const ventasHoy = stats?.ventasHoy ?? 0;
  const pedidosHoy = stats?.pedidosHoy ?? 0;
  const pedidosPorHora = stats?.pedidosPorHora ?? [];

  return (
    <div className="duna space-y-6">
      {/* CABECERA: eyebrow (la fecha de hoy) + el HERO del dinero, con Personalizar a
          la derecha. El hero es el titular —"Hoy entraron $X"—, no un rótulo y una
          cifra que el lector junta (mismo criterio que la frase de Pagos). */}
      <div className="flex items-start justify-between gap-3">
        <div aria-busy={loading || undefined}>
          <EyebrowReloj />
          {loading ? (
            <h1 className="duna-display-m" aria-hidden="true" style={{ fontWeight: 'var(--duna-w-medium)', margin: 'var(--duna-space-hairline) 0 0' }}>
              <span style={{ display: 'inline-block', width: '58%', maxWidth: '26rem', height: '0.85em',
                             borderRadius: 4, background: 'var(--duna-skel)', verticalAlign: 'middle' }} />
            </h1>
          ) : !stats ? (
            <h1 className="duna-display-m" role="alert" style={{ fontWeight: 'var(--duna-w-medium)', margin: 'var(--duna-space-hairline) 0 0' }}>
              No se pudo leer el resumen de hoy.
            </h1>
          ) : ventasHoy > 0 ? (
            <>
              <h1 className="duna-display-m" style={{ fontWeight: 'var(--duna-w-medium)', margin: 'var(--duna-space-hairline) 0 0' }}>
                Hoy entraron <strong style={{ fontWeight: 'var(--duna-w-semi)' }}>{formatCOP(ventasHoy)}</strong>
              </h1>
              <p className="duna-sub" style={{ margin: 'var(--duna-space-hairline) 0 0' }}>Pagos recibidos hoy.</p>
            </>
          ) : (
            // $0: sin subtítulo. En Pagos el descargo desmentía la sospecha del filtro;
            // aquí no hay filtro que sospechar, así que no desmiente nada.
            <h1 className="duna-display-m" style={{ fontWeight: 'var(--duna-w-medium)', margin: 'var(--duna-space-hairline) 0 0' }}>
              Hoy no ha entrado dinero todavía
            </h1>
          )}
        </div>
        <DunaTooltip content="Elige y ordena las tarjetas de tu panel">
          <Button variant="outline" size="sm" className="shrink-0 gap-2" onClick={() => setCustomizing(true)}>
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Personalizar</span>
          </Button>
        </DunaTooltip>
      </div>

      {/* One-time banner when a metrics source failed — better than a grid of
          dashes with no explanation. Retry re-fires the fetches. */}
      {metricsFailed && (
        <div className="flex flex-col gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-destructive">No se pudieron cargar las métricas.</span>
          <Button variant="outline" size="sm" className="shrink-0" onClick={retry}>Reintentar</Button>
        </div>
      )}

      {/* CURVA de pedidos por hora. El conteo vive con la curva —es lo que mide— y en
          TINTA (medida única). Día sin pedidos: DECLARA, no dibuja. */}
      <div className="duna-card duna-card__pad">
        {loading ? (
          <>
            <div style={{ height: '1.1em', width: '9rem', borderRadius: 4, background: 'var(--duna-skel)' }} />
            <div style={{ height: 132, marginTop: 'var(--duna-space-3)', borderRadius: 8, background: 'var(--duna-skel)', opacity: 0.5 }} aria-hidden />
          </>
        ) : (
          <>
            {/* El CONTEO navega a la lista del día; la CURVA no. `?desde=hoy&hasta=hoy`
                da el conjunto IDÉNTICO al conteo (medido: `isCountableOrder` = no
                cancelado = el `NOT_CANCELLED` del stat, y ambos excluyen `SN-` → los
                mismos N). Un clic por HORA, en cambio, sería un superconjunto (Pedidos
                no filtra por hora): mismo parecido-pero-distinto de despachos_hoy y las
                gráficas del carrusel — al backlog. */}
            <h2 className="duna-heading" style={{ margin: 0 }}>
              {stats ? (
                <Link href={`/admin/pedidos?desde=${stats.hoyKey}&hasta=${stats.hoyKey}`} className="duna-link">
                  {pedidosHoy} {pedidosHoy === 1 ? 'pedido' : 'pedidos'} hoy
                </Link>
              ) : 'Pedidos de hoy'}
            </h2>
            <p className="duna-sub" style={{ margin: 'var(--duna-space-hairline) 0 var(--duna-space-3)' }}>
              Pedidos creados hoy.
            </p>
            {!stats ? (
              <p className="duna-sub" style={{ margin: 0 }}>No se pudo cargar la actividad de hoy.</p>
            ) : curvaDibuja(pedidosPorHora) ? (
              // Clic en una hora → Pedidos filtrado a ESA hora del día (conjunto exacto,
              // ya que Pedidos ganó filtro horario). `hoyKey` es el día de Bogotá del server.
              <CurvaPedidosHoy
                buckets={pedidosPorHora}
                onPunto={h => router.push(`/admin/pedidos?desde=${stats.hoyKey}&hasta=${stats.hoyKey}&hora=${h}`)}
              />
            ) : (
              <p className="duna-sub" style={{ margin: 0 }}>Sin pedidos hoy todavía — la curva aparece con el primero.</p>
            )}
          </>
        )}
      </div>

      {/* Customizable stat-card grid — the ONLY personalizable surface. The widgets
          render in the admin's chosen order; the hero, curve, top-hoy and recent
          orders are fixed. A retired key (WIDGET_MAP miss) is skipped, never
          crashes. A widget whose source failed shows `—` (see widgetValues). */}
      {loading ? (
        <StatGridSkeleton count={widgetKeys.length} />
      ) : widgetKeys.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">Sin tarjetas — personaliza tu panel para elegir qué ver.</p>
          <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={() => setCustomizing(true)}>
            <SlidersHorizontal className="w-4 h-4" /> Personalizar
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {widgetKeys.map(key => {
            const w = WIDGET_MAP[key];
            if (!w) return null;
            const v = widgetValues[key];
            const href = typeof w.href === 'function' ? w.href(hrefCtx) : w.href;
            // Insight: solo si el widget lo declara Y su serie llegó. La regla
            // decide sola cuándo callar (historia corta, muestra chica, mes en
            // curso incompleto) — aquí no hay lógica de negocio.
            const data = insightData[key];
            const insight = v && w.insight && data ? w.insight(data) : null;
            return (
              <StatCard
                key={key}
                icon={w.icono}
                label={w.titulo}
                // Source failed → `—` (no trend, static subtitle) instead of a
                // misleading 0.
                value={v ? formatValue(w.formato, v.raw) : '—'}
                // sub e insight compiten por UN slot; StatCard resuelve cuál gana
                // (insight primero) y le apende el scope del widget.
                sub={v?.sub ?? w.subtitulo}
                insight={insight?.text}
                insightEnfasis={insight?.enfasis}
                scopeSuffix={w.scopeSuffix}
                trend={v?.trend}
                // Color del chip = ESTADO, no decoración: neutro salvo que el
                // tile represente un estado (w.tono) y su valor lo justifique
                // (> 0). La tendencia colorea el TrendPill, no el chip.
                color={chipTono(w, v?.raw)}
                href={href}
              />
            );
          })}
        </div>
      )}

      <DashboardCustomizer
        open={customizing}
        onOpenChange={setCustomizing}
        value={widgetKeys}
        onApply={applyWidgets}
      />

      {/* Lo que más vendió hoy — eje del DINERO (incluye canceladas), lista corta. */}
      <div className="duna-card duna-card__pad">
        <h2 className="duna-heading" style={{ margin: '0 0 var(--duna-space-3)' }}>Lo que más vendió hoy</h2>
        {loading ? (
          <div className="space-y-2" aria-hidden>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ height: '1.4em', borderRadius: 4, background: 'var(--duna-skel)', opacity: 1 - i * 0.2 }} />
            ))}
          </div>
        ) : !stats || stats.topHoy.length === 0 ? (
          <p className="duna-sub" style={{ margin: 0 }}>Aún no se ha vendido nada hoy.</p>
        ) : (
          <TopHoy filas={stats.topHoy} />
        )}
      </div>

      {/* Órdenes recientes — grid-list (§ .duna-lista): refluye en móvil en vez de
          scrollear horizontal. La lista va A SANGRE (sin card__pad): sus filas ya
          traen su propio padding, y un doble padding dejaría los separadores
          flotando dentro de la tarjeta. El encabezado lleva su padding aparte. */}
      <div className="duna-card" style={{ overflow: 'hidden' }}>
        <div className="flex items-center justify-between"
             style={{ padding: 'var(--duna-space-4) var(--duna-space-4)', borderBottom: '1px solid var(--duna-border)' }}>
          <h2 className="duna-heading" style={{ margin: 0 }}>Órdenes recientes</h2>
          <Link href="/admin/pedidos" className="duna-link">Ver todas →</Link>
        </div>
        {loading ? (
          <div className="space-y-2" style={{ padding: 'var(--duna-space-4)' }} aria-hidden>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ height: '1.6em', borderRadius: 4, background: 'var(--duna-skel)', opacity: 1 - i * 0.15 }} />
            ))}
          </div>
        ) : !stats || stats.recentOrders.length === 0 ? (
          <p className="duna-sub" style={{ margin: 0, padding: 'var(--duna-space-5)' }}>Aún no hay órdenes.</p>
        ) : (
          <OrdersLista orders={stats.recentOrders} />
        )}
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
// Card-shaped placeholders matching the StatCard footprint so the layout doesn't
// jump when the real numbers arrive. `count` = the admin's actual widget count,
// so someone with 4 widgets doesn't see 8 phantoms (and the jump the skeleton
// exists to prevent).
function StatGridSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="stat-card animate-pulse">
          <div className="w-10 h-10 rounded-lg bg-muted" />
          <div className="mt-3 space-y-2">
            <div className="h-6 w-24 rounded bg-muted" />
            <div className="h-3 w-20 rounded bg-muted/70" />
            <div className="h-2.5 w-16 rounded bg-muted/50" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Lo que más vendió hoy ────────────────────────────────────────────────────
// Lista corta con una barra de proporción en TINTA (medida única, sin color de
// estado): muestra de un vistazo cuánto pesa cada producto contra el líder del día.
function TopHoy({ filas }: { filas: { nombre: string; total: number; producto_id: string | null }[] }) {
  const max = Math.max(...filas.map(f => f.total), 1);
  const nombreEstilo = { minWidth: 0, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const };
  return (
    <div className="space-y-3">
      {filas.map((f, i) => (
        <div key={i}>
          <div className="flex items-baseline justify-between gap-3">
            {/* Navega al producto SÓLO con id inequívoco; ambiguo o sin producto →
                texto plano (§ CustomerLink: no prometer una navegación que no existe). */}
            {f.producto_id
              ? <Link href={`/admin/productos?producto=${encodeURIComponent(f.producto_id)}`} className="duna-link duna-body-sm" style={nombreEstilo}>{f.nombre}</Link>
              : <span className="duna-body-sm" style={nombreEstilo}>{f.nombre}</span>}
            <span className="duna-num" style={{ fontWeight: 'var(--duna-w-semi)', whiteSpace: 'nowrap' }}>{formatCOP(f.total)}</span>
          </div>
          <div style={{ height: 4, marginTop: 6, borderRadius: 2, background: 'color-mix(in srgb, var(--duna-ink) 8%, transparent)' }}>
            <div style={{ height: '100%', width: `${(f.total / max) * 100}%`, background: 'var(--duna-ink)', opacity: 0.5, borderRadius: 2 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Órdenes recientes (grid-list) ────────────────────────────────────────────
// `.duna-lista`: refluye en móvil (§ Listas tabulares) en vez de scrollear
// horizontal. La fila navega al detalle del pedido (`?pedido=`); el número es un
// <Link> real para middle-click y foco de teclado, con `stopPropagation` para no
// navegar dos veces.
// Anchos DEFINIDOS por columna (patrón de Pagos): sin esto, Cliente —única `fr`— se
// come el sobrante y Canal/Total/Estado, en `auto`, se encogen y se apiñan a la
// derecha. Cada columna con su ancho; Cliente crece (es la de nombre).
const ORDENES_COLS = '108px minmax(7rem,1fr) minmax(84px,auto) 112px minmax(96px,auto)';

function OrdersLista({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const orderHref = (o: Order) => `/admin/pedidos?pedido=${encodeURIComponent(o.numero_orden)}`;

  return (
    <div className="duna-lista">
      {/* `--en-pliegue`: el `__head` nace `position: sticky`, pensado para la región de
          una pantalla de alto fijo. El Dashboard es document-scroll y esta lista no
          tiene scroller propio, así que sin esto el encabezado se pegaría bajo la
          topbar, despegado de sus filas (§ Analítica, mismo neutralizador). */}
      <div className="duna-lista__fila duna-lista__head duna-lista--en-pliegue" style={{ gridTemplateColumns: ORDENES_COLS }}>
        <span>Orden</span><span>Cliente</span><span>Canal</span>
        <span className="duna-lista__r">Total</span><span>Estado</span>
      </div>
      {orders.map(o => (
        <div
          key={o.id}
          className="duna-lista__fila"
          style={{ gridTemplateColumns: ORDENES_COLS, cursor: 'pointer' }}
          onClick={() => router.push(orderHref(o))}
        >
          <span data-label="Orden" className="duna-mono">
            <Link href={orderHref(o)} onClick={e => e.stopPropagation()} className="duna-link">
              {o.numero_orden ?? `#${o.id.slice(-6)}`}
            </Link>
          </span>
          <span data-label="Cliente" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {o.cliente_nombre}
          </span>
          <span data-label="Canal">
            <span className="duna-chip" style={{ textTransform: 'capitalize' }}>{o.canal ?? 'directo'}</span>
          </span>
          <span data-label="Total" className="duna-lista__r duna-num">{formatCOP(o.total)}</span>
          <span data-label="Estado"><StatusBadge status={o.estado} /></span>
        </div>
      ))}
    </div>
  );
}