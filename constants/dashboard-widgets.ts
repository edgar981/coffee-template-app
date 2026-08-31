import type { LucideIcon } from 'lucide-react';
import {
  Banknote, Wallet, Truck, ShoppingCart, DollarSign,
  Users, Package, TrendingUp, Coins,
} from 'lucide-react';
import {
  widgetInsight, insightUltimoEvento,
  type WidgetInsight, type WidgetInsightData,
} from '@/lib/metrics/insights';
import { formatFecha } from '@duna/core/format-fecha';
import { POR_COBRAR_QUERY_PEDIDOS } from '@duna/core/metrics/order-stat-filters';
import { STAT_CHIP } from '@/constants/stat-chip';

// ─── Dashboard widget registry ───────────────────────────────────────────────
// THE catalog of stat-card widgets an admin can turn on/off and reorder. This is
// the FORM of the "Comercio Digital" template (a registry + a persisted, ordered
// selection per user); the widgets themselves are this vertical's CONTENT.
//
// Each `key` is a stable, snake_case identifier — it is what gets persisted (see
// prisma DashboardPreference.widgets) and mapped to a server-side value in the
// dashboard page. Renaming a key is a breaking change (retired keys are silently
// dropped on read, so a user loses that card rather than seeing a crash).
//
// PURE + CLIENT-SAFE: presentation metadata + deep-link builders only. No Prisma,
// no data fetching. The value/sub/trend binding lives in the dashboard page (next
// to the loaded data); the deep-link queries reuse the SAME shared helpers the
// destination lists parse, so every card still reconciles with its list.
//
// MULTITENANT SEAM (documented, NOT built — see CLAUDE.md): when a store/tenant
// model exists, (a) each widget gains a `verticales`/`stores` filter so the
// catalog is scoped per business vertical, (b) DashboardPreference gains the
// store key, and (c) `defaultVisible` moves to a per-vertical default set. None
// of this is implemented now; there is no tenant model yet.

export type WidgetFormato = 'cop' | 'int' | 'pct';

/** Grouping in the customizer panel only — it does NOT affect the grid layout. */
export type WidgetCategoria = 'hoy' | 'mes' | 'historico' | 'clientes' | 'inventario';

/** Ordered display names for the categories that have widgets. `historico` is a
 *  reserved bucket for future widgets, so it renders only when populated. */
export const WIDGET_CATEGORIA_LABEL: Record<WidgetCategoria, string> = {
  hoy:        'Hoy',
  mes:        'Mes / operación',
  historico:  'Histórico',
  clientes:   'Clientes',
  inventario: 'Inventario',
};

export const WIDGET_CATEGORIA_ORDER: WidgetCategoria[] = ['hoy', 'mes', 'inventario', 'clientes', 'historico'];

/** Date context for the day/month-scoped deep links (America/Bogota day keys). */
export interface WidgetHrefContext {
  today:      string;
  monthStart: string;
  /** Full `estado=…&desde=…&hasta=…` query (no `?`) for "Órdenes del mes". */
  monthQuery: string;
}

/** Estado que un tile puede representar; colorea el chip SOLO si su valor es > 0. */
export type StatTono = 'atencion' | 'alerta';

export interface WidgetDef {
  /** Stable snake_case id — the persisted identifier. */
  key:            string;
  titulo:         string;
  /**
   * Línea de contexto de FALLBACK (el page puede reemplazarla por una en vivo).
   *
   * El indicador tiene UN SOLO slot bajo el título y el `insight` lo gana cuando
   * existe (ver `resolveStatLine`): este sub se muestra cuando no hay insight.
   * `''` = esa tarjeta no necesita segunda línea sin insight (título solo es
   * válido) — típicamente porque el texto repetía el título.
   */
  subtitulo:      string;
  /**
   * VENTANA TEMPORAL de la tarjeta, apendida entre paréntesis a CUALQUIER línea que
   * gane el slot ("últimos 30 días" → "Pagos recibidos (últimos 30 días)").
   *
   * Vive en el widget y no dentro del texto del sub a propósito: el slot único lo
   * puede ganar el insight, y una tarjeta con ventana que mañana gane un insight
   * seguiría necesitando declarar de qué período habla. Que el sufijo no se pierda
   * al cambiar la línea mostrada es un invariante testeado — `resolveStatLine`
   * (lib/stat-line.ts).
   *
   * HOY NINGÚN WIDGET LO USA, y eso es correcto, no deuda: `por_cobrar` y
   * `ordenes_pendientes` lo tuvieron con "acumulado" y se les quitó (owner,
   * 2026-07-29) porque son métricas de ESTADO ACTUAL — un saldo o un conteo vigente
   * no tiene período que declarar, y la etiqueta sugería una ventana inexistente.
   * El campo se mantiene: es forma del template, para el primer widget con ventana
   * real (p. ej. "ventas últimos 30 días"). No borrarlo por no tener consumidores.
   */
  scopeSuffix?:   string;
  icono:          LucideIcon;
  formato:        WidgetFormato;
  categoria:      WidgetCategoria;
  defaultVisible: boolean;
  /**
   * Color del chip de ícono en REPOSO. Hoy neutro en todos los tiles del
   * dashboard: el color es ESTADO (ver `tono`), no decoración. Lo lee también el
   * picker de Personalizar (DashboardCustomizer), que no tiene datos en vivo.
   */
  color:          string;
  /**
   * ESTADO que colorea el chip, y SOLO cuando el valor lo justifica (`> 0`).
   * Ausente = el tile no representa estado → siempre neutro. `atencion` (ámbar)
   * para colas de trabajo (por cobrar, pendientes); `alerta` (rojo) para riesgo
   * real (stock bajo). La TENDENCIA no va acá: su color vive en el TrendPill.
   */
  tono?:          StatTono;
  /** Deep link: a static path, or a fn of the date context for scoped links. */
  href?:          string | ((ctx: WidgetHrefContext) => string);
  /**
   * INSIGHT opcional: un HECHO derivado de la serie mensual del widget, no un
   * consejo. `null` (o el campo ausente) = la tarjeta se ve como hoy, y eso es
   * lo normal — es opt-in por diseño: solo los widgets donde una tendencia
   * mensual significa algo lo declaran. Las reglas viven en
   * lib/metrics/insights.ts (puras y testeadas); esto solo las conecta.
   *
   * La FORMA (campo opcional en el registry) es del template; el CONTENIDO (qué
   * widget lo usa y con qué serie) es de esta vertical.
   */
  insight?:       (data: WidgetInsightData) => WidgetInsight | null;
}

/**
 * ESTADO del indicador para la PLECA de la tira editorial: el `tono` del widget,
 * pero SOLO cuando el valor lo justifica (`> 0`) — una alerta que vale 0 no es una
 * alerta, y una cola vacía no pide nada; `null` = sin estado → sin pleca (sin color).
 * El estado vive en `WidgetDef.tono`, no en una clase CSS: la pleca lo consume directo.
 * Puro. `value` null/0/undefined (incl. fuente caída) → null.
 */
export function estadoTile(w: Pick<WidgetDef, 'tono'>, value: number | null | undefined): StatTono | null {
  return w.tono && value != null && value > 0 ? w.tono : null;
}

// Catalog order doubles as the DEFAULT order: the visible-by-default widgets, read
// top to bottom, give "fila Hoy primero, luego mes/operación" for free.
export const DASHBOARD_WIDGETS: WidgetDef[] = [
  // ── Hoy ──
  // Sin sub: "Pagos recibidos hoy" repetía el título. Su línea es el insight de
  // último pago; si algún día no hubiera insight, esta tarjeta no necesita segunda
  // línea.
  // OFF por defecto (2026-08-22): su cifra vive en el HERO de la pantalla "Hoy"
  // ("Hoy entraron $X"). Sigue en el catálogo — quien la quiera como tarjeta la
  // agrega en Personalizar; no se retira, así que nadie que la tenga guardada la
  // pierde (§ sanitizeWidgetKeys conserva toda key del catálogo).
  { key: 'ventas_hoy',      titulo: 'Ventas de hoy',      subtitulo: '', icono: Banknote,     formato: 'cop', categoria: 'hoy', defaultVisible: false, color: STAT_CHIP.neutral, href: (c) => `/admin/pagos?desde=${c.today}&hasta=${c.today}`,
    // Sin serie mensual: el hecho es cuándo entró el último pago. Un "$0 hoy"
    // con "último pago hace 3 días" informa; un "$0" solo, no.
    insight: (d) => insightUltimoEvento(d, {
      hoy:   'Último pago registrado hoy',
      dias:  (n) => `Último pago hace ${n} ${n === 1 ? 'día' : 'días'}`,
      nunca: 'Sin registros todavía',
    }) },
  // SIN scopeSuffix, decisión de producto (owner, 2026-07-29): esto es una métrica
  // de ESTADO ACTUAL — el saldo vigente que el mensajero anda cobrando ahora — y un
  // saldo no lleva declaración de período. "(acumulado)" sugería una ventana
  // temporal que no existe. El sufijo queda reservado a widgets con ventana real.
  { key: 'por_cobrar',      tono: 'atencion', titulo: 'Por cobrar',         subtitulo: 'Contraentrega despachada', icono: Wallet,     formato: 'cop', categoria: 'hoy', defaultVisible: true,  color: STAT_CHIP.neutral,         href: `/admin/pedidos?${POR_COBRAR_QUERY_PEDIDOS}` },
  // Sin sub: "Salieron a ruta hoy" es la definición de despacho, o sea el título.
  // NO-CLICKABLE (sin `href`): "Despachos de hoy" cuenta envíos que SALIERON hoy
  // (`stock_descontado_at` de hoy = en_ruta despachado hoy). Pedidos NO tiene ese
  // conjunto: `camino` (en_ruta) es un SUPERCONJUNTO —todos los en ruta, no los de hoy—,
  // y `?desde/?hasta` filtra por creación, no por despacho. Un destino parecido-pero-
  // distinto invita a concluir que la card está mal cuando lo que estaría mal es el
  // destino — misma decisión que la gráfica de Pedidos del carrusel (§ CLAUDE.md). El
  // board de Entregas, su viejo destino, se retiró.
  { key: 'despachos_hoy',   titulo: 'Despachos de hoy',   subtitulo: '', icono: Truck,        formato: 'int', categoria: 'hoy', defaultVisible: true,  color: STAT_CHIP.neutral,
    // Con fecha (no "hace N días"): para el que despacha, "desde el 24 jul" ubica
    // mejor que un conteo de días. `formatFecha` es LA utilidad de fecha visible.
    insight: (d) => insightUltimoEvento(d, {
      hoy:   'Último despacho hoy',
      dias:  (_n, fecha) => `Sin despachos desde ${formatFecha(fecha)}`,
      nunca: 'Sin registros todavía',
    }) },
  // OFF por defecto (2026-08-22): el conteo vive en el encabezado de la CURVA de la
  // pantalla "Hoy" ("N pedidos hoy"). Sigue en el catálogo, opt-in.
  { key: 'pedidos_hoy',     titulo: 'Pedidos de hoy',     subtitulo: 'Órdenes creadas hoy', icono: ShoppingCart, formato: 'int', categoria: 'hoy', defaultVisible: false, color: STAT_CHIP.neutral,              href: (c) => `/admin/pedidos?desde=${c.today}&hasta=${c.today}`,
    insight: (d) => insightUltimoEvento(d, {
      hoy:   'Última orden creada hoy',
      dias:  (n) => `Última orden hace ${n} ${n === 1 ? 'día' : 'días'}`,
      nunca: 'Sin registros todavía',
    }) },
  // ── Mes / operación ──
  // El sub nombra el PERÍODO y la fuente ("Pagos…", como ventas_hoy): el valor es
  // del mes en curso y el histórico vive en su propio widget (ingresos_historicos).
  // OFF por defecto (2026-08-22): la pantalla "Hoy" es del día; el mes vive en Pagos
  // y Analítica. Opt-in en Personalizar; su base ya incluye canceladas (§ commit 1).
  { key: 'ingresos_mes',       titulo: 'Ingresos del mes',   subtitulo: 'Pagos del mes en curso', icono: DollarSign,   formato: 'cop', categoria: 'mes', defaultVisible: false, color: STAT_CHIP.neutral, href: (c) => `/admin/pagos?desde=${c.monthStart}&hasta=${c.today}`, insight: widgetInsight },
  // Sin sub: "Mes en curso" repetía el título. La línea que queda bajo el valor es
  // el insight, que sí agrega algo (tendencia o por qué todavía no hay tendencia).
  // OFF por defecto (2026-08-22): el mes no es "Hoy". Opt-in en Personalizar.
  { key: 'ordenes_mes',        titulo: 'Órdenes del mes',    subtitulo: '', icono: ShoppingCart, formato: 'int', categoria: 'mes', defaultVisible: false, color: STAT_CHIP.neutral,              href: (c) => `/admin/pedidos?${c.monthQuery}`, insight: widgetInsight },
  // EL TILE `pedidos_por_atender` SE RETIRÓ: su número es ahora el BADGE de la sección
  // "Necesita tu atención" (la lista transversal pedidos + stock, § lib/atencion/items).
  // Un tile con el conteo Y una sección con la lista en la misma pantalla era la
  // duplicación que la sección vino a cerrar. Quien lo tuviera guardado lo pierde del
  // grid (`sanitizeWidgetKeys` descarta las keys que ya no existen — por diseño).
  // El sub dice la BASE real del promedio: se divide por PAGOS registrados, no por
  // órdenes (el título es heredado). "Promedio por venta" solo repetía el título.
  // `defaultVisible: true` para que el default sean TRES indicadores en fila (la forma
  // de duna-os) y no dos con la mitad de la tira vacía. Es el "Ticket promedio" de la
  // maqueta. Sigue siendo opt-out: el operador lo quita en Personalizar como cualquier
  // otro — "tres" es el ARRANQUE, no un número fijo (el customizer manda).
  { key: 'promedio_por_orden', titulo: 'Promedio por orden', subtitulo: 'Por pago registrado · mes en curso', icono: TrendingUp, formato: 'cop', categoria: 'mes', defaultVisible: true, color: STAT_CHIP.neutral },
  // ── Histórico ──
  // El all-time que salió del sub de "Ingresos del mes": una cifra histórica no
  // admite flecha mes-contra-mes, así que como widget propio queda sin trend y
  // con su período dicho en el sub ("Desde {primera fecha}"). Off por defecto —
  // quien lo quiera lo activa en Personalizar.
  { key: 'ingresos_historicos', titulo: 'Ingresos históricos', subtitulo: 'Todos los pagos registrados', icono: Coins, formato: 'cop', categoria: 'historico', defaultVisible: false, color: STAT_CHIP.neutral, href: '/admin/pagos' },
  // ── Inventario ──
  // EL TILE `alertas_stock` SE RETIRÓ: los productos bajo mínimo salen ahora en la
  // sección "Necesita tu atención" (§ lib/atencion/items), con tono ROJO propio —así
  // que el tile era el conteo redundante del mismo hecho, como `pedidos_por_atender`—.
  // El ROJO de escasez (el único del panel) se preservó: se movió a esos ítems, donde
  // vive el hecho, en vez de un tile aparte. `sanitizeWidgetKeys` descarta la key vieja.
  // Sin sub: "En catálogo" repetía "Productos Activos".
  { key: 'productos_activos', titulo: 'Productos Activos',  subtitulo: '', icono: Package,          formato: 'int', categoria: 'inventario', defaultVisible: false, color: STAT_CHIP.neutral },
  // ── Clientes ──
  // Sin sub: "Registrados" repetía "Clientes Totales".
  { key: 'clientes_totales',    titulo: 'Clientes Totales',    subtitulo: '', icono: Users,        formato: 'int', categoria: 'clientes', defaultVisible: false, color: STAT_CHIP.neutral, href: '/admin/clientes' },
  { key: 'clientes_recurrentes', titulo: 'Clientes Recurrentes', subtitulo: 'con más de 1 compra', icono: TrendingUp, formato: 'pct', categoria: 'clientes', defaultVisible: false, color: STAT_CHIP.neutral, href: '/admin/clientes?f=recurrentes' },
];

export const WIDGET_MAP: Record<string, WidgetDef> = Object.fromEntries(
  DASHBOARD_WIDGETS.map((w) => [w.key, w]),
);

/** Default layout = the `defaultVisible` widgets in catalog order (3: por_cobrar,
 *  despachos_hoy, promedio_por_orden — tres en fila, la forma de duna-os). */
export const DEFAULT_WIDGET_KEYS: string[] = DASHBOARD_WIDGETS.filter((w) => w.defaultVisible).map((w) => w.key);

/**
 * Coerce arbitrary input into a valid ordered list of widget keys: keep only
 * strings that are REAL registry keys, drop duplicates, preserve order. The one
 * gate both the API (on write) and the client (on read) run everything through,
 * so an unknown/retired/malformed key can never reach the grid.
 */
export function sanitizeWidgetKeys(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of input) {
    if (typeof k === 'string' && k in WIDGET_MAP && !seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  return out;
}
