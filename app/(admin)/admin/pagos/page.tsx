'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { FilterX, Paperclip } from 'lucide-react';
import { DateRangePicker } from '@/components/admin/DateRangePicker';
import { DunaTable, type DunaColumn } from '@duna/design-system/components/DunaTable';
import { getPayments } from '@/lib/api/payments';
import type { Payment } from '@/types/payment';
import {
  METODOS_PAGO, METODO_PAGO_LABEL, METODO_CATEGORIA,
  PAYMENT_CATEGORIA_LABEL, PAYMENT_CATEGORIAS_MULTI,
} from '@/types/payment';
import { formatCOP } from '@duna/core/utils';
import { formatFecha } from '@duna/core/format-fecha';
import { BUSINESS_TZ, zonedDayKey } from '@duna/core/timezone';
import { rangoDeDiasDelPeriodo, opcionesPreset } from '@/lib/metrics/periodo';
import { PresetsPeriodo } from '@/components/admin/PresetsPeriodo';

// ─── Page ─────────────────────────────────────────────────────────────────────

// useSearchParams() needs a Suspense boundary (same pattern as Órdenes).
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
  // La pantalla SIEMPRE abre con un rango: MES EN CURSO por defecto —lo que el
  // operador necesita ver al abrir un libro de pagos, "¿cuánto llevó este mes?"— o el
  // `?desde/?hasta` del deep-link del dashboard (Ventas hoy → hoy, Ingresos del mes →
  // el mes). Con rango siempre presente el server nunca consulta sin acotar (§ el
  // route): no hay caso "sin rango" ni corte silencioso que declarar.
  // El reloj se fija al montar: los presets y el default no se recalculan por render.
  const ahora    = useMemo(() => new Date(), []);
  const hoy      = zonedDayKey(ahora, BUSINESS_TZ);
  // El DEFAULT es el MISMO rango que el preset "Este mes" (una fuente), así que al
  // abrir queda ese preset marcado.
  const rangoMes = useMemo(() => rangoDeDiasDelPeriodo('mes', ahora), [ahora]);
  // "Hoy" no es un período mensual (no está en `PERIODOS`): se antepone acá. El resto
  // sale del set compartido. Para lo más viejo que 3 meses, el date picker.
  const presetsPagos = useMemo(
    () => [{ label: 'Hoy', desde: hoy, hasta: hoy }, ...opcionesPreset(['mes', 'mes_anterior', 'ultimos_3_meses'], ahora)],
    [hoy, ahora],
  );
  const [pagos, setPagos]     = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  // 'all' | a MetodoPago | `cat:${PaymentCategoria}` (grouped-category filter).
  const [metodo, setMetodo]   = useState<string>('all');
  const [from, setFrom]       = useState(() => searchParams.get('desde') ?? rangoMes.desde);
  const [to, setTo]           = useState(() => searchParams.get('hasta') ?? rangoMes.hasta);

  // El rango se filtra en SQL, así que un cambio de rango RE-CONSULTA. El `active`
  // evita que una respuesta lenta pise a una más nueva (mismo patrón que el carrusel).
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

  // SÓLO el método filtra acá — el rango ya lo aplicó el server. `pagos` ES el recorte
  // del rango, así que la tabla y (luego) el strip leen las MISMAS filas client-side.
  const filtered = useMemo(() => pagos.filter(p => {
    if (metodo === 'all') return true;
    if (metodo.startsWith('cat:')) return METODO_CATEGORIA[p.metodo] === metodo.slice(4);
    return p.metodo === metodo;
  }), [pagos, metodo]);

  const totalPeriodo = filtered.reduce((sum, p) => sum + p.monto, 0);
  // La 3ª cifra: promedio del recorte. Reemplaza al desglose "Por método", que se va
  // al strip (§ decisión de contenido). `null` con 0 pagos → "—", no un $0 engañoso.
  const promedio = filtered.length ? totalPeriodo / filtered.length : null;

  // "Filtrado" ya no es "hay rango" (siempre lo hay) sino "algo distinto del default":
  // método ≠ all, o rango ≠ mes en curso.
  const hasFilters = metodo !== 'all' || from !== rangoMes.desde || to !== rangoMes.hasta;
  // Limpiar vuelve al DEFAULT (método all + mes en curso) y borra el deep-link de la
  // URL, para que un reload use el default y no re-aplique un `?desde/?hasta` viejo.
  const clearFilters = () => {
    setMetodo('all'); setFrom(rangoMes.desde); setTo(rangoMes.hasta);
    const next = new URLSearchParams(searchParams.toString());
    next.delete('desde'); next.delete('hasta');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // La tabla es `DunaTable` (thead sticky de fábrica, como el kardex de Inventario).
  // El re-skin de esta tanda es COLUMNAR; la agrupación por día de la maqueta es
  // contenido sin cerrar y vuelve con el strip.
  const columnasPagos: DunaColumn[] = [
    { key: 'fecha',   header: 'Fecha' },
    { key: 'orden',   header: 'Orden' },
    { key: 'cliente', header: 'Cliente' },
    { key: 'monto',   header: 'Monto', align: 'right' },
    { key: 'metodo',  header: 'Método' },
    { key: 'ref',     header: 'Referencia' },
    { key: 'por',     header: 'Registrado por' },
    // Soporte: SIN encabezado, un clip neutro al final de la fila y sin protagonismo.
    // El punto de atención vive en el carril "Por verificar" de Pedidos, no en este
    // libro read-only.
    { key: 'soporte', header: '' },
  ];
  const filasPagos = filtered.map(p => ({
    key: p.id,
    cells: [
      formatFecha(p.fecha),
      p.order?.numero_orden
        ? <Link key="orden" href={`/admin/pedidos?pedido=${encodeURIComponent(p.order.numero_orden)}`} className="duna-link">{p.order.numero_orden}</Link>
        : '—',
      p.order?.cliente_nombre ?? '—',
      <span key="monto" className="duna-num">{formatCOP(p.monto)}</span>,
      <span key="metodo" className="duna-badge duna-badge--neutral">{METODO_PAGO_LABEL[p.metodo]}</span>,
      <span key="ref" className="duna-mono">{p.referencia || '—'}</span>,
      p.registrado_por_nombre ?? '—',
      <SoporteClip key="soporte" comprobantes={p.order?.comprobantes ?? []} />,
    ],
  }));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="duna duna-sin-split">
      {/* CABECERA — todo lo FIJO (header + stats + filtros). Alto fijo desde 960
          (§ duna.css, `.duna-sin-split`); debajo de 960 es flujo normal, document-scroll.
          Sólo la tabla scrollea (la región de abajo). */}
      <div className="duna-cabecera space-y-6 pb-6">
        {/* Header — no hay "Registrar pago": un pago se registra desde su orden
            (Pedidos › Registrar pago). Esta pantalla es un libro de solo lectura. */}
        <div>
          <h1 className="duna-display-m">Pagos</h1>
          <p className="duna-sub" style={{ margin: 'var(--duna-space-hairline) 0 0' }}>
            Ledger de pagos registrados. Se registran desde cada orden.
          </p>
        </div>

        {/* Stats — 3 cifras del recorte. El desglose "Por método" se fue al strip; en
            su lugar, "Promedio por pago". Sin verde en el total: un total no es un
            estado (§ doctrina). `.duna-stat` con divisores, como el resto del panel. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', rowGap: 'var(--duna-space-4)' }}>
          <div className="duna-stat">
            <div className="duna-stat__v duna-num">{formatCOP(totalPeriodo)}</div>
            <div className="duna-stat__l">Total del período</div>
            <div className="duna-stat__d">del recorte activo</div>
          </div>
          <div className="duna-stat">
            <div className="duna-stat__v duna-num">{filtered.length}</div>
            <div className="duna-stat__l">Pagos {hasFilters ? 'filtrados' : 'registrados'}</div>
            <div className="duna-stat__d">del recorte activo</div>
          </div>
          <div className="duna-stat">
            <div className="duna-stat__v duna-num">{promedio !== null ? formatCOP(promedio) : '—'}</div>
            <div className="duna-stat__l">Promedio por pago</div>
            <div className="duna-stat__d">total ÷ pagos del recorte</div>
          </div>
        </div>

        {/* Filtros — select NATIVO (`.duna-select`, como Inventario; la lista abierta la
            pinta el SO y `color-scheme` la alinea al tema), presets compartidos, date
            picker, y limpiar. Sin `<Label>`: la primera opción se auto-rotula. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-2)', alignItems: 'center' }}>
          <select
            className="duna-input duna-select duna-input--sm"
            style={{ width: 'auto' }}
            aria-label="Filtrar por método de pago"
            value={metodo}
            onChange={e => setMetodo(e.target.value)}
          >
            <option value="all">Método · todos</option>
            {PAYMENT_CATEGORIAS_MULTI.length > 0 && (
              <optgroup label="Categoría">
                {PAYMENT_CATEGORIAS_MULTI.map(cat => (
                  <option key={`cat:${cat}`} value={`cat:${cat}`}>{PAYMENT_CATEGORIA_LABEL[cat]} (todas)</option>
                ))}
              </optgroup>
            )}
            <optgroup label="Método">
              {METODOS_PAGO.map(m => (
                <option key={m} value={m}>{METODO_PAGO_LABEL[m]}</option>
              ))}
            </optgroup>
          </select>
          {/* Presets de período: un clic cambia el rango (y re-consulta). El date picker
              de al lado cubre lo más viejo que 3 meses. Fila COMPARTIDA con Inventario. */}
          <PresetsPeriodo
            opciones={presetsPagos}
            desde={from} hasta={to}
            onSelect={(d, h) => { setFrom(d); setTo(h); }}
          />
          <DateRangePicker
            desde={from || null}
            hasta={to || null}
            onChange={(d, h) => { setFrom(d ?? ''); setTo(h ?? ''); }}
          />
          {hasFilters && (
            <button type="button" className="duna-btn duna-btn--ghost duna-btn--sm" onClick={clearFilters}>
              <FilterX /> Limpiar filtros
            </button>
          )}
        </div>
      </div>{/* /duna-cabecera */}

      {/* REGIÓN — sólo la tabla scrollea (§ duna.css, `.duna-sin-split .duna-region`).
          `DunaTable` trae su envoltorio-scroller y el thead sticky de fábrica.
          loading/empty ocupan la región. */}
      <div className="duna-region">
        {loading && <p className="duna-sub" style={{ margin: 0 }}>Cargando los pagos…</p>}
        {!loading && filtered.length === 0 && (
          <div className="duna-card duna-card__pad">
            {/* Distinguir "no hay nada" de "el filtro no encontró nada". */}
            <p className="duna-sub" style={{ margin: 0 }}>
              {pagos.length === 0
                ? 'No hay pagos en el rango seleccionado.'
                : 'No hay pagos que coincidan con el filtro de método.'}
            </p>
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <DunaTable columns={columnasPagos} rows={filasPagos} minWidth="56rem" />
        )}
      </div>{/* /duna-region */}
    </div>
  );
}

// ─── SoporteClip ──────────────────────────────────────────────────────────────
// Los comprobantes cuelgan de la ORDEN, no del Payment (§3.1). Bajo el modelo de
// cobro un Payment SÓLO coexiste con comprobantes VERIFICADOS —verificar CREA el
// Payment y sella en la MISMA transacción; RECIBIDO/RECHAZADO + Payment son
// imposibles hacia adelante—, así que la rama ÁMBAR "Por verificar" se BORRÓ: era
// código inalcanzable que aparentaba estar vivo (la trampa que el backlog documenta).
//
// El clip es NEUTRO y sin protagonismo: dice sólo "hay soporte verificado en
// archivo". El punto de atención —lo que hay que resolver— vive en el carril "Por
// verificar" de Pedidos, no en este libro de solo lectura.
//
// (Los 4 registros de dev con Payment + RECIBIDO/RECHAZADO son data de prueba ya
// declarada; sin VERIFICADO no muestran clip, que es lo correcto.)

function SoporteClip({ comprobantes }: { comprobantes: { estado: string }[] }) {
  const verificado = comprobantes.some(c => c.estado === 'VERIFICADO');
  if (!verificado) return null;
  return (
    <span
      title="Comprobante verificado en archivo"
      style={{ display: 'inline-flex', color: 'var(--duna-muted)' }}
    >
      <Paperclip style={{ width: 14, height: 14 }} />
    </span>
  );
}
