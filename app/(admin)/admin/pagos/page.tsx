'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { CreditCard, DollarSign, Receipt, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { DateRangePicker } from '@/components/admin/DateRangePicker';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getPayments } from '@/lib/api/payments';
import type { Payment } from '@/types/payment';
import { tienePendienteDeVerificar } from '@/lib/comprobante';
import { Paperclip } from 'lucide-react';
import {
  METODOS_PAGO, METODO_PAGO_LABEL,
  METODO_CATEGORIA, PAYMENT_CATEGORIA_LABEL, PAYMENT_CATEGORIAS, PAYMENT_CATEGORIAS_MULTI,
  METODO_DESGLOSE_LABEL,
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

  // "Por método" summary, bucketed by category. Each category shows its count +
  // total; multi-method categories (Transferencia) also list the method breakdown.
  // A category only appears when it has payments (so OTRO shows only if used).
  const categoriaStats = useMemo(() =>
    PAYMENT_CATEGORIAS
      .map(cat => {
        const methods = METODOS_PAGO.filter(m => METODO_CATEGORIA[m] === cat);
        const pays    = filtered.filter(p => METODO_CATEGORIA[p.metodo] === cat);
        const desglose = methods
          .map(m => ({ metodo: m, count: filtered.filter(p => p.metodo === m).length }))
          .filter(b => b.count > 0);
        return {
          categoria: cat,
          multi:     methods.length > 1,
          count:     pays.length,
          total:     pays.reduce((s, p) => s + p.monto, 0),
          desglose,
        };
      })
      .filter(c => c.count > 0),
    [filtered]);

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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="duna-sin-split">
      {/* CABECERA — todo lo FIJO (header + stats + filtros). Alto fijo desde 960
          (§ duna.css, `.duna-sin-split`); debajo de 960 es flujo normal, document-scroll.
          Sólo la tabla scrollea (la región de abajo). */}
      <div className="duna-cabecera space-y-6 pb-6">
      {/* Header — no independent "Registrar pago": a payment is registered from
          its order (Órdenes › Registrar pago). This page is a read-only ledger. */}
      <div>
        <h1 className="text-2xl font-bold">Pagos</h1>
        <p className="text-sm text-muted-foreground">
          Ledger de pagos registrados. Se registran desde cada orden.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="stat-card">
          <DollarSign className="w-5 h-5 text-emerald-500 mb-3" />
          <p className="text-xl font-bold text-emerald-600">{formatCOP(totalPeriodo)}</p>
          <p className="text-xs text-muted-foreground">Total del período</p>
        </div>
        <div className="stat-card">
          <Receipt className="w-5 h-5 text-muted-foreground mb-3" />
          <p className="text-xl font-bold">{filtered.length}</p>
          <p className="text-xs text-muted-foreground">Pagos {hasFilters ? 'filtrados' : 'registrados'}</p>
        </div>
        <div className="stat-card hidden lg:block">
          <CreditCard className="w-5 h-5 text-muted-foreground mb-3" />
          {categoriaStats.length === 0 ? (
            <span className="text-xs text-muted-foreground">Sin pagos</span>
          ) : (
            <div className="space-y-1.5">
              {categoriaStats.map(c => (
                <div key={c.categoria}>
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="font-medium text-foreground">{PAYMENT_CATEGORIA_LABEL[c.categoria]}</span>
                    <span className="whitespace-nowrap text-muted-foreground">
                      <span className="font-semibold text-foreground">{c.count}</span>
                      {' · '}{formatCOP(c.total)}
                    </span>
                  </div>
                  {c.multi && c.desglose.length > 0 && (
                    <p className="text-[11px] leading-tight text-muted-foreground/80">
                      {c.desglose.map(b => `${METODO_DESGLOSE_LABEL[b.metodo]} ${b.count}`).join(' · ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">Por método</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Método</Label>
          <Select value={metodo} onValueChange={setMetodo}>
            <SelectTrigger className="mt-1 h-9 w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {PAYMENT_CATEGORIAS_MULTI.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Categoría</SelectLabel>
                  {PAYMENT_CATEGORIAS_MULTI.map(cat => (
                    <SelectItem key={`cat:${cat}`} value={`cat:${cat}`}>
                      {PAYMENT_CATEGORIA_LABEL[cat]} (todas)
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              <SelectGroup>
                <SelectLabel>Método</SelectLabel>
                {METODOS_PAGO.map(m => (
                  <SelectItem key={m} value={m}>{METODO_PAGO_LABEL[m]}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
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
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1 text-xs">
            <X className="w-3.5 h-3.5" /> Limpiar
          </Button>
        )}
      </div>

      </div>{/* /duna-cabecera */}

      {/* REGIÓN — sólo la tabla scrollea (§ duna.css, `.duna-sin-split .duna-region`).
          El card ES el scroller: la región le da `overflow-y` y su `overflow-x-auto`
          cubre el ancho, así el thead sticky se pega contra UN solo scroller.
          loading/empty ocupan la región. */}
      <div className="duna-region">
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <CreditCard className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {pagos.length === 0
                ? 'No hay pagos en el rango seleccionado.'
                : 'No hay pagos que coincidan con el filtro de método.'}
            </p>
          </div>
        ) : (
            <table className="w-full text-sm">
              <thead>
                {/* Sticky: el card scrollea y el encabezado no puede irse con las
                    filas. bg OPACO (no `/40`) para tapar lo que pasa por debajo; el
                    borde va en el th, que viaja con el sticky —el de la fila se
                    quedaría atrás—. */}
                <tr>
                  {['Fecha', 'Orden', 'Cliente', 'Monto', 'Método', 'Soporte', 'Referencia', 'Registrado por'].map(h => (
                    <th key={h} className="sticky top-0 z-10 bg-muted border-b border-border text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatFecha(p.fecha)}</td>
                    <td className="px-4 py-3">
                      {p.order?.numero_orden ? (
                        <Link
                          href={`/admin/pedidos?pedido=${encodeURIComponent(p.order.numero_orden)}`}
                          className="font-mono text-xs font-semibold text-foreground hover:underline"
                        >
                          {p.order.numero_orden}
                        </Link>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 font-medium">{p.order?.cliente_nombre ?? '—'}</td>
                    <td className="px-4 py-3 font-bold">{formatCOP(p.monto)}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className="bg-muted px-2 py-0.5 rounded">{METODO_PAGO_LABEL[p.metodo]}</span>
                    </td>
                    {/* SOPORTE — indicador, no acción: verificar y ampliar viven
                        en el detalle de la orden, que es donde está el contexto.
                        Se etiqueta la EXCEPCIÓN (hay algo por verificar) con
                        ámbar; "con soporte" ya verificado va neutro, y un pago
                        sin soporte no lleva nada — el efectivo no tiene qué
                        fotografiar, así que su vacío no es una falta. */}
                    <td className="px-4 py-3">
                      <SoportePago comprobantes={p.order?.comprobantes ?? []} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.referencia || '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{p.registrado_por_nombre ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
        )}
      </div>
      </div>{/* /duna-region */}
    </div>
  );
}

// ─── SoportePago ──────────────────────────────────────────────────────────────
// Los comprobantes cuelgan de la ORDEN, no del Payment (§3.1). Acá sólo se dice
// si los hay y si alguno sigue sin mirar; el veredicto se da en el detalle de la
// orden, a un click del número de la fila.

function SoportePago({ comprobantes }: { comprobantes: { id: string; estado: string }[] }) {
  if (comprobantes.length === 0) return <span className="text-xs text-muted-foreground">—</span>;

  const pendiente = tienePendienteDeVerificar(
    comprobantes as { estado: 'RECIBIDO' | 'VERIFICADO' | 'RECHAZADO' }[],
  );

  return (
    <span
      title={pendiente
        ? 'Tiene un comprobante sin verificar. Ábrelo desde la orden.'
        : 'Comprobante adjunto y ya revisado.'}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        pendiente
          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
          : 'bg-muted text-muted-foreground'
      }`}
    >
      <Paperclip className="h-3 w-3" />
      {pendiente ? 'Por verificar' : comprobantes.length > 1 ? `${comprobantes.length} soportes` : 'Con soporte'}
    </span>
  );
}
