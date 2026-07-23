'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { CreditCard, DollarSign, Receipt, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getPayments } from '@/lib/api/payments';
import type { Payment } from '@/types/payment';
import {
  METODOS_PAGO, METODO_PAGO_LABEL,
  METODO_CATEGORIA, PAYMENT_CATEGORIA_LABEL, PAYMENT_CATEGORIAS, PAYMENT_CATEGORIAS_MULTI,
  METODO_DESGLOSE_LABEL,
} from '@/types/payment';
import { formatCOP } from '@/lib/utils';
import { BUSINESS_TZ } from '@/lib/timezone';

// yyyy-mm-dd in Bogotá wall-clock, for range filtering and display consistency.
const bogotaISODate = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(iso));

const displayDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', {
    timeZone: BUSINESS_TZ, day: '2-digit', month: 'short', year: 'numeric',
  });

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Pagos() {
  const [pagos, setPagos]     = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  // 'all' | a MetodoPago | `cat:${PaymentCategoria}` (grouped-category filter).
  const [metodo, setMetodo]   = useState<string>('all');
  const [from, setFrom]       = useState('');
  const [to, setTo]           = useState('');

  useEffect(() => {
    getPayments()
      .then(data => setPagos(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => pagos.filter(p => {
    if (metodo !== 'all') {
      if (metodo.startsWith('cat:')) {
        if (METODO_CATEGORIA[p.metodo] !== metodo.slice(4)) return false;
      } else if (p.metodo !== metodo) {
        return false;
      }
    }
    const d = bogotaISODate(p.fecha);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  }), [pagos, metodo, from, to]);

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

  const hasFilters = metodo !== 'all' || !!from || !!to;
  const clearFilters = () => { setMetodo('all'); setFrom(''); setTo(''); };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
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
          <Receipt className="w-5 h-5 text-blue-500 mb-3" />
          <p className="text-xl font-bold">{filtered.length}</p>
          <p className="text-xs text-muted-foreground">Pagos {hasFilters ? 'filtrados' : 'registrados'}</p>
        </div>
        <div className="stat-card hidden lg:block">
          <CreditCard className="w-5 h-5 text-violet-500 mb-3" />
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
        <div>
          <Label className="text-xs">Desde</Label>
          <Input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} className="mt-1 h-9 w-40" />
        </div>
        <div>
          <Label className="text-xs">Hasta</Label>
          <Input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} className="mt-1 h-9 w-40" />
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1 text-xs">
            <X className="w-3.5 h-3.5" /> Limpiar
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <CreditCard className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {pagos.length === 0
                ? 'Aún no hay pagos registrados. Registra un pago desde una orden pendiente.'
                : 'No hay pagos que coincidan con los filtros.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {['Fecha', 'Orden', 'Cliente', 'Monto', 'Método', 'Referencia', 'Registrado por'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{displayDate(p.fecha)}</td>
                    <td className="px-4 py-3">
                      {p.order?.numero_orden ? (
                        <Link
                          href={`/admin/ordenes?order=${encodeURIComponent(p.order.numero_orden)}`}
                          className="font-mono text-xs font-semibold text-primary hover:underline"
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
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.referencia || '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{p.registrado_por_nombre ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Wompi note — online rails come later; today all payments are manual. */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 max-w-xl">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">Pagos en línea próximamente</p>
        <p className="text-xs text-amber-700 dark:text-amber-500 mt-1">
          Hoy los pagos se confirman manualmente (Nequi, Daviplata, efectivo, transferencia). Wompi se integrará para cobros en línea automáticos.
        </p>
      </div>
    </div>
  );
}
