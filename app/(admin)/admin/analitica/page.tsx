'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, LineChart, Line, Legend,
} from 'recharts';
import { formatCOP } from '@duna/core/utils';
import { getAnalytics, getWeeklyActivity } from '@/lib/api/analytics';
import { tooltipStyle, axisTickStyle } from '@/constants/dashb-styles';
import { widgetInsight, type InsightMonthPoint } from '@/lib/metrics/insights';
import { PERIODOS, PERIODO_ORDEN, PERIODO_DEFAULT, type PeriodoKey } from '@/lib/metrics/periodo';
import {
  titularRentabilidad, titularProductoEstrella, titularCartera, titularConcentracion,
} from '@/lib/metrics/titulares';
import { CARTERA_DIAS_MEDIO } from '@/lib/metrics/cartera';
import type { AnalyticsData, WeeklyActivityData } from '@/types/analytics';
import { BUSINESS_TZ, startOfZonedDay, startOfZonedWeek, zonedDayKey } from '@duna/core/timezone';
// El pliegue nació acá y ahora lo comparte el detalle de la orden.
import { Pliegue } from '@/components/admin/Pliegue';

// ANALÍTICA — cuatro preguntas de dueño, cada una atada a una decisión:
//
//   1. RENTABILIDAD  ¿estoy ganando o solo vendiendo?    → qué SKU sostener
//   2. CARTERA       ¿cuánta plata mía está en la calle?  → a quién cobrar
//   3. TRAYECTORIA   ¿el negocio crece?                   → si el rumbo sirve
//   4. CLIENTES      ¿quién y por dónde?                  → dónde concentrar
//
// El principio que gobierna qué entra: si una sección no cambia ninguna decisión,
// es decoración. Por eso murieron las cuatro KPI cards viejas y el grid de
// "Productos Más Vendidos" + "Ingresos por Producto".
//
// LA RESPUESTA PRIMERO, LA EVIDENCIA DESPUÉS (pase de jerarquía, 2026-08-05). El
// primer pase acertó las PREGUNTAS y falló la PRESENTACIÓN: cada bloque abría con
// la evidencia —una tabla de cinco columnas, un chart de dos líneas, tres
// tarjetas de buckets— y dejaba que el lector dedujera la respuesta. Eso es una
// página de analista. Ahora cada bloque LIDERA con una frase en lenguaje natural
// y un número, y el detalle denso se pliega.
//
// **NADA se eliminó en ese pase; todo se re-jerarquizó.** La tabla por SKU sigue
// completa detrás de "Ver detalle por producto", y la línea de margen sigue en el
// chart detrás de "Ver margen". La prueba de aceptación es de 30 segundos: abrir
// la página y responder en voz alta las cuatro preguntas SIN abrir un pliegue.

// ─── Piezas compartidas ───────────────────────────────────────────────────────

function Bloque({ n, titulo, pregunta, children }: {
  n:        number;
  titulo:   string;
  /** La pregunta de dueño. Es el subtítulo REAL del bloque, no un adorno. */
  pregunta: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      {/* `.duna-eyebrow` ES este rol —caption en versalitas, muted, semi— así que
          las tres utilidades sueltas que lo imitaban se retiran. El número va en
          `.duna-num` (cifras tabulares del sistema) y la pregunta en
          `.duna-caption`: la jerarquía la da el rol, no un `/60` y un `/70`. */}
      <div className="flex items-baseline gap-2">
        <span className="duna-num duna-eyebrow">{n}</span>
        <h2 className="duna-eyebrow">{titulo}</h2>
        <span className="duna-caption">· {pregunta}</span>
      </div>
      {children}
    </section>
  );
}

function Panel({ className = '', children }: { className?: string; children: React.ReactNode }) {
  // `.duna-card__pad` da los 20px que este panel cableaba con `p-5`; el borde, el
  // radio y la superficie salen de `.duna-card`. Se conserva `className` para los
  // ajustes por call site.
  return <div className={`duna-card duna-card__pad ${className}`}>{children}</div>;
}

/**
 * EL titular de un bloque: la frase que responde la pregunta sin abrir nada.
 *
 * Tamaño de titular y no de dato (`text-xl`, no `text-3xl`): lo que se lee es una
 * ORACIÓN, y una oración en cuerpo de cifra obliga a barrerla en vez de leerla.
 * El número ya viene dentro de la frase.
 */
function Titular({ children, tono = 'normal' }: {
  children: React.ReactNode;
  /** `alerta` sólo para una pérdida real — Amber Minimal: el color es información. */
  tono?: 'normal' | 'alerta';
}) {
  return (
    // `.duna-title` es el rol "SUJETO de superficie enfocada" (19px, display), que
    // es exactamente lo que el titular ES: la respuesta de este bloque. Conserva la
    // propiedad que la nota de arriba defiende —se lee como ORACIÓN, no como cifra—.
    <p className={`duna-title ${tono === 'alerta' ? 'text-destructive' : ''}`}>
      {children}
    </p>
  );
}

/**
 * Fallback honesto: el hecho de que no hay dato, no un gráfico vacío. Patrón del
 * dashboard — un chart con los ejes dibujados y sin serie se lee como "el negocio
 * está en cero" cuando lo que pasa es que no hay nada que medir todavía.
 */
function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="duna-sub py-10 text-center">{children}</p>;
}

function Skeleton({ className = '' }: { className?: string }) {
  // `.duna-skel` trae su propio color, radio y pulso del sistema — el `bg-muted` +
  // `animate-pulse` que había era otra definición del mismo esqueleto.
  return <div className={`duna-skel ${className}`} />;
}

// ─── Selector de período ──────────────────────────────────────────────────────

function SelectorPeriodo({ valor, onChange, disabled }: {
  valor:    PeriodoKey;
  onChange: (p: PeriodoKey) => void;
  disabled: boolean;
}) {
  // Chips NEUTROS: el ámbar sólido de la vista está reservado a la acción
  // principal de la página, y elegir un período no lo es. El activo lo marca
  // `.duna-pill.is-on`, que ya vive dentro de la familia neutra.
  //
  // Sin date-picker, y los cuatro cortes son los que el dueño pregunta de verdad
  // (owner, 2026-08-05). "Últimos 3 meses" es una ventana MÓVIL, no el trimestre
  // calendario: el 1 de abril un trimestre calendario mostraría enero-marzo y
  // ocultaría todo lo reciente.
  //
  // ── LA FORMA SE UNIFICA, EL CONTROL NO (owner, 2026-08-20) ──────────────────
  // Los pills son los del sistema (`.duna-pill`), los mismos que los carriles de
  // Pedidos y los presets de Pagos e Inventario: había DOS apariencias para
  // "elegir período" en el mismo panel, y eso es lo que el DS existe para cerrar.
  //
  // Lo que NO se hace es fusionar este control con `PresetsPeriodo`: no son el
  // mismo control. Éste elige entre CUATRO PERÍODOS NOMBRADOS (`PeriodoKey`, que
  // el endpoint entiende y hace eco); aquél elige un RANGO (desde/hasta).
  // Unificarlos exigiría que uno pierda lo suyo. La unificación real está en el
  // backlog, gateada a que este chip gane rango explícito.
  //
  // El envoltorio de caja (`border` + `p-0.5`) se retira: los pills del sistema no
  // viven dentro de un marco —los carriles de Pedidos no lo tienen— y mantenerlo
  // habría dejado este control pareciéndose a un segmentado, que es OTRA primitiva
  // con otro significado (§ CUÁNDO ESTO Y NO UN PILL).
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Período">
      {PERIODO_ORDEN.map(key => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          disabled={disabled}
          aria-pressed={valor === key}
          className={`duna-pill${valor === key ? ' is-on' : ''} disabled:opacity-50 disabled:pointer-events-none`}
        >
          {PERIODOS[key]}
        </button>
      ))}
    </div>
  );
}

// ─── La escala de gráficas ────────────────────────────────────────────────────
//
// `--duna-serie-1…5` es el ROL "color que IDENTIFICA una categoría" (§ CLAUDE.md —
// La serie categórica). Reemplaza a `--chart-1..5`, la rampa ámbar→marrón que esta
// pantalla heredó del dashboard: cuando se escribió, el DS no tenía escala de
// gráficas —la doctrina lo declaraba como rol SIN contraparte— y desde la tanda de
// Pagos sí la tiene.
//
// LA REGLA, aplicada, porque no es obvia: la serie IDENTIFICA, así que sólo se usa
// donde hay CATEGORÍAS que distinguir. Una medida ÚNICA no tiene qué identificar y
// va en TINTA — que es lo que hace la curva de Pagos, y por eso la gráfica semanal
// (órdenes por día, una sola magnitud) deja de pintarse con un color de serie.
const SERIE_INGRESOS = 'var(--duna-serie-1)';
const SERIE_MARGEN   = 'var(--duna-serie-2)';
/** Medida única → tinta, no serie. */
const TINTA_MEDIDA   = 'var(--duna-ink)';
/** Canales: 2–4 categorías reales. serie-5 es el neutro del cajón de sastre. */
const SERIE_CANALES = [
  'var(--duna-serie-1)', 'var(--duna-serie-2)', 'var(--duna-serie-3)',
  'var(--duna-serie-4)', 'var(--duna-serie-5)',
];

// ─── 1. RENTABILIDAD ──────────────────────────────────────────────────────────

// Las columnas del grid-list del detalle. Constante y no inline: el encabezado y
// las filas TIENEN que declarar la misma rejilla, y dos literales separados es
// cómo se desalinean. Mismo patrón que el kardex de Inventario (`COLS`).
const COLS_MARGEN = 'minmax(0, 1fr) 4rem 9rem 7rem 9rem';

function Rentabilidad({ data, loading }: { data: AnalyticsData | null; loading: boolean }) {
  if (loading) {
    return <Panel><Skeleton className="h-7 w-2/3" /><Skeleton className="h-4 w-1/3 mt-3" /></Panel>;
  }
  const r = data?.rentabilidad;
  if (!r) return <Panel><Vacio>Sin datos de rentabilidad.</Vacio></Panel>;

  const hayVentas = r.filas.length > 0 || r.residual.ingresos > 0;
  const titular   = titularRentabilidad({ periodo: data!.periodo.key, margenTotal: r.margenTotal, hayVentas });
  const estrella  = titularProductoEstrella(r.filas);

  return (
    <Panel>
      <Titular tono={r.margenTotal < 0 && hayVentas ? 'alerta' : 'normal'}>{titular}</Titular>

      {estrella && <p className="text-sm text-muted-foreground mt-2">{estrella}</p>}

      {/* LA ADVERTENCIA VIVE ACÁ, no dentro del pliegue: quien lea sólo el
          titular tiene que saber que ese número es una estimación. Esconderla
          detrás de "Ver detalle" la haría invisible justo para quien más la
          necesita — el que no abre el detalle. */}
      {/* EL ALCANCE VA PRIMERO (§ CLAUDE.md — el contrato del período). Este bloque
          SÍ respeta el chip, pero mide por fecha de PAGO: una orden entra al período
          en que se COBRÓ, no en el que se creó, así que un mes puede mostrar margen
          de ventas viejas cobradas ahora. La doctrina ya anticipaba que eso iba a
          confundir y que la respuesta era la nota — la nota no existía en pantalla.
          El titular nombra el período ("Este mes…"); esto dice qué fecha lo decide. */}
      {hayVentas && (
        <p className="text-xs text-muted-foreground/80 mt-2">
          Del período, por fecha de pago · margen estimado con el costo actual del
          catálogo · mercancía sin envío ·
          {' '}{formatCOP(r.ingresos)} − {formatCOP(r.costo)}
          {r.margenPct !== null && ` · ${r.margenPct.toFixed(1)}%`}
        </p>
      )}

      {r.filas.length > 0 && (
        <Pliegue label="Ver detalle por producto">
          {/* GRID-LIST, no `<table>` (§ CLAUDE.md — Listas tabulares del panel). El
              markup anterior era `overflow-x-auto` + `w-full`, y esas dos clases NO
              PUEDEN CONVIVIR: `w-full` fuerza la tabla al ancho del contenedor, así
              que nunca desborda y el scroll que el wrapper promete no se activa
              jamás — las columnas se comprimen en su sitio. Las que llevaban
              `whitespace-nowrap` no podían ceder, así que su contenido se desbordaba
              de la celda y se tocaba con el vecino (los encabezados salían pegados,
              "UdsVenta de mercancíaMargen / ud", y las cifras se superponían); y la
              única sin `nowrap` —Producto— era la que envolvía a dos líneas. Un solo
              mecanismo, tres síntomas. Reportado por el owner en teléfono.

              `.duna-lista` lo cierra por diseño: REFLUYE a dos columnas <960 en vez
              de scrollear horizontal, y cada celda declara su columna con
              `data-label`, que es el encabezado que el reflujo pierde. */}
          <div className="duna-lista">
            <div className="duna-lista__fila duna-lista__head duna-lista--en-pliegue" style={{ gridTemplateColumns: COLS_MARGEN }}>
              <span>Producto</span>
              <span className="duna-lista__r">Uds</span>
              {/* "Venta de mercancía", no "Ingresos": esta columna es
                  `OrderItem.subtotal` (mercancía, SIN envío) — otra base que la
                  línea "Ingresos" de la trayectoria, que es `Payment.monto` con
                  envío. Mismo nombre para dos bases distintas confundía. No es
                  "neto" (no hay descuentos ni impuestos, sólo ausencia de envío). */}
              <span className="duna-lista__r">Venta de mercancía</span>
              <span className="duna-lista__r">Margen / ud</span>
              {/* La columna que ORDENA la tabla: plata dejada, no volumen. */}
              <span className="duna-lista__r">Margen total</span>
            </div>
            {r.filas.map(f => (
              <div key={f.productoId} className="duna-lista__fila" style={{ gridTemplateColumns: COLS_MARGEN }}>
                <span data-label="Producto" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <Link
                    href={`/admin/productos?producto=${encodeURIComponent(f.productoId)}`}
                    title={`Ver ${f.producto}`}
                    className="duna-link"
                  >
                    {f.producto}
                  </Link>
                </span>
                <span data-label="Uds" className="duna-lista__r duna-num duna-sub">{f.unidades}</span>
                <span data-label="Venta de mercancía" className="duna-lista__r duna-num duna-sub">{formatCOP(f.ingresos)}</span>
                <span data-label="Margen / ud" className="duna-lista__r duna-num duna-sub">
                  {f.margenUnitario === null ? '—' : formatCOP(f.margenUnitario)}
                </span>
                {/* Un margen negativo se pinta rojo: es una alerta REAL (se
                    está vendiendo por debajo del costo), el único caso en que
                    Amber Minimal admite color semántico en esta tabla. */}
                <span data-label="Margen total" className={`duna-lista__r duna-num font-semibold ${f.margenTotal < 0 ? 'text-destructive' : ''}`}>
                  {formatCOP(f.margenTotal)}
                  {f.margenPct !== null && (
                    <span className="duna-caption font-normal" style={{ marginLeft: 'var(--duna-space-2)' }}>{f.margenPct.toFixed(0)}%</span>
                  )}
                </span>
              </div>
            ))}
          </div>

          {/* El residual es un HECHO declarado, no un silencio. Costear en 0 lo
              que no se pudo costear convertiría un dato faltante en "margen
              100%". */}
          {r.residual.ingresos > 0 && (
            <p className="text-xs text-muted-foreground mt-3">
              {r.residual.productos} {r.residual.productos === 1 ? 'producto' : 'productos'} sin costo
              resoluble ({r.residual.unidades} uds, {formatCOP(r.residual.ingresos)}) quedan fuera del
              margen: su línea no resuelve a un producto del catálogo.
            </p>
          )}

          <p className="text-xs text-muted-foreground/80 mt-3">
            El costo por producto es dato del seed hasta la sesión con el cliente —
            mismo estatus que el stock mínimo. Los números se vuelven verdaderos
            cuando se carguen los costos reales.
          </p>
        </Pliegue>
      )}

      {/* Sin filas costeables pero CON ingresos: el residual es todo lo que hay,
          y callarlo dejaría el titular sin explicación. */}
      {r.filas.length === 0 && r.residual.ingresos > 0 && (
        <p className="text-xs text-muted-foreground mt-3">
          Se vendieron {formatCOP(r.residual.ingresos)} que no se pudieron costear:
          sus líneas no resuelven a un producto del catálogo.
        </p>
      )}
    </Panel>
  );
}

// ─── 2. CARTERA ───────────────────────────────────────────────────────────────

function Cartera({ data, loading }: { data: AnalyticsData | null; loading: boolean }) {
  if (loading) return <Panel><Skeleton className="h-7 w-2/3" /><Skeleton className="h-16 w-full mt-4" /></Panel>;

  const c = data?.cartera;
  if (!c || c.conteo === 0) {
    // El bloque RESPIRA, no grita: cero cartera es la mejor noticia posible.
    return <Panel><Titular>Nada pendiente de cobro</Titular></Panel>;
  }

  const vencido = c.buckets.find(b => b.bucket === 'vencido');
  const hayViejo = !!vencido && vencido.conteo > 0;

  return (
    <Panel>
      {/* El bucket VIEJO sube al titular. Es el único dato de esta página que
          puede exigir una llamada hoy mismo, y antes había que leer y comparar
          tres tarjetas para descubrirlo. */}
      <Titular tono={hayViejo ? 'alerta' : 'normal'}>{titularCartera(c)}</Titular>
      <p className="text-xs text-muted-foreground mt-2">
        {c.conteo} {c.conteo === 1 ? 'orden pendiente' : 'órdenes pendientes'} · saldo vigente, no depende del período
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
        {c.buckets.map(b => {
          const esViejo = b.bucket === 'vencido' && b.conteo > 0;
          const contenido = (
            <>
              <p className="text-xs text-muted-foreground mb-1">{b.label}</p>
              <p className={`text-lg font-bold ${esViejo ? 'text-destructive' : ''}`}>{formatCOP(b.monto)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {b.conteo} {b.conteo === 1 ? 'orden' : 'órdenes'}
              </p>
            </>
          );
          // Un bucket vacío NO linkea: una lista vacía al otro lado promete una
          // navegación que no lleva a nada (misma regla que `CustomerLink`).
          if (b.conteo === 0) {
            return <div key={b.bucket} className="rounded-lg border border-border p-3 opacity-60">{contenido}</div>;
          }
          return (
            <Link
              key={b.bucket}
              // `b.query` no cambió: sigue siendo `estado=pendiente&desde&hasta`, el
              // query que `cartera.test.ts` afirma que contiene exactamente las
              // edades de su bucket. Lo único que cambia es la RUTA — la pantalla
              // nueva entiende los tres como alcances (§ lib/pedidos/filtros).
              href={`/admin/pedidos?${b.query}`}
              className="admin-foco group rounded-lg border border-border p-3 transition-colors hover:bg-muted/20"
            >
              {contenido}
              <span className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground">
                Ver pedidos <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          );
        })}
      </div>

      <Pliegue label="Cómo se cuenta esta cartera">
        <p className="text-xs text-muted-foreground">
          Cuenta lo mismo que la lista de Órdenes a la que llevan estos enlaces: es
          una lista de trabajo, no una medición, así que su contrato es cuadrar con
          esa lista. El resto de esta página excluye las órdenes de demo
          (<code className="text-[11px]">SN-</code>); esta sección no. Los cortes de
          7 y {CARTERA_DIAS_MEDIO} días son provisionales hasta definir la política
          de cobro.
        </p>
      </Pliegue>
    </Panel>
  );
}

// ─── 3. TRAYECTORIA ───────────────────────────────────────────────────────────

function Trayectoria({ data, loading }: { data: AnalyticsData | null; loading: boolean }) {
  // Apagado por DEFECTO: el chart abre con una sola línea. Dos series con escalas
  // distintas obligan a comparar antes de leer, y la pregunta del bloque —¿el
  // negocio crece?— la responde la de ingresos sola.
  const [verMargen, setVerMargen] = useState(false);
  const serie = useMemo(() => data?.trayectoria ?? [], [data]);

  // Prehistoria fuera: los meses ANTERIORES a la primera venta no son historia
  // con valor 0, son ventana vacía. Sin este corte un negocio de 3 meses
  // "cumpliría" los 6 del promedio semestral rellenando con ceros y la página
  // anunciaría un hecho inventado. Mismo criterio que `mesesCerrados`.
  const desdeLaPrimera = useMemo(() => {
    const i = serie.findIndex(p => p.ingresos > 0 || p.ordenes > 0);
    return i === -1 ? [] : serie.slice(i);
  }, [serie]);

  const serieIngresos: InsightMonthPoint[] = desdeLaPrimera.map(p => ({ month: p.month, value: p.ingresos, ordenes: p.ordenes, cerrado: p.cerrado }));
  const serieMargen:   InsightMonthPoint[] = desdeLaPrimera.map(p => ({ month: p.month, value: p.margen,   ordenes: p.ordenes, cerrado: p.cerrado }));

  const insightIngresos = widgetInsight({ serie: serieIngresos });
  const insightMargen   = widgetInsight({ serie: serieMargen });

  if (loading) return <Panel><Skeleton className="h-7 w-1/2" /><Skeleton className="h-56 w-full mt-4" /></Panel>;
  if (desdeLaPrimera.length === 0) {
    return <Panel><Titular>Sin ventas cobradas todavía</Titular></Panel>;
  }

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {/* El insight de la escalera, ASCENDIDO a titular del bloque. Es el
              hecho que responde "¿crece?"; el chart es la evidencia. */}
          {insightIngresos
            ? <Titular>{insightIngresos.text}</Titular>
            : <Titular>Ingresos de los últimos meses</Titular>}
          {/* EL CASO GRAVE del contrato del período (§ CLAUDE.md). Esta serie IGNORA
              el chip —son siempre 12 meses— y su alcance vivía sólo dentro del
              pliegue "Cómo se lee esta serie", o sea cerrado por defecto: con "Mes
              pasado" elegido, un chart de 12 meses contradice al chip a la vista y
              la única explicación estaba donde el propio diseño garantiza que nadie
              mira ("responder sin abrir un solo pliegue").

              NO alcanza con "no depende del período", la fórmula de Cartera y
              Recurrencia: ahí es obvio —un saldo vigente y un acumulado no TIENEN
              período—, pero una serie temporal sí lo tiene, así que hay que decir
              CUÁL es y PARA QUÉ. Y `incluye envío` se conserva: es la base declarada
              que hace que esta línea no sea comparable peso a peso con la de margen
              (§ el pliegue). */}
          <p className="text-xs text-muted-foreground mt-1">
            Pagos recibidos por mes (incluye envío) · siempre los últimos 12 meses,
            para ver la tendencia
          </p>
        </div>

        {/* Label HUMANO, no jerga: "Ver margen", no "margen bruto estimado". */}
        <button
          type="button"
          onClick={() => setVerMargen(v => !v)}
          aria-pressed={verMargen}
          className={`admin-foco rounded-lg border border-border px-3 py-1 text-xs transition-colors ${
            verMargen ? 'bg-muted font-semibold text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          }`}
        >
          Ver margen
        </button>
      </div>

      {verMargen && insightMargen && (
        <p className="text-xs text-muted-foreground mt-2">Margen: {insightMargen.text.toLowerCase()}</p>
      )}

      <div className="mt-4">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={desdeLaPrimera}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={axisTickStyle} axisLine={false} tickLine={false} />
            <YAxis
              tick={axisTickStyle} axisLine={false} tickLine={false}
              tickFormatter={v => `$${((v as number) / 1_000_000).toFixed(1)}M`}
            />
            {/* EL CURSOR ES NUESTRO, no el de recharts. Su default está HARDCODEADO
                a `#ccc` (medido en `Cursor.js`: `stroke: '#ccc'`), o sea ciego al
                tema — y el `contentStyle` de al lado sí seguía el tema, con lo que
                el tooltip y su cursor hablaban idiomas distintos.

                GUÍA PUNTEADA y no un bloque, igual que la curva de Pagos
                (`--duna-border-2`, `3 3`): en una serie temporal lo que hay que
                señalar es el PUNTO del eje, no teñir una franja. */}
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ stroke: 'var(--duna-border-2)', strokeWidth: 1, strokeDasharray: '3 3' }}
              formatter={(v, name) => [formatCOP(v as number), name === 'ingresos' ? 'Ingresos' : 'Margen est.']}
            />
            {/* La leyenda sólo aparece con DOS series: con una sola no distingue
                nada y es una fila de ruido bajo el chart. */}
            {verMargen && <Legend formatter={v => (v === 'ingresos' ? 'Ingresos' : 'Margen est.')} wrapperStyle={{ fontSize: 11 }} />}
            <Line type="monotone" dataKey="ingresos" stroke={SERIE_INGRESOS} strokeWidth={2.5} dot={false} />
            {/* Punteada: es una ESTIMACIÓN (costo actual, no snapshoteado), y la
                línea lo dice sin obligar a leer la nota. */}
            {verMargen && (
              <Line type="monotone" dataKey="margen" stroke={SERIE_MARGEN} strokeWidth={2} strokeDasharray="5 3" dot={false} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <Pliegue label="Cómo se lee esta serie">
        <p className="text-xs text-muted-foreground">
          Últimos 12 meses, desde la primera venta. El mes en curso se dibuja pero
          no cuenta para las tendencias: está incompleto. Una orden entra al mes en
          que se COBRÓ, no en el que se creó. El margen es estimado con el costo
          actual del catálogo y va sobre mercancía, sin envío — por eso las dos
          líneas no son comparables peso a peso.
        </p>
      </Pliegue>
    </Panel>
  );
}

// ─── 4. CLIENTES Y CANALES ────────────────────────────────────────────────────

function ClientesYCanales({ data }: { data: AnalyticsData }) {
  const { concentracion: c, recurrencia, canales } = data;
  const titular = titularConcentracion(c);
  const maxCanal = canales[0]?.value ?? 1;

  return (
    <div className="space-y-4">
      <Panel>
        {/* La frase de concentración LIDERA el bloque: responde "¿de quién
            dependo?" sin leer la lista. */}
        {titular
          ? <Titular>{titular}</Titular>
          : <Titular>Todavía no hay base para hablar de concentración</Titular>}
        <p className="text-xs text-muted-foreground mt-2">
          Por dinero pagado en el período · {recurrencia.recurrentes} de {recurrencia.clientes} clientes
          han comprado más de una vez (acumulado, no depende del período)
        </p>

        {c.top.length > 0 && (
          <Pliegue label={`Ver los ${c.top.length} clientes`}>
            <div className="space-y-2">
              {c.top.map((cl, i) => (
                <Link
                  key={cl.id}
                  href={`/admin/clientes?cliente=${encodeURIComponent(cl.id)}`}
                  className="admin-foco flex items-center gap-3 -mx-2 rounded-lg px-2 py-1 transition-colors hover:bg-muted/20"
                >
                  <span className="text-xs font-bold text-muted-foreground w-4">#{i + 1}</span>
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold text-primary">{cl.nombre?.[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{cl.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {cl.ordenes} {cl.ordenes === 1 ? 'orden' : 'órdenes'}
                    </p>
                  </div>
                  <p className="text-xs font-bold text-foreground">{formatCOP(cl.total)}</p>
                </Link>
              ))}
            </div>
          </Pliegue>
        )}
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel>
          <h3 className="font-semibold mb-1">Canales de venta</h3>
          {/* "Órdenes CREADAS" está dicho a propósito: este bloque mide por fecha
              de creación y los otros tres por fecha de pago. La diferencia de base
              tiene que estar a la vista, no deducirse. */}
          <p className="text-xs text-muted-foreground mb-4">Órdenes creadas en el período, por dónde llegó el cliente</p>
          {canales.length === 0 ? (
            <Vacio>Sin órdenes en este período.</Vacio>
          ) : (
            // Barras y no pie: son 2–4 categorías y lo que se compara son
            // magnitudes, que una barra responde de un vistazo y un pie obliga a
            // estimar ángulos.
            <div className="space-y-3">
              {canales.map((c2, i) => (
                <div key={c2.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium">{c2.name}</span>
                    <span className="text-muted-foreground">
                      {c2.value} {c2.value === 1 ? 'orden' : 'órdenes'} · {c2.pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full"
                      style={{ width: `${(c2.value / maxCanal) * 100}%`, background: SERIE_CANALES[i % SERIE_CANALES.length] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <WeeklyActivityCard />
      </div>
    </div>
  );
}

// ─── Actividad Semanal (weekly, navigable) ────────────────────────────────────
// SOBREVIVE del grid anterior sin cambios de fondo: ya cumplía el estándar
// (bucketing de día EN SQL y en America/Bogota, solo `CN-`, no canceladas) — era
// la única parte de la página que lo hacía.
//
// NO respeta el chip de período, y por eso trae su propio navegador de semanas:
// su pregunta es "qué días de la semana vende esta tienda", que se responde
// mirando UNA semana a la vez, no un rango de tres meses aplanado.

const ZERO_WEEK = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  .map(dia => ({ dia, ordenes: 0, ingresos: 0 }));

// "20 – 26 de jul" (same month) / "30 de jun – 6 de jul" (crossing months).
const WEEK_DAY   = new Intl.DateTimeFormat('es-CO', { day: 'numeric', timeZone: BUSINESS_TZ });
const WEEK_MONTH = new Intl.DateTimeFormat('es-CO', { month: 'short', timeZone: BUSINESS_TZ });

function weekRangeLabel(monday: Date): string {
  const sunday = startOfZonedDay(monday, BUSINESS_TZ, 6);
  const month = (d: Date) => WEEK_MONTH.format(d).replace('.', '');
  if (month(monday) === month(sunday)) {
    return `${WEEK_DAY.format(monday)} – ${WEEK_DAY.format(sunday)} de ${month(sunday)}`;
  }
  return `${WEEK_DAY.format(monday)} de ${month(monday)} – ${WEEK_DAY.format(sunday)} de ${month(sunday)}`;
}

function WeeklyActivityCard() {
  // Week shown = current week + offset (0 = current, -1 = previous, …).
  const [offset, setOffset] = useState(0);
  const [data, setData]     = useState<WeeklyActivityData | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const monday  = useMemo(() => startOfZonedWeek(new Date(), BUSINESS_TZ, offset), [offset]);
  const weekKey = zonedDayKey(monday, BUSINESS_TZ);

  useEffect(() => {
    let active = true;
    getWeeklyActivity(weekKey)
      .then(result => { if (active) setData(result); })
      .catch(()     => { if (active) setFailed(weekKey); });
    // Ignore an in-flight response once the week changed again.
    return () => { active = false; };
  }, [weekKey]);

  // Derived, carousel-style: loading = the visible week isn't the loaded one.
  // Navigation keeps the LAST loaded bars mounted (dimmed) — no unmount flash.
  const error   = failed === weekKey;
  const loading = !error && data?.week !== weekKey;
  const rows    = data?.days ?? ZERO_WEEK;
  const isEmpty = !loading && !error && rows.every(d => d.ordenes === 0);

  return (
    <Panel>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold mb-1">Actividad semanal</h3>
          {/* The number means nothing without its week — always show the range. */}
          <p className="text-xs text-muted-foreground">
            Órdenes por día · {weekRangeLabel(monday)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setOffset(o => o - 1)}
            aria-label="Semana anterior"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setOffset(o => Math.min(0, o + 1))}
            disabled={offset === 0}
            aria-label="Semana siguiente"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:pointer-events-none"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="relative">
        {/* Chart stays MOUNTED while navigating; loading just dims it. */}
        <div className={loading ? 'opacity-40 transition-opacity' : 'transition-opacity'}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={rows} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="dia"  tick={axisTickStyle} axisLine={false} tickLine={false} />
              <YAxis               tick={axisTickStyle} axisLine={false} tickLine={false} allowDecimals={false} />
              {/* REGRESIÓN DEL RE-SKIN, y el hallazgo que la explica: el cursor de
                  barras de recharts es un RECTÁNGULO OPACO `fill: '#ccc'` sin
                  opacidad (medido en `getCursorRectangle.js`), hardcodeado y ciego
                  al tema. En oscuro siempre fue un bloque claro; lo camuflaban las
                  barras ámbar. Al pasar las barras a tinta —crema en oscuro— el
                  bloque dejó de distinguirse de ellas. El re-skin no creó el
                  defecto: LE QUITÓ EL DISFRAZ.

                  `--duna-wash-hover` no es un préstamo: es el token de HOVER para
                  un cursor de HOVER, o sea su significado exacto. (Lo contrario del
                  caso que se rechazó para el relleno del área de la curva de Pagos,
                  donde el mismo token habría sido un préstamo con otro sentido.) */}
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--duna-wash-hover)' }} />
              <Bar dataKey="ordenes" name="Órdenes" fill={TINTA_MEDIDA} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {error && (
          <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-muted-foreground">
            No se pudo cargar la semana.
          </p>
        )}
        {isEmpty && (
          <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-muted-foreground">
            Sin órdenes esta semana
          </p>
        )}
      </div>
    </Panel>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Analitica() {
  const [data, setData]       = useState<AnalyticsData | null>(null);
  const [failed, setFailed]   = useState<PeriodoKey | null>(null);
  const [periodo, setPeriodo] = useState<PeriodoKey>(PERIODO_DEFAULT);

  useEffect(() => {
    let active = true;
    getAnalytics(periodo)
      .then(d => { if (active) setData(d); })
      .catch(() => { if (active) setFailed(periodo); });
    // Ignora una respuesta en vuelo si el período cambió de nuevo.
    return () => { active = false; };
  }, [periodo]);

  // DERIVADO, no seteado en el effect: cargando = el período visible no es el que
  // trajo la respuesta. Es el mismo mecanismo que la card semanal (que compara
  // contra el `week` que el server devuelve), y funciona porque el endpoint hace
  // eco del período que resolvió. Un `setLoading(true)` síncrono dentro del effect
  // provoca un render en cascada por cada cambio de período.
  const error   = failed === periodo;
  const loading = !error && data?.periodo.key !== periodo;

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="duna-display-m">Analítica</h1>
        <p className="duna-sub">
          Cuatro preguntas del negocio, y qué decisión cambia cada una
        </p>
      </div>
      {/* El selector vive en el HEADER de la página, no dentro de un bloque:
          desde este pase gobierna rentabilidad, clientes y canales, así que
          colgarlo de una sección haría creer que sólo mueve esa. */}
      <SelectorPeriodo valor={periodo} onChange={setPeriodo} disabled={loading} />
    </div>
  );

  // Con error NO se muestran los datos del período anterior: el chip diría "Mes
  // pasado" sobre las cifras del mes en curso, que es peor que no mostrar nada.
  // El selector queda vivo — cambiar de período ES el reintento.
  if (error) {
    return (
      <div className="space-y-6">
        {header}
        <Panel><Vacio>No se pudo cargar la analítica.</Vacio></Panel>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {header}

      <Bloque n={1} titulo="Rentabilidad" pregunta="¿estoy ganando o solo vendiendo?">
        <Rentabilidad data={data} loading={loading} />
      </Bloque>

      <Bloque n={2} titulo="Cartera" pregunta="¿cuánta plata mía está en la calle?">
        <Cartera data={data} loading={loading} />
      </Bloque>

      <Bloque n={3} titulo="Trayectoria" pregunta="¿el negocio crece?">
        <Trayectoria data={data} loading={loading} />
      </Bloque>

      <Bloque n={4} titulo="Clientes y canales" pregunta="¿quién compra, y por dónde llega?">
        {loading || !data ? (
          <Panel><Skeleton className="h-7 w-2/3" /><Skeleton className="h-32 w-full mt-4" /></Panel>
        ) : (
          <ClientesYCanales data={data} />
        )}
      </Bloque>
    </div>
  );
}
