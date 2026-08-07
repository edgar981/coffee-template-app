'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Truck, MapPin, Clock, CheckCircle, AlertCircle, RotateCcw, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/ui/StatusBadge';
import { useTransicionEntrega } from '@/hooks/useTransicionEntrega';
import { ConfirmDespachoSinPago } from '@/components/admin/ConfirmDespachoSinPago';
import { formatCOP } from '@/lib/utils';
import { formatFecha } from '@/lib/format-fecha';
import { getShippings } from '@/lib/api/shippings';
import { ScheduleDeliveryModal } from '@/components/admin/ScheduleDeliveryModal';
import type { Shipping, ShippingFilter, ShippingOrderRef } from '@/types/shipping';
import { FILTER_ESTADOS, ZONA_COLORS, isScheduledShipping, hasScheduleData, missingToDispatch } from '@/constants/shippings';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { statCardLink } from '@/components/admin/StatCard';
import { filterChip } from '@/constants/filter-chip';
import { TIPO_ENVIO_LABEL } from '@/types/shipping';
import { metodoPrevistoLabel } from '@/types/payment';

// Resumen derivado de qué le falta a una entrega en `preparando` para poder
// despacharse. Es presentación pura sobre los mismos campos que ya gatean el
// despacho (`isScheduledShipping`) — no un estado nuevo.
function scheduleHint(e: Shipping): string {
  if (isScheduledShipping(e)) return 'Lista para despachar';
  const tieneMensajero = !!e.mensajero?.trim();
  const tieneFecha     = !!e.fecha_programada?.trim();
  if (!tieneMensajero && !tieneFecha) return 'Sin programar';
  return tieneMensajero ? 'Falta fecha' : 'Falta mensajero';
}

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
  // "cancelado" filter for history. 'listas_despacho' NO es un estado guardado:
  // se deriva con `isScheduledShipping` aquí en el cliente, por fuera del
  // filtrado por `estado` (FILTER_ESTADOS sigue mapeando 1:1 al enum de DB).
  const filtered =
    filter === 'all'             ? entregas.filter(e => e.estado !== 'cancelado')
    : filter === 'listas_despacho' ? entregas.filter(isScheduledShipping)
    : entregas.filter(e => e.estado === filter);

  const stats = {
    preparando: entregas.filter(e => e.estado === 'preparando').length,
    en_ruta:    entregas.filter(e => e.estado === 'en_ruta').length,
    entregados: entregas.filter(e => e.estado === 'entregado').length,
    fallidos:   entregas.filter(e => e.estado === 'fallido').length,
  };

  // ── Handlers ───────────────────────────────────────────────────────────────

  // Las transiciones (despachar / entregado / fallido + la confirmación de
  // despacho sin pago) viven en el hook COMPARTIDO con el detalle de la orden:
  // son dos puertas al mismo endpoint y no pueden divergir. La guarda sigue
  // siendo POR FILA — bloquear la tabla entera mientras una entrega se despacha
  // sería una traba, no una guarda, y ese roce es justo lo que hace que la gente
  // vuelva a clickear.
  //
  // El server ya absorbe el duplicado por bordes idempotentes (`justDelivered`,
  // `stock_descontado_at`), así que esto no arregla datos: le da al operador la
  // señal de que su click tomó, que es la mitad que faltaba.
  //
  // Sin `onError`: en una PÁGINA el toast es el vehículo correcto (el error
  // inline es la regla de los diálogos, y acá no hay ninguno abierto).
  const transicion = useTransicionEntrega({
    onUpdated: (updated) => setEntregas(prev => prev.map(e => e.id === updated.id ? updated : e)),
  });

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

      {/* Stats — cada tarjeta APLICA su filtro (el mismo estado que los chips de
          abajo, no un mecanismo paralelo): el conteo es sobre TODAS las entregas
          y la tabla muestra el subconjunto filtrado, así que el clic es
          justamente "muéstrame esas N". El chip correspondiente queda activo,
          que es la confirmación visual de qué se filtró. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Clock,        label: 'Preparando', value: stats.preparando, estado: 'preparando' as ShippingFilter, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400' },
          { icon: Truck,        label: 'En Ruta',    value: stats.en_ruta,    estado: 'en_ruta'    as ShippingFilter, color: 'text-sky-600 bg-sky-100 dark:bg-sky-900/30 dark:text-sky-400' },
          { icon: CheckCircle,  label: 'Entregados', value: stats.entregados, estado: 'entregado'  as ShippingFilter, color: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400' },
          { icon: AlertCircle,  label: 'Fallidos',   value: stats.fallidos,   estado: 'fallido'    as ShippingFilter, color: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400' },
        ].map(s => (
          <button
            key={s.label}
            type="button"
            onClick={() => setFilter(s.estado)}
            aria-pressed={filter === s.estado}
            // Con su filtro aplicado la tarjeta se marca con el patrón compartido
            // (borde de primario + tinte neutro), nunca con relleno: el sólido de
            // la vista está reservado a la acción primaria.
            className={`stat-card ${statCardLink(filter === s.estado)}`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>
              <s.icon className="w-4 h-4" />
            </div>
            <p className="text-xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Filter tabs. Los chips de estado van primero y en el orden del enum;
          "Listas para despachar" va al final porque es DERIVADO (checklist de
          programación), no un estado almacenado. `capitalize` solo aplica a los
          valores crudos del enum — las etiquetas escritas ya vienen en su forma
          final. */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all' as ShippingFilter, label: 'Todos', capitalize: false },
          ...FILTER_ESTADOS.map(e => ({ key: e as ShippingFilter, label: e.replace('_', ' '), capitalize: true })),
          { key: 'listas_despacho' as ShippingFilter, label: 'Listas para despachar', capitalize: false },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={`${filterChip(filter === f.key)} ${f.capitalize ? 'capitalize' : ''}`}
          >
            {f.label}
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
            <p className="text-sm text-muted-foreground mb-4">
              {filter === 'listas_despacho'
                ? 'Ninguna entrega tiene mensajero y fecha todavía.'
                : 'No hay entregas en este estado.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {['Orden', 'Cliente', 'Dirección', 'Zona', 'Mensajero / Guía', 'Costo', 'Estado', 'Pago', 'Fecha Programada', 'Acción'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">{e.order?.numero_orden ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{e.order?.cliente_nombre ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate max-w-32">
                          {[e.order?.direccion_entrega, e.order?.ciudad_entrega].filter(Boolean).join(', ') || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        {e.zona ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${ZONA_COLORS[e.zona] ?? 'bg-muted text-muted-foreground'}`}>
                            {e.zona}
                          </span>
                        ) : (
                          // Estado-vacío, no información → guion tenue como las
                          // demás celdas neutras (etiqueta la excepción, no el vacío).
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                        {/* Se etiqueta la EXCEPCIÓN, no el default: el chip de tipo
                            de envío solo aparece para NACIONAL (Local es el default
                            y no aporta; la transportadora/guía va en su columna). NO
                            re-completar el par Local/Nacional en una sesión futura. */}
                        {e.tipo_envio === 'NACIONAL' && (
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {TIPO_ENVIO_LABEL[e.tipo_envio] ?? e.tipo_envio}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {e.tipo_envio === 'NACIONAL' ? (
                        <div>
                          <span>{e.transportadora || <span className="text-muted-foreground italic">Sin transportadora</span>}</span>
                          {e.numero_guia && (
                            <p className="font-mono text-[11px] text-muted-foreground">Guía {e.numero_guia}</p>
                          )}
                        </div>
                      ) : (
                        e.mensajero || <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">{formatCOP(e.costo_envio)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={e.estado} />
                      {/* Checklist de programación, no un estado: por eso va en
                          texto muted debajo del badge y NO como valor nuevo de
                          ShippingEstado. Solo aplica mientras se prepara. */}
                      {e.estado === 'preparando' && (
                        <p className="mt-1 text-[11px] text-muted-foreground">{scheduleHint(e)}</p>
                      )}
                    </td>
                    {/* Pago en su propia columna (no anidado bajo el nombre): quien
                        despacha ve de un vistazo si cobra. Reusa el badge de PaymentHint. */}
                    <td className="px-4 py-3"><PaymentHint order={e.order} /></td>
                    {/* Neutral text matching the other columns. Delivered rows
                        show the real delivery date; others the scheduled date. */}
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {e.estado === 'entregado'
                        ? formatFecha(e.fecha_entrega)
                        : formatFecha(e.fecha_programada)}
                    </td>
                    <td className="px-4 py-3" onClick={ev => ev.stopPropagation()}>
                      {/* Next-state actions advance Shipping only — never Order.
                          Dos condiciones DISTINTAS: hay datos de programación
                          (label Programar/Editar) y se puede despachar (courier
                          + fecha, `isScheduledShipping`). Una entrega agendada
                          sin mensajero muestra "Editar" y un En Ruta deshabilitado
                          que dice por qué, en vez de esconder la acción. */}
                      <div className="flex flex-wrap gap-1.5">
                        {e.estado === 'preparando' && (
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setScheduleShipping(e)}>
                            {hasScheduleData(e)
                              ? <><Pencil className="w-3.5 h-3.5" /> Editar</>
                              : <><Truck className="w-3.5 h-3.5" /> Programar</>}
                          </Button>
                        )}
                        {e.estado === 'preparando' && hasScheduleData(e) && (
                          isScheduledShipping(e) ? (
                            <Button
                              size="sm" variant="outline" className="h-7 gap-1 text-xs"
                              disabled={transicion.enVuelo(e.id)}
                              onClick={() => transicion.despachar({
                                id:          e.id,
                                ordenPagada: e.order?.estado === 'pagado',
                                numeroOrden: e.order?.numero_orden ?? null,
                              })}
                            >
                              <Truck className="w-3.5 h-3.5" /> Marcar En Ruta
                            </Button>
                          ) : (
                            // Botón realmente deshabilitado (no focusable); el span
                            // es el target del tooltip porque un disabled se traga
                            // el hover. Mismo patrón que Clientes.
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex cursor-not-allowed">
                                  <Button
                                    size="sm" variant="outline" disabled
                                    className="h-7 gap-1 text-xs"
                                    aria-label={missingToDispatch(e) === 'mensajero'
                                      ? 'Asigna un mensajero para despachar'
                                      : 'Asigna una fecha programada para despachar'}
                                  >
                                    <Truck className="w-3.5 h-3.5" /> Marcar En Ruta
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {missingToDispatch(e) === 'mensajero'
                                  ? 'Asigna un mensajero para despachar'
                                  : 'Asigna una fecha programada para despachar'}
                              </TooltipContent>
                            </Tooltip>
                          )
                        )}
                        {e.estado === 'en_ruta' && (
                          <>
                            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={transicion.enVuelo(e.id)} onClick={() => transicion.marcarEntregado(e.id)}>
                              <CheckCircle className="w-3.5 h-3.5" /> Marcar Entregado
                            </Button>
                            <Button size="sm" variant="destructiveGhost" className="h-7 gap-1 text-xs" disabled={transicion.enVuelo(e.id)} onClick={() => transicion.marcarFallido(e.id)}>
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

      {/* Despachar sin pago registrado — confirmación explícita, la MISMA que ve
          el detalle de la orden. Al confirmar, el server marca la orden
          contraentrega (queda "Por cobrar" hasta el pago). */}
      <ConfirmDespachoSinPago {...transicion.confirmacion} />
    </div>
  );
}

// Estado de pago de la orden detrás de una entrega: UN badge que le dice al que
// hace la ruta si cobra y cómo. La instrucción y el método van dentro del badge,
// no como texto suelto debajo — dos elementos para un solo hecho se leían como
// dos cosas distintas. Las canceladas no muestran nada (la fila ya dice
// Cancelado).
function PaymentHint({ order }: { order?: ShippingOrderRef | null }) {
  if (!order) return null;

  // Contraentrega marker — the muted pill matches the Órdenes table badge.
  const condicion = order.condicion_pago === 'CONTRAENTREGA' && (
    <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      Contraentrega
    </span>
  );

  if (order.estado === 'pagado') {
    return (
      <div className="flex flex-wrap items-center gap-1">
        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
          Pagada
        </span>
        {condicion}
      </div>
    );
  }

  if (order.estado === 'pendiente') {
    // CONTRAENTREGA: el badge da la INSTRUCCIÓN ("cobrar al entregar") y, si está
    // declarado, con qué método — label del mapa único, nunca el valor crudo del
    // enum. Ese texto ya dice que es contraentrega, así que no se acompaña de la
    // píldora "Contraentrega": sería el mismo hecho dos veces en la misma fila.
    //
    // ANTICIPADO se queda en "Pendiente de cobro" y sin método: el cobro no
    // ocurre en la entrega, y rotular "cobrar al entregar" una orden prepagada
    // mandaba al mensajero a cobrar algo que no le toca.
    if (order.condicion_pago === 'CONTRAENTREGA') {
      const previsto = metodoPrevistoLabel(order);
      return (
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          {previsto ? `Cobrar al entregar · ${previsto}` : 'Cobrar al entregar'}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
        Pendiente de cobro
      </span>
    );
  }

  return null;
}