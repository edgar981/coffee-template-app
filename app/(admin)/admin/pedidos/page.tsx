'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { OrderCard } from '@duna/design-system/components/OrderCard';
import { ItemsTable } from '@duna/design-system/components/ItemsTable';
import { Timeline } from '@duna/design-system/components/Timeline';
import { BADGE_TONE_CLASS } from '@duna/design-system/status';
import { getOrders, getOrder } from '@/lib/api/orders';
import { formatCOP } from '@duna/core/utils';
import { METODO_PAGO_LABEL, metodoPrevistoLabel } from '@/types/payment';
import type { Order, OrderDetalle } from '@/types/order';
import { ChipCanal } from '@/components/admin/ChipCanal';
import { FILTROS_PEDIDOS, aplicarFiltro, conteos, filtroPorKey, filtrarPorCliente, type FiltroKey } from '@/lib/pedidos/filtros';
import { pasosDelPedido, badgeCobro } from '@/lib/pedidos/estado';
import { motivosDeAtencion, textoDeMotivo } from '@/lib/pedidos/atencion';
import { recorridoDelPedido, tieneDerivados } from '@/lib/pedidos/recorrido';
import { hace } from '@/lib/pedidos/tiempo';
import { useControlComprobantes, type ControlComprobantes } from '@/hooks/useControlComprobantes';
import { useTransicionEntrega, type TransicionEntrega } from '@/hooks/useTransicionEntrega';
import { useAccionGuardada } from '@/hooks/useAccionGuardada';
import { ErrorDialogo, useErrorDialogo } from '@/components/admin/ErrorDialogo';
import { ScheduleDeliveryModal } from '@/components/admin/ScheduleDeliveryModal';
import { RegisterPaymentModal } from '@/components/admin/RegisterPaymentModal';
import { ConfirmDeleteDialog } from '@/components/admin/ConfirmDeleteDialog';
import { ConfirmDespachoSinPago } from '@/components/admin/ConfirmDespachoSinPago';
import { ComprobanteVista, SelectorComprobante, useLightboxComprobante } from '@/components/admin/Comprobantes';
import { ImageLightbox } from '@/components/admin/ImageLightbox';
import { ensureOrderShipping } from '@/lib/api/shippings';
import { updateOrder } from '@/lib/api/orders';
import { accionAlVerificar, puedeDecidirse, nombreArchivo } from '@/lib/comprobante';
import { MAX_COMPROBANTE_MB } from '@/constants/comprobante';
import { RECHAZAR_COMPROBANTE_COPY, CANCELAR_ORDEN_COPY } from '@/constants/confirmaciones';
import { isScheduledShipping, hasScheduleData, missingToDispatch } from '@/constants/shippings';
import type { Shipping } from '@/types/shipping';
import type { Comprobante } from '@/types/comprobante';

// Todo lo que el panel necesita para OPERAR sin ser dueño de ninguna mutación.
// Mismo patrón que `ControlComprobantes`: el panel renderiza y llama hacia arriba.
interface AccionesPedido {
  transicion:     TransicionEntrega;
  control:        ControlComprobantes;
  errorAccion:    ReturnType<typeof useErrorDialogo>;
  preparando:     boolean;
  abrirProgramar: (orden: Order) => void;
  abrirCobrar:    (orden: Order) => void;
  abrirCancelar:  (orden: Order) => void;
  abrirRechazar:  (orden: Order, c: Comprobante) => void;
  verificar:      (orden: Order, c: Comprobante) => void;
}

// ═══ PEDIDOS · la pantalla del rediseño Duna OS ══════════════════════════════
//
// Se construye SOLO con primitivas de @duna/design-system. Cero valores nuevos:
// ni un color, ni un espaciado, ni un radio inventado acá. Los cuatro huecos que
// aparecieron construyéndola se llenaron EN EL SISTEMA, cada uno en su commit
// (layout partido, punto de nav, ranura de actor de la timeline, `steps`
// opcional). Un valor local "sólo esta vez" es el momento en que el sistema deja
// de ser fuente de verdad.
//
// Vive en RUTA PROPIA, en paralelo a /admin/ordenes, que no se toca (decisión del
// owner). La operativa actual tiene seis flujos modales en producción y
// reemplazarla obligaría a reconstruirlos con un DS que todavía no tiene primitiva
// de diálogo — o sea, a inventar. Además el gate visual se hace A/B contra ella.
//
// DEUDA CON DISPARADOR (declarada): cuando esta pantalla absorba los flujos
// operativos, van a usar los modales shadcn de /admin/ordenes hasta que el
// design-system tenga primitiva de diálogo (H6).
//
// LOS FLUJOS OPERATIVOS reusan los modales de /admin/ordenes tal cual —ya están
// probados en producción— y sus mutaciones viven en ESTE componente, no en el
// panel: el panel se desmonta al cambiar de pedido y una mutación montada ahí
// puede perder su continuación (§ el gate del 2026-08-06).

/** Iniciales para el avatar. Una letra si el nombre es de una palabra. */
function iniciales(nombre: string): string {
  return nombre.trim().split(/\s+/).slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase() || '?';
}

export default function PedidosPage() {
  return <Suspense fallback={null}><Pedidos /></Suspense>;
}

function Pedidos() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [pedidos, setPedidos]   = useState<Order[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError]       = useState<string | null>(null);

  // El filtro y la selección viven en la URL: el detalle es enlazable y sobrevive
  // a un refresh, igual que `?order=` en la lista vieja.
  const filtro = (filtroPorKey(params.get('f') ?? '')?.key ?? 'todos') as FiltroKey;
  const seleccion = params.get('pedido');
  // ALCANCE por cliente (`?cliente=<id>`), no un carril: se combina con los siete
  // y por eso vive aparte del pill. Es a donde apunta el sol de la fila de un
  // cliente en /admin/clientes-v2 — un punto de atención que no se puede seguir
  // manda al operador a buscar a mano cuál de todos los pedidos era.
  const cliente = params.get('cliente');

  const [detalle, setDetalle] = useState<OrderDetalle | null>(null);
  // El fallo lleva el ID al que pertenece, y eso es lo que permite NO tener que
  // limpiarlo a mano al cambiar de pedido: un error viejo simplemente deja de
  // corresponder. Es el mismo mecanismo con el que Analítica deriva su `loading`
  // (`data?.periodo.key !== periodo`) en vez de setearlo dentro del efecto — un
  // `setState` síncrono ahí dispara renders en cascada y el lint lo marca.
  const [fallo, setFallo] = useState<{ id: string; msg: string } | null>(null);

  // Contador del REFETCH del detalle. Se declara acá arriba porque el efecto que
  // lo usa como dependencia vive más abajo; su porqué está donde se dispara.
  const [refetch, setRefetch] = useState(0);
  const repreguntar = useCallback(() => setRefetch(n => n + 1), []);


  useEffect(() => {
    let vivo = true;
    getOrders()
      .then(d => { if (vivo) { setPedidos(d); setError(null); } })
      .catch(e => { if (vivo) setError(e instanceof Error ? e.message : 'Error al cargar pedidos'); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, []);

  // El ALCANCE se aplica primero y es la base de todo lo demás: la lista, los
  // conteos y el vacío hablan del cliente elegido, no de la tienda entera.
  const alcance  = useMemo(() => filtrarPorCliente(pedidos, cliente), [pedidos, cliente]);
  const visibles = useMemo(() => aplicarFiltro(alcance, filtro), [alcance, filtro]);
  // Los conteos se calculan sobre la lista COMPLETA (dentro del alcance), no sobre
  // la filtrada: el pill tiene que decir cuántos hay en su carril, no cuántos
  // quedan del carril actual. Y sobre el ALCANCE y no sobre `pedidos`, porque un
  // pill que dice 5 y al hacer clic muestra 1 es peor que ninguno.
  const cuentas = useMemo(() => conteos(alcance), [alcance]);

  // El nombre sale del SNAPSHOT del primer pedido del alcance — es lo que la lista
  // ya tiene en mano, sin pedirle nada al servidor. Si el cliente no tiene ningún
  // pedido, no hay nombre que mostrar y el aviso lo dice sin inventarlo.
  const nombreAlcance = alcance[0]?.cliente_nombre ?? null;

  const elegido = useMemo(
    () => visibles.find(p => p.numero_orden === seleccion) ?? null,
    [visibles, seleccion],
  );

  // LA VERDAD DEL DETALLE LA TRAE EL SERVIDOR al abrirse. La lista no carga el
  // libro de transiciones ni los pagos (§ payload), así que el panel los pide —
  // y de paso deja de depender de una copia de la lista que pudo quedar atrás.
  // Depende sólo del id: un cambio en la lista no vuelve a dispararlo.
  const idElegido = elegido?.id ?? null;
  useEffect(() => {
    if (!idElegido) return;
    let vivo = true;
    getOrder(idElegido)
      .then(d => { if (vivo) setDetalle(d); })
      .catch(e => { if (vivo) setFallo({ id: idElegido, msg: e instanceof Error ? e.message : 'Error al cargar el pedido' }); });
    return () => { vivo = false; };
  }, [idElegido, refetch]);

  // Los tres DERIVADOS del par (id elegido, lo que hay cargado). Ninguno es
  // estado: así no hay dos fuentes que puedan discrepar, y el detalle de OTRO
  // pedido nunca se pinta bajo la cabecera del actual mientras viaja el fetch.
  const detalleVigente = detalle?.id === idElegido ? detalle : null;
  const errorDetalle   = fallo?.id === idElegido ? fallo.msg : null;
  const cargandoDetalle = !!idElegido && !detalleVigente && !errorDetalle;

  // ═══ MUTACIONES · viven en LA PÁGINA, no en el panel ═══════════════════════
  //
  // El panel de detalle se desmonta al cambiar de pedido, así que una mutación
  // montada ahí puede perder su continuación — es el incidente del 2026-08-06 con
  // los comprobantes. Acá arriba nada se pierde: el peor caso es que el panel
  // reabra ya con el efecto aplicado.

  // EL REFETCH. La lista EMPALMA (barato e inmediato: la card se actualiza sola) y
  // el detalle REPREGUNTA (la verdad). No es redundancia: el libro de transiciones
  // sólo viaja en `GET /api/orders/[id]`, y las respuestas de los modales traen la
  // orden o el envío actualizados pero NO los asientos nuevos. Sin esto, el
  // Recorrido mostraría todo menos la transición que el operador acaba de
  // provocar — el peor sitio posible para quedar desactualizado, porque es la
  // sección que existe para contar qué pasó.
  const empalmar = useCallback((actualizada: Order) => {
    setPedidos(prev => prev.map(o => o.id === actualizada.id ? actualizada : o));
    repreguntar();
  }, [repreguntar]);

  const errorAccion = useErrorDialogo();

  // Los comprobantes, del hook COMPARTIDO con /admin/ordenes. Cada cambio empalma
  // en la lista y dispara el refetch del panel.
  //
  // `control.refrescar` queda SIN USAR acá a propósito: en esta pantalla el panel
  // ya pide `getOrder`, que trae los comprobantes junto con el libro. Llamarlo
  // sería una segunda consulta por lo mismo.
  const control = useControlComprobantes(
    useCallback((ordenId: string, actualizar: (previos: Comprobante[]) => Comprobante[]) => {
      setPedidos(prev => prev.map(o => o.id === ordenId
        ? { ...o, comprobantes: actualizar(o.comprobantes ?? []) }
        : o));
      repreguntar();
    }, [repreguntar]),
  );

  // Las transiciones, del hook COMPARTIDO con el board y la pantalla vieja —
  // CUARTA montura. `onError` inline y no toast: el operador está mirando el panel.
  const transicion = useTransicionEntrega({
    onUpdated: (sh) => {
      setPedidos(prev => prev.map(o => o.shipping?.id === sh.id ? { ...o, shipping: sh } : o));
      repreguntar();
    },
    onError: (e) => errorAccion.mostrar(e, 'No se pudo actualizar la entrega'),
  });

  const guardaPreparar = useAccionGuardada();
  const [programando, setProgramando]     = useState<{ shipping: Shipping; ordenId: string } | null>(null);
  const [cobrando, setCobrando]           = useState<Order | null>(null);
  const [enVerificacion, setEnVerificacion] = useState<Comprobante | null>(null);
  const [cancelando, setCancelando]       = useState<Order | null>(null);
  const [rechazando, setRechazando]       = useState<{ orden: Order; c: Comprobante } | null>(null);

  // Crea el Shipping si falta (server-guarded e idempotente) y abre el modal. La
  // guarda no protege el dato —el server lo hace— sino al operador: sin ella el
  // botón se queda mudo mientras viaja.
  const abrirProgramar = useCallback((orden: Order) => guardaPreparar.ejecutar(async () => {
    errorAccion.limpiar();
    if (orden.shipping) { setProgramando({ shipping: orden.shipping, ordenId: orden.id }); return; }
    try {
      const creado = await ensureOrderShipping(orden.id);
      empalmar({ ...orden, shipping: creado });
      setProgramando({ shipping: creado, ordenId: orden.id });
    } catch (e) {
      errorAccion.mostrar(e, 'No se pudo preparar la entrega');
    }
  }), [guardaPreparar, errorAccion, empalmar]);

  // Verificar: con la orden pendiente abre Registrar Pago y deja el sello
  // pendiente —la verificación CREA la plata—; con la plata ya adentro, sella
  // directo. El orden NO es reversible (§3.1).
  const verificar = useCallback((orden: Order, c: Comprobante) => {
    control.limpiarError();
    if (accionAlVerificar(orden.estado) === 'cobrar') {
      setEnVerificacion(c);
      setCobrando(orden);
      return;
    }
    control.decidir(orden.id, c.id, 'verificar')
      .catch(e => control.mostrarError(e, 'No se pudo verificar el comprobante'));
  }, [control]);

  const acciones: AccionesPedido = {
    transicion, control, errorAccion,
    preparando: guardaPreparar.enVuelo,
    abrirProgramar, verificar,
    abrirCobrar:   (orden) => setCobrando(orden),
    abrirCancelar: (orden) => setCancelando(orden),
    abrirRechazar: (orden, c) => { control.limpiarError(); setRechazando({ orden, c }); },
  };

  const navegar = useCallback((cambios: Record<string, string | null>) => {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(cambios)) {
      if (v === null) q.delete(k); else q.set(k, v);
    }
    const s = q.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  return (
    // `.duna` es el reset de superficie del sistema (familia, tinta, tamaño base).
    <div className="duna">
      <header style={{ marginBottom: 'var(--duna-space-6)' }}>
        <h1 className="duna-display-m">Pedidos</h1>
        <p className="duna-sub">
          {cargando ? 'Cargando…' : `${alcance.length} ${alcance.length === 1 ? 'pedido' : 'pedidos'}`}
        </p>
      </header>

      {/* ── EL ALCANCE SE VE Y SE QUITA ────────────────────────────────────────
          Una lista recortada que no dice que está recortada es una lista que
          miente: se lee como "la tienda tiene 2 pedidos". Va ARRIBA de los
          carriles porque los alcanza también a ellos —sus conteos ya son de este
          cliente— y en NEUTRO, nunca con `duna-note`: esa primitiva es sol-soft, y
          el sol significa una cosa sola. Un alcance no pide atención, informa. */}
      {cliente && !cargando && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-3)', marginBottom: 'var(--duna-space-4)' }}>
          <span className="duna-tag">
            Pedidos de {nombreAlcance ?? 'un cliente'}
          </span>
          <button
            type="button"
            className="duna-btn duna-btn--ghost duna-btn--sm"
            onClick={() => navegar({ cliente: null })}
          >
            Ver todos
          </button>
        </div>
      )}

      {/* ── Carriles ─────────────────────────────────────────────────────── */}
      <div className="row" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-2)', marginBottom: 'var(--duna-space-5)' }}>
        {FILTROS_PEDIDOS.map(f => (
          <button
            key={f.key}
            type="button"
            className={`duna-pill${filtro === f.key ? ' is-on' : ''}`}
            aria-pressed={filtro === f.key}
            onClick={() => navegar({ f: f.key === 'todos' ? null : f.key })}
          >
            {f.label}
            {/* El conteo va SIEMPRE, incluido el cero: un carril vacío es una
                respuesta ("no hay nada por cobrar"), y esconder el número obliga a
                entrar para averiguarlo. */}
            <span className="duna-mono" style={{ marginLeft: 'var(--duna-space-inline)' }}>{cuentas[f.key]}</span>
          </button>
        ))}
      </div>

      {error && <div className="duna-note" role="alert">{error}</div>}

      {!error && !cargando && visibles.length === 0 && (
        <div className="duna-card duna-card__pad">
          {/* Tres vacíos distintos, y decir cuál es lo que evita que el operador
              crea que perdió algo: la tienda no tiene pedidos · este CLIENTE no
              tiene · este carril no tiene. */}
          <p className="duna-sub" style={{ margin: 0 }}>
            {pedidos.length === 0
              ? 'Todavía no hay pedidos.'
              : alcance.length === 0
                ? 'Este cliente no tiene pedidos.'
                : 'Ningún pedido en este carril.'}
          </p>
        </div>
      )}

      {visibles.length > 0 && (
        <div className="duna-split">
          <div className="duna-split__list">
            {visibles.map(p => {
              const pasos = pasosDelPedido(p);
              return (
                <OrderCard
                  key={p.id}
                  title={p.cliente_nombre}
                  id={p.numero_orden}
                  amount={formatCOP(p.total)}
                  channel={<ChipCanal canal={p.canal} />}
                  status={badgeCobro(p, 'lista')}
                  // `undefined` cuando no hay camino que mostrar (cancelado): la
                  // primitiva lo admite y la ausencia es la respuesta.
                  steps={pasos ? { count: pasos.labels.length, current: pasos.current, done: pasos.done } : undefined}
                  // `?? undefined`: una orden ANTERIOR al libro no tiene última
                  // transición, y su slot queda vacío en vez de mostrar la fecha
                  // de creación, que responde otra pregunta.
                  timeAgo={hace(p.ultimaTransicion?.occurred_at) ?? undefined}
                  selected={p.numero_orden === seleccion}
                  onClick={() => navegar({ pedido: p.numero_orden })}
                />
              );
            })}
          </div>

          <div className="duna-split__panel">
            {!elegido && (
              <div className="duna-card duna-card__pad">
                <p className="duna-sub" style={{ margin: 0 }}>Elige un pedido para ver su detalle.</p>
              </div>
            )}
            {elegido && (
              <Detalle
                orden={elegido}
                detalle={detalleVigente}
                cargando={cargandoDetalle}
                error={errorDetalle}
                acciones={acciones}
              />
            )}
          </div>
        </div>
      )}

      {/* ═══ MODALES · montados en la PÁGINA, no en el panel ══════════════════
          El panel se desmonta al cambiar de pedido; una mutación montada ahí
          puede perder su continuación. Acá arriba, el peor caso es que el panel
          reabra ya con el efecto aplicado.

          Son los MISMOS modales de /admin/ordenes, reusados tal cual: ya están
          probados en producción y reescribirlos con una primitiva nueva dejaría
          dos implementaciones de los mismos flujos conviviendo hasta que la
          pantalla vieja muera. La mezcla visual es temporal y DECLARADA (H6). */}
      <ScheduleDeliveryModal
        target={programando}
        onClose={() => setProgramando(null)}
        onSaved={(sh) => {
          setPedidos(prev => prev.map(o => o.id === programando?.ordenId ? { ...o, shipping: sh } : o));
          repreguntar();
        }}
        onAddressAdded={(ordenId, address) => {
          setPedidos(prev => prev.map(o => o.id === ordenId
            ? { ...o, direccion_entrega: address.direccion_entrega, ciudad_entrega: address.ciudad_entrega }
            : o));
          repreguntar();
        }}
      />
      <RegisterPaymentModal
        target={cobrando ? {
          id: cobrando.id, numero: cobrando.numero_orden,
          cliente: cobrando.cliente_nombre ?? null, monto: cobrando.total,
        } : null}
        declaredMetodo={cobrando?.metodoPagoPrevisto ?? cobrando?.metodo_pago ?? null}
        verificando={enVerificacion}
        onClose={() => { setCobrando(null); setEnVerificacion(null); }}
        onSaved={({ order: actualizada, comprobante }) => {
          // El soporte se sube DESPUÉS del Payment, así que no viene en la
          // respuesta de la orden: se concatena.
          const previos = actualizada.comprobantes ?? [];
          empalmar({ ...actualizada, comprobantes: comprobante ? [...previos, comprobante] : previos });
          // EL ENLACE: entrar por Verificar deja el soporte marcado, y al volver el
          // pago se sella. Va DESPUÉS y por separado — si falla, la orden ya quedó
          // pagada y un segundo click en Verificar lo cierra (ahí ya cae en
          // `sellar`). Al revés se afirmaría un cobro que no ocurrió.
          if (enVerificacion) {
            const id = enVerificacion.id;
            const ordenId = actualizada.id;
            setEnVerificacion(null);
            control.decidir(ordenId, id, 'verificar')
              .catch(e => control.mostrarError(e, 'El pago quedó registrado, pero no se pudo sellar el comprobante. Vuelve a pulsar Verificar.'));
          }
        }}
      />
      <ConfirmDeleteDialog
        open={!!cancelando}
        onOpenChange={(abierto) => { if (!abierto) setCancelando(null); }}
        title={CANCELAR_ORDEN_COPY.title}
        entityLabel={cancelando ? `Orden ${cancelando.numero_orden}${cancelando.cliente_nombre ? ` · ${cancelando.cliente_nombre}` : ''}` : ''}
        consequence={CANCELAR_ORDEN_COPY.consequence}
        confirmLabel={CANCELAR_ORDEN_COPY.confirmLabel}
        busyLabel={CANCELAR_ORDEN_COPY.busyLabel}
        successMessage="Orden cancelada"
        onConfirm={async () => {
          if (!cancelando) return;
          empalmar(await updateOrder(cancelando.id, { estado: 'cancelado' }));
          setCancelando(null);
        }}
      />
      <ConfirmDeleteDialog
        open={!!rechazando}
        onOpenChange={(abierto) => { if (!abierto) setRechazando(null); }}
        title={RECHAZAR_COMPROBANTE_COPY.title}
        entityLabel={rechazando ? nombreArchivo(rechazando.c.url) : ''}
        consequence={RECHAZAR_COMPROBANTE_COPY.consequence}
        confirmLabel={RECHAZAR_COMPROBANTE_COPY.confirmLabel}
        confirmKind="default"
        onConfirm={async () => {
          if (!rechazando) return;
          // LANZA si el servidor rechaza: el diálogo se queda abierto y lo muestra
          // inline, que es su contrato.
          await control.decidir(rechazando.orden.id, rechazando.c.id, 'rechazar');
          setRechazando(null);
        }}
      />
      <ConfirmDespachoSinPago {...transicion.confirmacion} />
    </div>
  );
}

// ─── EL DETALLE ──────────────────────────────────────────────────────────────
//
// Recibe la orden de la LISTA y el detalle del servidor por separado, y no es un
// capricho: la cabecera se pinta de inmediato con lo que la lista ya tiene, y lo
// que exige el viaje (líneas, método real, Recorrido) aparece cuando llega. Así
// abrir un pedido no deja el panel en blanco.
function Detalle({ orden, detalle, cargando, error, acciones }: {
  orden: Order;
  detalle: OrderDetalle | null;
  cargando: boolean;
  error: string | null;
  /** El panel RENDERIZA y llama hacia arriba: no es dueño de ninguna mutación. */
  acciones: AccionesPedido;
}) {
  const badge = badgeCobro(orden, 'detalle');
  const fuente = detalle ?? orden;

  // Sale de `fuente`, no de `orden`: mientras el detalle viaja se calcula con lo
  // que la lista ya trae (que incluye envío y comprobantes, así que los cuatro
  // motivos son evaluables desde el primer render) y se recalcula solo cuando
  // llega la verdad del servidor. Es LA MISMA función que filtra el pill — si esta
  // pantalla tuviera su propia idea de qué pide atención, el operador vería un
  // pedido en el carril "Necesitan atención" y adentro ningún motivo.
  const motivos = motivosDeAtencion(fuente);

  const envio    = fuente.shipping ?? null;
  const enVuelo  = envio ? acciones.transicion.enVuelo(envio.id) : false;
  const falta    = missingToDispatch(envio);
  const soportes = fuente.comprobantes ?? [];
  const lightbox = useLightboxComprobante();

  // El método REAL manda sobre el previsto: el pago que existe gana sobre la
  // intención declarada al crear la orden. Sin pago, se dice que es lo previsto —
  // presentarlo a secas haría creer que ya se cobró.
  const pagoReal = detalle?.payments?.[0];
  const metodo = pagoReal
    ? METODO_PAGO_LABEL[pagoReal.metodo]
    : metodoPrevistoLabel(orden);

  const pasos = detalle ? recorridoDelPedido(detalle) : [];

  const lineas = (fuente.items ?? []).map(i => ({
    label: i.producto_nombre,
    meta: [`× ${i.cantidad}`, i.moliendaSeleccionada].filter(Boolean).join(' · '),
    amount: formatCOP(i.subtotal),
  }));
  // El envío entra como LÍNEA cuando existe. Sin él, la suma de las líneas no da
  // el total y la tabla se contradice sola.
  if (fuente.costo_envio > 0) {
    lineas.push({ label: 'Envío', meta: '', amount: formatCOP(fuente.costo_envio) });
  }

  return (
    <div className="duna-card duna-card__pad">
      {/* ── Cabecera ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-3)' }}>
        <span className="duna-avatar">{iniciales(orden.cliente_nombre)}</span>
        <div style={{ minWidth: 0 }}>
          <div className="duna-title">{orden.cliente_nombre}</div>
          <div className="duna-mono">{orden.numero_orden}</div>
        </div>
        <span className={`duna-badge ${BADGE_TONE_CLASS[badge.tone]}`} style={{ marginLeft: 'auto' }}>
          {badge.tone !== 'neutral' && <span className="duna-badge__dot" />}
          {badge.label}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-3)', marginTop: 'var(--duna-space-3)' }}>
        <ChipCanal canal={orden.canal} />
        {/* DEUDA DECLARADA: DUNA-DS pide "Recoge en tienda" si el pedido es
            pickup. El dominio NO tiene pickup — `TipoEnvio` es LOCAL | NACIONAL y
            las dos son envío. Modelarlo es otra fase con su propia decisión de
            producto (¿cambia el flujo de entrega? ¿el cobro?), así que acá se
            muestra siempre la dirección. */}
        <span className="duna-caption">
          {orden.direccion_entrega
            ? [orden.direccion_entrega, orden.ciudad_entrega].filter(Boolean).join(', ')
            : 'Sin dirección registrada'}
        </span>
      </div>

      <hr className="duna-divider" style={{ margin: 'var(--duna-space-5) 0' }} />

      {error && <div className="duna-note" role="alert">{error}</div>}

      {/* ── POR QUÉ pide atención ────────────────────────────────────────────
          Va PRIMERO, antes de los productos: si el pedido pide algo, es lo que el
          operador vino a resolver. Y va SÓLO acá, no en la card de la lista — la
          lista ya dice QUÉ pedidos piden atención (el pill los filtra) y el
          detalle es donde se ACTÚA. Mantenerlo fuera de la card además no toca
          `order-card`, que es primitiva agnóstica del DS.

          Se muestran TODOS los motivos, no el principal: el caso que originó esto
          fue justamente una orden con dos causas, donde resolver una dejaba la
          otra invisible.

          `.duna-att-item` en su forma NEUTRA (un `<div>`): estos motivos no llevan
          a ningún lado — el operador ya está en el pedido —, y la primitiva dejó de
          prometer click en su clase base. */}
      {motivos.length > 0 && (
        <>
          <div className="duna-eyebrow" style={{ marginBottom: 'var(--duna-space-2)' }}>Necesita tu atención</div>
          <div style={{ marginBottom: 'var(--duna-space-5)' }}>
            {motivos.map((m, i) => (
              <div className="duna-att-item" key={i}>
                <span className="duna-att-item__dot" />
                <div className="duna-att-item__body">
                  <div className="duna-att-item__title">{textoDeMotivo(m)}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Líneas y total ───────────────────────────────────────────────── */}
      <div className="duna-eyebrow" style={{ marginBottom: 'var(--duna-space-2)' }}>Productos</div>
      <ItemsTable rows={lineas} total={{ label: 'Total', amount: formatCOP(fuente.total) }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--duna-space-4)' }}>
        <span className="duna-caption">Método de pago</span>
        <span className="duna-body-sm">
          {metodo ?? 'Por definir'}
          {!pagoReal && metodo && <span className="duna-caption"> · previsto</span>}
        </span>
      </div>

      <hr className="duna-divider" style={{ margin: 'var(--duna-space-5) 0' }} />

      {/* ── ENTREGA · las acciones que el ESTADO permite, ni una más ─────────
          El if/else es sobre `Shipping.estado`, igual que la pantalla vieja — no
          una lista plana de botones que se habilitan. La ÚNICA excepción es
          "Marcar En Ruta" con la programación a medias: se muestra DESHABILITADO
          diciendo qué falta, porque esconderlo mandaría al operador a buscarlo a
          otra pantalla. Es la misma doctrina de los motivos de atención — decir el
          porqué en vez de dejar que lo averigüe. */}
      <div className="duna-eyebrow" style={{ marginBottom: 'var(--duna-space-2)' }}>Entrega</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-2)' }}>
        {orden.estado === 'cancelado' ? null : !envio ? (
          <button type="button" className="duna-btn duna-btn--secondary" disabled={acciones.preparando}
                  onClick={() => acciones.abrirProgramar(fuente)}>
            {acciones.preparando ? 'Preparando…' : 'Preparar envío'}
          </button>
        ) : envio.estado === 'preparando' ? (
          <>
            <button type="button" className="duna-btn duna-btn--secondary" disabled={acciones.preparando}
                    onClick={() => acciones.abrirProgramar(fuente)}>
              {hasScheduleData(envio) ? 'Editar entrega' : 'Programar entrega'}
            </button>
            {isScheduledShipping(envio) ? (
              <button type="button" className="duna-btn duna-btn--secondary" disabled={enVuelo}
                      onClick={() => acciones.transicion.despachar({
                        id: envio.id, numeroOrden: orden.numero_orden, ordenPagada: orden.estado === 'pagado',
                      })}>
                Marcar en ruta
              </button>
            ) : hasScheduleData(envio) && (
              <button type="button" className="duna-btn duna-btn--secondary" disabled
                      title={falta === 'mensajero' ? 'Falta el mensajero' : 'Falta la fecha'}>
                Marcar en ruta · {falta === 'mensajero' ? 'falta mensajero' : 'falta fecha'}
              </button>
            )}
          </>
        ) : envio.estado === 'en_ruta' ? (
          <>
            <button type="button" className="duna-btn duna-btn--secondary" disabled={enVuelo}
                    onClick={() => acciones.transicion.marcarEntregado(envio.id)}>
              Marcar entregado
            </button>
            <button type="button" className="duna-btn duna-btn--ghost" disabled={enVuelo}
                    onClick={() => acciones.transicion.marcarFallido(envio.id)}>
              Marcar fallido
            </button>
          </>
        ) : envio.estado === 'fallido' ? (
          <button type="button" className="duna-btn duna-btn--secondary" disabled={acciones.preparando}
                  onClick={() => acciones.abrirProgramar(fuente)}>
            Reprogramar
          </button>
        ) : null}
      </div>
      <ErrorDialogo mensaje={acciones.errorAccion.mensaje} />

      {/* ── PAGO ─────────────────────────────────────────────────────────── */}
      {orden.estado === 'pendiente' && (
        <div style={{ marginTop: 'var(--duna-space-4)' }}>
          <button type="button" className="duna-btn duna-btn--primary" onClick={() => acciones.abrirCobrar(fuente)}>
            Registrar pago
          </button>
        </div>
      )}

      {/* ── COMPROBANTES · la evidencia, que no es la plata ─────────────────
          La caja VACÍA es una línea: el caso normal de una orden es no tener
          soportes, y el bloque grande ocupaba más que la sección que responde algo. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-3)', marginTop: 'var(--duna-space-4)' }}>
        <span className="duna-caption">Comprobantes ({soportes.length})</span>
        {orden.estado !== 'cancelado' && (
          <SelectorComprobante
            onArchivo={(file) => acciones.control.adjuntar(orden.id, file)}
            disabled={acciones.control.subiendo}
            label={acciones.control.subiendo ? 'Subiendo…' : 'Adjuntar'}
            title={`JPG, PNG, WebP o PDF · máx. ${MAX_COMPROBANTE_MB} MB. Adjuntar no registra el pago.`}
          />
        )}
      </div>
      {soportes.length > 0 && (
        <div style={{ marginTop: 'var(--duna-space-3)', display: 'grid', gap: 'var(--duna-space-3)' }}>
          {soportes.map(c => (
            <ComprobanteVista
              key={c.id}
              comprobante={c}
              onAmpliar={lightbox.ampliar}
              acciones={puedeDecidirse(c.estado) ? (
                <>
                  <button type="button" className="duna-btn duna-btn--secondary duna-btn--sm"
                          disabled={acciones.control.enVuelo(c.id)}
                          onClick={() => acciones.verificar(fuente, c)}>
                    Verificar
                  </button>
                  <button type="button" className="duna-btn duna-btn--ghost duna-btn--sm"
                          disabled={acciones.control.enVuelo(c.id)}
                          onClick={() => acciones.abrirRechazar(fuente, c)}>
                    Rechazar
                  </button>
                </>
              ) : undefined}
            />
          ))}
        </div>
      )}
      {/* El error FUERA de la caja, para que se vea igual con la caja colapsada —
          que es justo cuando falla la primera subida. */}
      <ErrorDialogo mensaje={acciones.control.error} />
      <ImageLightbox src={lightbox.abierto?.src ?? null} alt={lightbox.abierto?.alt} onClose={lightbox.cerrar} />

      {/* ── Cancelar ─────────────────────────────────────────────────────── */}
      {orden.estado !== 'cancelado' && (
        <div style={{ marginTop: 'var(--duna-space-4)' }}>
          <button type="button" className="duna-btn duna-btn--ghost" onClick={() => acciones.abrirCancelar(fuente)}>
            Cancelar orden
          </button>
        </div>
      )}

      <hr className="duna-divider" style={{ margin: 'var(--duna-space-5) 0' }} />

      {/* ── Recorrido ────────────────────────────────────────────────────── */}
      <div className="duna-eyebrow" style={{ marginBottom: 'var(--duna-space-3)' }}>Recorrido del pedido</div>
      {cargando && <p className="duna-sub" style={{ margin: 0 }}>Cargando el recorrido…</p>}
      {!cargando && pasos.length > 0 && (
        <>
          <Timeline entries={pasos.map(p => ({
            title: p.titulo,
            time:  hace(p.cuando),
            actor: p.actor,
            state: p.estado,
          }))} />
          {/* Un recorrido corto porque falta registro no es lo mismo que uno corto
              porque no pasó nada, y el operador no puede distinguirlos si nadie se
              lo dice. */}
          {tieneDerivados(pasos) && (
            <p className="duna-caption" style={{ marginTop: 'var(--duna-space-3)' }}>
              Este pedido es anterior al registro de cambios. Se muestra sólo lo que consta.
            </p>
          )}
        </>
      )}
    </div>
  );
}
