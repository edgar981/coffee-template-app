'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { MessageCircle, Camera, Store, Users } from 'lucide-react';
import { OrderCard } from '@duna/design-system/components/OrderCard';
import { ItemsTable } from '@duna/design-system/components/ItemsTable';
import { Timeline } from '@duna/design-system/components/Timeline';
import { BADGE_TONE_CLASS } from '@duna/design-system/status';
import { getOrders, getOrder } from '@/lib/api/orders';
import { formatCOP } from '@duna/core/utils';
import { METODO_PAGO_LABEL, metodoPrevistoLabel } from '@/types/payment';
import type { Order, OrderDetalle, OrderChannel } from '@/types/order';
import { CANALES } from '@/constants/customer';
import { FILTROS_PEDIDOS, aplicarFiltro, conteos, filtroPorKey, type FiltroKey } from '@/lib/pedidos/filtros';
import { pasosDelPedido, badgeCobro } from '@/lib/pedidos/estado';
import { motivosDeAtencion, textoDeMotivo } from '@/lib/pedidos/atencion';
import { recorridoDelPedido, tieneDerivados } from '@/lib/pedidos/recorrido';
import { hace } from '@/lib/pedidos/tiempo';

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
// ALCANCE DE ESTA TANDA: lista + detalle de LECTURA. Los botones de acción según
// el estado son la tanda siguiente; el gate visual acordado no los cubre.

// El DS no conoce canales — recibe un nodo, y el dominio vive acá.
//
// Las ETIQUETAS se consumen de `CANALES`, no se re-teclean: es la misma lista que
// usa Clientes, y dos mapas del mismo dominio divergen en cuanto alguien renombra
// uno. Acá sólo se declara lo que no existía: el ícono de cada canal.
//
// Instagram va con `Camera` y no con su logo: lucide 1.x retiró los íconos de
// marca. Un SVG propio sería exactamente el valor inventado que esta pantalla no
// puede tener, y además el chip es contexto, no branding.
const ICONO_CANAL: Record<OrderChannel, typeof Store> = {
  whatsapp:  MessageCircle,
  instagram: Camera,
  directo:   Store,
  referido:  Users,
};

function ChipCanal({ canal }: { canal: OrderChannel }) {
  // `?? directo` por si llega un canal fuera del union (el payload lo trae como
  // string): un chip sin ícono rompería la fila; el default no afirma nada falso
  // que el label no diga ya.
  const Icono = ICONO_CANAL[canal] ?? Store;
  return <span className="duna-chip-channel"><Icono />{CANALES[canal] ?? canal}</span>;
}

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

  const [detalle, setDetalle] = useState<OrderDetalle | null>(null);
  // El fallo lleva el ID al que pertenece, y eso es lo que permite NO tener que
  // limpiarlo a mano al cambiar de pedido: un error viejo simplemente deja de
  // corresponder. Es el mismo mecanismo con el que Analítica deriva su `loading`
  // (`data?.periodo.key !== periodo`) en vez de setearlo dentro del efecto — un
  // `setState` síncrono ahí dispara renders en cascada y el lint lo marca.
  const [fallo, setFallo] = useState<{ id: string; msg: string } | null>(null);

  useEffect(() => {
    let vivo = true;
    getOrders()
      .then(d => { if (vivo) { setPedidos(d); setError(null); } })
      .catch(e => { if (vivo) setError(e instanceof Error ? e.message : 'Error al cargar pedidos'); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, []);

  const visibles = useMemo(() => aplicarFiltro(pedidos, filtro), [pedidos, filtro]);
  // Los conteos se calculan sobre la lista COMPLETA, no sobre la filtrada: el pill
  // tiene que decir cuántos hay en su carril, no cuántos quedan del carril actual.
  const cuentas = useMemo(() => conteos(pedidos), [pedidos]);

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
  }, [idElegido]);

  // Los tres DERIVADOS del par (id elegido, lo que hay cargado). Ninguno es
  // estado: así no hay dos fuentes que puedan discrepar, y el detalle de OTRO
  // pedido nunca se pinta bajo la cabecera del actual mientras viaja el fetch.
  const detalleVigente = detalle?.id === idElegido ? detalle : null;
  const errorDetalle   = fallo?.id === idElegido ? fallo.msg : null;
  const cargandoDetalle = !!idElegido && !detalleVigente && !errorDetalle;

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
          {cargando ? 'Cargando…' : `${pedidos.length} ${pedidos.length === 1 ? 'pedido' : 'pedidos'}`}
        </p>
      </header>

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
          <p className="duna-sub" style={{ margin: 0 }}>
            {pedidos.length === 0 ? 'Todavía no hay pedidos.' : 'Ningún pedido en este carril.'}
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
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EL DETALLE ──────────────────────────────────────────────────────────────
//
// Recibe la orden de la LISTA y el detalle del servidor por separado, y no es un
// capricho: la cabecera se pinta de inmediato con lo que la lista ya tiene, y lo
// que exige el viaje (líneas, método real, Recorrido) aparece cuando llega. Así
// abrir un pedido no deja el panel en blanco.
function Detalle({ orden, detalle, cargando, error }: {
  orden: Order;
  detalle: OrderDetalle | null;
  cargando: boolean;
  error: string | null;
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
