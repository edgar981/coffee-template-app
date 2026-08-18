'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { FilterX, Paperclip, X } from 'lucide-react';
import { DateRangePicker } from '@/components/admin/DateRangePicker';
import { PresetsPeriodo } from '@/components/admin/PresetsPeriodo';
import { PagosStrip } from '@/components/admin/PagosStrip';
import { getPayments } from '@/lib/api/payments';
import type { Payment, MetodoPago } from '@/types/payment';
import { METODO_PAGO_LABEL, METODO_CATEGORIA } from '@/types/payment';
import { formatCOP } from '@duna/core/utils';
import { formatFecha } from '@duna/core/format-fecha';
import { BUSINESS_TZ, zonedDayKey } from '@duna/core/timezone';
import { rangoDeDiasDelPeriodo, opcionesPreset } from '@/lib/metrics/periodo';
import { elegirEscala, bucketsDelRango, bucketKey } from '@/lib/pagos/bucketeo';
import { etiquetaBucket } from '@/lib/pagos/etiquetas';

// Columnas del libro (grid-list). Flexibles: caben en la región sin scroll horizontal
// en escritorio, y refluyen a 2 columnas en móvil (§ duna.css, `.admin-lista`).
const COLS = '84px 104px minmax(70px,1.1fr) 96px 108px minmax(70px,1.3fr) 104px 22px';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Pagos() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Cargando...</div>}>
      <PagosInner />
    </Suspense>
  );
}

function PagosInner() {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  // La pantalla SIEMPRE abre con un rango: MES EN CURSO por defecto, o el `?desde/?hasta`
  // del deep-link del dashboard. El reloj se fija al montar.
  const ahora    = useMemo(() => new Date(), []);
  const hoy      = zonedDayKey(ahora, BUSINESS_TZ);
  const rangoMes = useMemo(() => rangoDeDiasDelPeriodo('mes', ahora), [ahora]);
  const presetsPagos = useMemo(
    () => [{ label: 'Hoy', desde: hoy, hasta: hoy }, ...opcionesPreset(['mes', 'mes_anterior', 'ultimos_3_meses'], ahora)],
    [hoy, ahora],
  );
  const [pagos, setPagos]     = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [metodo, setMetodo]   = useState<string>('all');      // 'all' | MetodoPago | `cat:${cat}`
  const [from, setFrom]       = useState(() => searchParams.get('desde') ?? rangoMes.desde);
  const [to, setTo]           = useState(() => searchParams.get('hasta') ?? rangoMes.hasta);
  // Estado del STRIP, todo client-side y de una fuente con la tabla:
  const [bucketSel, setBucketSel] = useState<string | null>(null); // bucket clickeado
  const [split, setSplit]         = useState(false);                // toggle "Por método"
  const [excl, setExcl]           = useState<MetodoPago[]>([]);      // exclusiones de la leyenda

  // El rango se filtra en SQL → un cambio de rango RE-CONSULTA. `active` evita que una
  // respuesta lenta pise a una más nueva.
  useEffect(() => {
    let active = true;
    setLoading(true);
    getPayments(from, to)
      .then(data => { if (active) setPagos(data); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [from, to]);

  // ── Derived ────────────────────────────────────────────────────────────────

  // La escala del bucketeo del rango, y el bucket seleccionado como objeto (para su
  // etiqueta auto-explicativa en el chip). `null` si el rango no dibuja (>31 años).
  const escala        = useMemo(() => elegirEscala(from, to), [from, to]);
  const bucketsRango  = useMemo(() => (escala ? bucketsDelRango(from, to, escala) : []), [from, to, escala]);
  const bucketSelObj  = bucketSel ? bucketsRango.find(bk => bk.key === bucketSel) ?? null : null;

  // UNA fuente para stats, strip y tabla: método (select) + exclusiones (leyenda) +
  // bucket (clic en barra). Todo sobre `pagos`, el recorte del rango.
  const filtered = useMemo(() => {
    const metOk = (m: MetodoPago) => {
      if (metodo === 'all') return !excl.includes(m);
      if (metodo.startsWith('cat:')) return METODO_CATEGORIA[m] === metodo.slice(4);
      return m === metodo;
    };
    return pagos.filter(p =>
      metOk(p.metodo) &&
      (!bucketSel || (escala != null && bucketKey(new Date(p.fecha), escala) === bucketSel)),
    );
  }, [pagos, metodo, excl, bucketSel, escala]);

  const totalPeriodo = filtered.reduce((sum, p) => sum + p.monto, 0);
  const promedio     = filtered.length ? totalPeriodo / filtered.length : null;

  const hasFilters = metodo !== 'all' || bucketSel !== null || excl.length > 0
    || from !== rangoMes.desde || to !== rangoMes.hasta;

  // ── Handlers ─────────────────────────────────────────────────────────────────

  // Un cambio de RANGO limpia el bucket seleccionado (es específico del rango: la escala
  // y las claves cambian). El método/exclusiones sí sobreviven (son por método).
  const setRango = (d: string | null, h: string | null) => {
    setFrom(d ?? ''); setTo(h ?? ''); setBucketSel(null);
  };
  const setMetodoSel = (v: string) => {
    setMetodo(v);
    if (v !== 'all') setExcl([]); // sin split no hay leyenda que las gobierne
  };
  const toggleExcl = (m: MetodoPago) =>
    setExcl(prev => (prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]));

  const clearFilters = () => {
    setMetodo('all'); setFrom(rangoMes.desde); setTo(rangoMes.hasta);
    setBucketSel(null); setSplit(false); setExcl([]);
    const next = new URLSearchParams(searchParams.toString());
    next.delete('desde'); next.delete('hasta');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="duna duna-sin-split">
      {/* CABECERA fija: header + stats + filtros. El strip NO va acá — scrollea con el
          libro (§ duna.css). El chip de bucket sí vive acá, con etiqueta que se entiende
          sola porque el operador lo ve sin ver la barra que lo produjo. */}
      <div className="duna-cabecera space-y-6 pb-6">
        <div>
          <h1 className="duna-display-m">Pagos</h1>
          <p className="duna-sub" style={{ margin: 'var(--duna-space-hairline) 0 0' }}>
            Ledger de pagos registrados. Se registran desde cada orden.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', rowGap: 'var(--duna-space-4)' }}>
          <div className="duna-stat">
            <div className="duna-stat__v duna-num">{formatCOP(totalPeriodo)}</div>
            <div className="duna-stat__l">Total del período</div>
            <div className="duna-stat__d">{bucketSelObj ? etiquetaBucket(bucketSelObj.inicio, escala!) : 'del recorte activo'}</div>
          </div>
          <div className="duna-stat">
            <div className="duna-stat__v duna-num">{filtered.length}</div>
            <div className="duna-stat__l">Pagos {hasFilters ? 'filtrados' : 'registrados'}</div>
            <div className="duna-stat__d">{bucketSel ? 'del bucket seleccionado' : 'del recorte activo'}</div>
          </div>
          <div className="duna-stat">
            <div className="duna-stat__v duna-num">{promedio !== null ? formatCOP(promedio) : '—'}</div>
            <div className="duna-stat__l">Promedio por pago</div>
            <div className="duna-stat__d">total ÷ pagos del recorte</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-2)', alignItems: 'center' }}>
          <select
            className="duna-input duna-select duna-input--sm"
            style={{ width: 'auto' }}
            aria-label="Filtrar por método de pago"
            value={metodo}
            onChange={e => setMetodoSel(e.target.value)}
          >
            {/* Agrupado por CÓMO LLEGA LA PLATA (lo que el operador distingue), no por la
                mecánica del filtro. "Cualquier digital" (value cat:*) conserva la
                capacidad de grupo —filtrar los tres digitales de un golpe— como primera
                opción del grupo, separada de los métodos por un divisor inerte (lo más
                cerca de "visualmente separada" que da un <select> nativo). */}
            <option value="all">Método · todos</option>
            <optgroup label="Digitales">
              <option value="cat:TRANSFERENCIA">Cualquier digital</option>
              <option value="" disabled>──────────</option>
              <option value="NEQUI">{METODO_PAGO_LABEL.NEQUI}</option>
              <option value="DAVIPLATA">{METODO_PAGO_LABEL.DAVIPLATA}</option>
              <option value="TRANSFERENCIA">{METODO_PAGO_LABEL.TRANSFERENCIA}</option>
            </optgroup>
            <optgroup label="Físicos">
              <option value="EFECTIVO">{METODO_PAGO_LABEL.EFECTIVO}</option>
            </optgroup>
            <optgroup label="Otros">
              <option value="OTRO">{METODO_PAGO_LABEL.OTRO}</option>
            </optgroup>
          </select>
          <PresetsPeriodo opciones={presetsPagos} desde={from} hasta={to} onSelect={setRango} />
          <DateRangePicker desde={from || null} hasta={to || null} onChange={setRango} />
          {/* Chip del bucket seleccionado — etiqueta auto-explicativa, nunca "1 seleccionado". */}
          {bucketSelObj && (
            <span className="duna-badge duna-badge--neutral" style={{ gap: 'var(--duna-space-inline)' }}>
              {etiquetaBucket(bucketSelObj.inicio, escala!)}
              <button type="button" onClick={() => setBucketSel(null)} aria-label="Quitar el período seleccionado"
                      style={{ display: 'inline-flex', border: 0, background: 'transparent', cursor: 'pointer', color: 'inherit', padding: 0 }}>
                <X style={{ width: 12, height: 12 }} />
              </button>
            </span>
          )}
          {hasFilters && (
            <button type="button" className="duna-btn duna-btn--ghost duna-btn--sm" onClick={clearFilters}>
              <FilterX /> Limpiar filtros
            </button>
          )}
        </div>
      </div>{/* /duna-cabecera */}

      {/* REGIÓN — un scroller ÚNICO con el strip + el libro (por eso van en un solo hijo
          de `.duna-region`): el strip scrollea y el header del libro queda sticky contra
          este scroller. El libro es `.admin-lista` (grid-list, sin overflow propio). */}
      <div className="duna-region">
        <div>
          {!loading && pagos.length > 0 && (
            <PagosStrip
              pagos={pagos} desde={from} hasta={to}
              metodoFiltrado={metodo} bucketSel={bucketSel} split={split} excl={excl}
              onBucket={setBucketSel} onToggleSplit={() => setSplit(s => !s)} onToggleExcl={toggleExcl}
            />
          )}

          {loading ? (
            <p className="duna-sub" style={{ margin: 'var(--duna-space-4) 0 0' }}>Cargando los pagos…</p>
          ) : pagos.length === 0 ? (
            <div className="duna-card duna-card__pad"><p className="duna-sub" style={{ margin: 0 }}>No hay pagos en el rango seleccionado.</p></div>
          ) : filtered.length === 0 ? (
            <div className="duna-card duna-card__pad"><p className="duna-sub" style={{ margin: 0 }}>No hay pagos que coincidan con el filtro.</p></div>
          ) : (
            <div className="admin-lista">
              <div className="admin-lista__fila admin-lista__head" style={{ gridTemplateColumns: COLS }}>
                <span>Fecha</span><span>Orden</span><span>Cliente</span>
                <span className="admin-lista__r">Monto</span><span>Método</span>
                <span>Referencia</span><span>Registrado por</span><span aria-hidden="true" />
              </div>
              {filtered.map(p => (
                <div key={p.id} className="admin-lista__fila" style={{ gridTemplateColumns: COLS }}>
                  <span className="duna-sub" style={{ margin: 0 }}>{formatFecha(p.fecha)}</span>
                  <span>
                    {p.order?.numero_orden
                      ? <Link href={`/admin/pedidos?pedido=${encodeURIComponent(p.order.numero_orden)}`} className="duna-link">{p.order.numero_orden}</Link>
                      : <span className="duna-sub">—</span>}
                  </span>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.order?.cliente_nombre ?? '—'}</span>
                  <span className="admin-lista__r duna-num">{formatCOP(p.monto)}</span>
                  <span><span className="duna-badge duna-badge--neutral">{METODO_PAGO_LABEL[p.metodo]}</span></span>
                  <span className="duna-mono" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.referencia || '—'}</span>
                  <span className="duna-sub" style={{ margin: 0 }}>{p.registrado_por_nombre ?? '—'}</span>
                  <span><SoporteClip comprobantes={p.order?.comprobantes ?? []} /></span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>{/* /duna-region */}
    </div>
  );
}

// ─── SoporteClip ──────────────────────────────────────────────────────────────
// Bajo el modelo de cobro, un Payment sólo coexiste con comprobantes VERIFICADOS
// (§ Pagos al lenguaje Duna). Clip neutro cuando lo hay; el punto de atención vive
// en el carril "Por verificar" de Pedidos, no en este libro.
function SoporteClip({ comprobantes }: { comprobantes: { estado: string }[] }) {
  if (!comprobantes.some(c => c.estado === 'VERIFICADO')) return null;
  return (
    <span title="Comprobante verificado en archivo" style={{ display: 'inline-flex', color: 'var(--duna-muted)' }}>
      <Paperclip style={{ width: 14, height: 14 }} />
    </span>
  );
}
