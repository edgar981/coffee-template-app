'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Truck, MapPin, Clock, CheckCircle, AlertCircle, RotateCcw, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/ui/StatusBadge';
import { toast } from 'sonner';
import { formatCOP } from '@/lib/utils';
import { getShippings, updateShipping } from '@/lib/api/shippings';
import { ScheduleDeliveryModal } from '@/components/admin/ScheduleDeliveryModal';
import type { Shipping, ShippingEstado, ShippingFilter } from '@/types/shipping';
import { FILTER_ESTADOS, ZONA_COLORS, isScheduledShipping } from '@/constants/shippings';

// fecha_entrega is a server-captured ISO timestamp; older rows may be date-only.
const formatDeliveryDate = (v: string) => {
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function Entregas() {
  const [entregas, setEntregas] = useState<Shipping[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<ShippingFilter>('all');
  // Shipping being scheduled/edited/rescheduled (opens the shared modal — same
  // one as Ordenes). Covers Programar, Editar and Reprogramar.
  const [scheduleShipping, setScheduleShipping] = useState<Shipping | null>(null);

  useEffect(() => {
    getShippings().then(data => { setEntregas(data); setLoading(false); });
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────

  // Active board excludes cancelled deliveries; they stay reachable via the
  // "cancelado" filter for history.
  const filtered = filter === 'all'
    ? entregas.filter(e => e.estado !== 'cancelado')
    : entregas.filter(e => e.estado === filter);

  const stats = {
    preparando: entregas.filter(e => e.estado === 'preparando').length,
    en_ruta:    entregas.filter(e => e.estado === 'en_ruta').length,
    entregados: entregas.filter(e => e.estado === 'entregado').length,
    fallidos:   entregas.filter(e => e.estado === 'fallido').length,
  };

  // ── Handlers ───────────────────────────────────────────────────────────────

  const updateEstado = async (id: string, estado: ShippingEstado) => {
    try {
      // fecha_entrega is captured server-side on the entregado transition.
      const updated = await updateShipping(id, { estado });
      setEntregas(prev => prev.map(e => e.id === id ? updated : e));
      toast.success('Estado actualizado');
    } catch {
      toast.error('Error al actualizar el estado');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Entregas</h1>
          <p className="text-sm text-muted-foreground">Gestión de despachos y domicilios</p>
        </div>
        <Button asChild variant="outline" className="gap-2">
          <Link href="/admin/ordenes">
            <Truck className="w-4 h-4" /> Programar desde órdenes
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Clock,        label: 'Preparando', value: stats.preparando, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400' },
          { icon: Truck,        label: 'En Ruta',    value: stats.en_ruta,    color: 'text-sky-600 bg-sky-100 dark:bg-sky-900/30 dark:text-sky-400' },
          { icon: CheckCircle,  label: 'Entregados', value: stats.entregados, color: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400' },
          { icon: AlertCircle,  label: 'Fallidos',   value: stats.fallidos,   color: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>
              <s.icon className="w-4 h-4" />
            </div>
            <p className="text-xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['all', ...FILTER_ESTADOS] as ShippingFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize ${
              filter === f
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {f === 'all' ? 'Todos' : f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Truck className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <h3 className="font-semibold mb-1">Sin entregas</h3>
            <p className="text-sm text-muted-foreground mb-4">No hay entregas en este estado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {['Orden', 'Cliente', 'Dirección', 'Zona', 'Mensajero', 'Costo', 'Estado', 'Fecha Programada', 'Acción'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{e.order?.numero_orden ?? '—'}</td>
                    <td className="px-4 py-3 font-medium">{e.order?.cliente_nombre ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate max-w-32">
                          {[e.order?.direccion_entrega, e.order?.ciudad_entrega].filter(Boolean).join(', ') || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {e.zona ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${ZONA_COLORS[e.zona] ?? 'bg-muted text-muted-foreground'}`}>
                          {e.zona}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Sin asignar</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">{e.mensajero || <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3 text-sm">{formatCOP(e.costo_envio)}</td>
                    <td className="px-4 py-3"><StatusBadge status={e.estado} /></td>
                    {/* Neutral text matching the other columns. Delivered rows
                        show the real delivery date; others the scheduled date. */}
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {e.estado === 'entregado'
                        ? (e.fecha_entrega ? formatDeliveryDate(e.fecha_entrega) : '—')
                        : (e.fecha_programada ?? '—')}
                    </td>
                    <td className="px-4 py-3" onClick={ev => ev.stopPropagation()}>
                      {/* Next-state actions advance Shipping only — never Order.
                          A delivery can't go En Ruta until scheduled (courier +
                          fecha) — unscheduled rows only offer "Programar". */}
                      <div className="flex flex-wrap gap-1.5">
                        {e.estado === 'preparando' && !isScheduledShipping(e) && (
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setScheduleShipping(e)}>
                            <Truck className="w-3.5 h-3.5" /> Programar
                          </Button>
                        )}
                        {e.estado === 'preparando' && isScheduledShipping(e) && (
                          <>
                            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setScheduleShipping(e)}>
                              <Pencil className="w-3.5 h-3.5" /> Editar
                            </Button>
                            <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => updateEstado(e.id, 'en_ruta')}>
                              <Truck className="w-3.5 h-3.5" /> Marcar En Ruta
                            </Button>
                          </>
                        )}
                        {e.estado === 'en_ruta' && (
                          <>
                            <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => updateEstado(e.id, 'entregado')}>
                              <CheckCircle className="w-3.5 h-3.5" /> Marcar Entregado
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700" onClick={() => updateEstado(e.id, 'fallido')}>
                              <AlertCircle className="w-3.5 h-3.5" /> Marcar Fallido
                            </Button>
                          </>
                        )}
                        {e.estado === 'fallido' && (
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setScheduleShipping(e)}>
                            <RotateCcw className="w-3.5 h-3.5" /> Reprogramar
                          </Button>
                        )}
                        {e.estado === 'entregado' && (
                          <span className="text-xs text-muted-foreground">Completada</span>
                        )}
                        {e.estado === 'cancelado' && (
                          <span className="text-xs text-muted-foreground">Cancelada</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Programar / Editar / Reprogramar — the SAME shared modal as Ordenes and
          the same endpoint. The modal derives its title/behavior from the
          shipping's state; on save the server applies the guards. */}
      <ScheduleDeliveryModal
        target={scheduleShipping ? { shipping: scheduleShipping } : null}
        onClose={() => setScheduleShipping(null)}
        onSaved={(sh) => setEntregas(prev => prev.map(x => x.id === sh.id ? { ...x, ...sh } : x))}
        onAddressAdded={(orderId, address) => setEntregas(prev => prev.map(x =>
          x.orden_id === orderId && x.order
            ? { ...x, order: { ...x.order, direccion_entrega: address.direccion_entrega, ciudad_entrega: address.ciudad_entrega } }
            : x
        ))}
      />
    </div>
  );
}