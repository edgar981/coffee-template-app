'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { OrderCard } from '@duna/design-system/components/OrderCard';
import { SearchField } from '@duna/design-system/components/SearchField';
import { SkeletonOrderCards } from '@duna/design-system/components/SkeletonOrderCard';
import { BADGE_TONE_CLASS } from '@duna/design-system/status';
import { formatCOP } from '@duna/core/utils';
import { formatFecha } from '@duna/core/format-fecha';
import { customerWhatsappHref } from '@duna/core/whatsapp-link';
import { toast } from 'sonner';
import { getCustomers, getCustomer, deleteCustomer } from '@/lib/api/customers';
import { ChipCanal } from '@/components/admin/ChipCanal';
import { DunaSheet } from '@/components/admin/DunaSheet';
import { useEsMovil } from '@/hooks/useEsMovil';
import { CustomerFormModal } from '@/components/admin/CustomerFormModal';
import { ConfirmDeleteDialog } from '@/components/admin/ConfirmDeleteDialog';
import { siteConfig } from '@/lib/config/site';
import {
  CARRILES_CLIENTES, aplicarCarril, conteosClientes, carrilPorKey, buscarClientes,
  type CarrilKey,
} from '@/lib/clientes/filtros';
import { badgeCobro, pasosDelPedido } from '@/lib/pedidos/estado';
import { hace } from '@/lib/pedidos/tiempo';
import type { Customer, CustomerWithOrders, CustomerOrderRow } from '@/types/customer';
import type { OrderStatus, CondicionPago } from '@/types/order';

// ═══ CLIENTES · la segunda vertical del rediseño Duna OS ═════════════════════
//
// Se construye SOLO con primitivas de @duna/design-system. Cero valores nuevos:
// ni un color, ni un espaciado, ni un radio inventado acá. Los DOS huecos que
// aparecieron construyéndola se llenaron EN EL SISTEMA, en su commit (la variante
// `<a>` de `duna-btn` y la ranura de id opcional de `order-card`), más el campo de
// búsqueda que entró como primitiva propia.
//
// Que hayan sido dos —y no los cinco de Pedidos— es el resultado que esta vertical
// venía a medir: el patrón se replica barato.
//
// ES LA ÚNICA PANTALLA DE CLIENTES. Vivió en `/admin/clientes-v2` mientras
// convivía con la vieja —el sufijo existía sólo para eso— y heredó la ruta al
// retirarse aquélla. Los enlaces de las dos poblaciones viejas los atiende
// `lib/redirect-clientes`; el porqué de que haga falta está en su cabecera.
//
// EL PERFIL YA NO ES UNA RUTA. La vieja tenía `/admin/clientes/<id>`; acá el
// detalle es el panel del split (`?cliente=`), que en angosto sube como sheet.
// Lo que eso cambia, medido y no supuesto: el enlace sigue siendo compartible y
// sobrevive a un refresh, y no se pierde ni el clic del medio —la fila vieja era
// un `div` con `onClick`, tampoco lo admitía— ni el título de pestaña, que
// tampoco decía el nombre del cliente.
//
// ── LO QUE ESTA PANTALLA NO MUESTRA, Y POR QUÉ ───────────────────────────────
//
// No hay marca de recurrencia en la tarjeta. La INTENCIÓN de recurrencia —un plan
// con su frecuencia y su descuento— no existe en este dominio: no hay modelo,
// `SUBSCRIPTIONS_ENABLED` es `false`, los planes viven en `lib/mock/` y el
// descuento está pendiente de definir con el cliente. Lo único afirmable es el
// derivado "compró más de una vez", que va como CARRIL —donde además FILTRA—,
// nunca como distintivo de la fila. La lista vieja pintaba una ★ a quien tuviera
// más de dos pedidos: un adorno que se lee como categoría de cliente y que nadie
// decidió.
//
// Tampoco hay fila de cifras. Dos de las tres que hubo —cuántos clientes, cuántos
// recurrentes— ya las dicen los carriles, y ahí son ACCIONABLES: el pill filtra, la
// stat sólo se mira. La tercera, "compras recibidas", es cifra de NEGOCIO y no de
// operación: pertenece a Analítica (§ backlog). Con eso esta pantalla queda con la
// misma anatomía que Pedidos —título · buscador · carriles · split—, que es lo que
// hace que el panel se lea como un sistema y no como pantallas parecidas.
//
// Tampoco hay semáforo de recencia. "Compró hace poco" no es un estado, y el verde
// significa confirmado/pagado; teñir una métrica es color decorativo. La recencia
// va como TEXTO en la ranura de tiempo de la tarjeta.

/** Iniciales para el avatar. Una letra si el nombre es de una palabra. */
function iniciales(nombre: string): string {
  return nombre.trim().split(/\s+/).slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase() || '?';
}

/** Lo que la fila pone en la ranura mono: el contacto por el que se le escribe. */
const contactoCorto = (c: Customer): string | undefined => c.telefono ?? c.email ?? undefined;

/** El badge de atención, o nada. NO existe un badge "todo en orden": el estado
 *  normal de un cliente es no pedir nada, y etiquetarlo teñiría la lista entera. */
function badgeAtencion(n: number): { label: string; tone: 'attention' } | undefined {
  if (n <= 0) return undefined;
  return { label: `${n} ${n === 1 ? 'pedido' : 'pedidos'} por atender`, tone: 'attention' };
}

export default function ClientesV2Page() {
  return <Suspense fallback={null}><ClientesV2 /></Suspense>;
}

function ClientesV2() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [clientes, setClientes] = useState<Customer[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError]       = useState<string | null>(null);

  // Debajo del breakpoint el detalle sube como sheet en vez de apilarse. El CSS
  // no puede mover un nodo de sitio, así que la pregunta va en JS.
  const esMovil = useEsMovil();

  // El carril y la selección viven en la URL: el detalle es enlazable y sobrevive
  // a un refresh, igual que `?pedido=` en Pedidos.
  const carril = (carrilPorKey(params.get('f') ?? '')?.key ?? 'todos') as CarrilKey;
  const seleccion = params.get('cliente');

  // LA BÚSQUEDA NO VA A LA URL. Es una consulta en curso, no un estado que valga
  // la pena compartir: un enlace a "clientes filtrados por 'lau'" no le sirve a
  // nadie, y cada tecla dejaría una entrada en el historial del navegador.
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    let vivo = true;
    getCustomers()
      .then(d => { if (vivo) { setClientes(d); setError(null); } })
      .catch(e => { if (vivo) setError(e instanceof Error ? e.message : 'Error al cargar clientes'); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, []);

  // La búsqueda es la BASE y el carril se aplica encima — el mismo orden que el
  // alcance por cliente en Pedidos, y por la misma razón: los conteos de los pills
  // tienen que hablar de lo que hay debajo. Con la búsqueda puesta, "Recurrentes ·
  // 3" dice tres entre los encontrados.
  const encontrados = useMemo(() => buscarClientes(clientes, busqueda), [clientes, busqueda]);
  const visibles    = useMemo(() => aplicarCarril(encontrados, carril), [encontrados, carril]);
  const cuentas     = useMemo(() => conteosClientes(encontrados), [encontrados]);

  // LO ELEGIDO SE BUSCA EN LA LISTA COMPLETA, no en la recortada — mismo cambio
  // y mismo motivo que en Pedidos: un `?cliente=` que caiga fuera del carril o de
  // la búsqueda en curso tiene que abrir igual. Acá muerde incluso más fácil,
  // porque la búsqueda es estado LOCAL: teclear en el buscador con un cliente
  // abierto le vaciaba el panel al operador, sin que la URL cambiara y sin nada
  // que explicara por qué.
  const elegido = useMemo(
    () => clientes.find(c => c.id === seleccion) ?? null,
    [clientes, seleccion],
  );

  // LA VERDAD DEL DETALLE LA TRAE EL SERVIDOR al abrirse. La lista no carga el
  // historial de pedidos, así que el panel lo pide — y de paso deja de depender de
  // una copia de la lista que pudo quedar atrás. Mismo patrón que Pedidos:
  // depende sólo del id, y el fallo lleva el id al que pertenece, así que un error
  // viejo simplemente deja de corresponder al cambiar de cliente.
  const [detalle, setDetalle] = useState<CustomerWithOrders | null>(null);
  const [fallo, setFallo]     = useState<{ id: string; msg: string } | null>(null);

  const idElegido = elegido?.id ?? null;
  useEffect(() => {
    if (!idElegido) return;
    let vivo = true;
    getCustomer(idElegido)
      .then(d => { if (vivo) setDetalle(d); })
      .catch(e => { if (vivo) setFallo({ id: idElegido, msg: e instanceof Error ? e.message : 'Error al cargar el cliente' }); });
    return () => { vivo = false; };
  }, [idElegido]);

  const detalleVigente  = detalle?.id === idElegido ? detalle : null;
  const errorDetalle    = fallo?.id === idElegido ? fallo.msg : null;
  const cargandoDetalle = !!idElegido && !detalleVigente && !errorDetalle;

  // ═══ MUTACIONES · viven en LA PÁGINA, no en el panel ═══════════════════════
  //
  // El panel se desmonta al cambiar de cliente, así que una mutación montada ahí
  // puede perder su continuación (§ el gate del 2026-08-06). Acá arriba el peor
  // caso es que el panel reabra ya con el cambio aplicado.
  //
  // Los diálogos son los shadcn REUSADOS: el design-system no tiene primitiva de
  // diálogo (H6) y construir una acá sería inventar. Mezcla visual temporal y
  // declarada, igual que en Pedidos.
  const [editando, setEditando]   = useState<Customer | null>(null);
  const [creando, setCreando]     = useState(false);
  const [borrando, setBorrando]   = useState<Customer | null>(null);
  const formAbierto = creando || !!editando;

  const guardado = useCallback((c: Customer, modo: 'creado' | 'actualizado') => {
    setClientes(prev => modo === 'creado'
      ? [c, ...prev]
      // El PATCH devuelve la fila cruda, SIN los agregados que calcula el GET de
      // la lista (`ordenes`, `total_compras`, `pedidosPorAtender`, `ultimaOrden`).
      // Se preservan los que ya había: pisarlos con `undefined` dejaría la tarjeta
      // diciendo "$ 0 · 0 pedidos" hasta la próxima carga, que es un dato falso
      // provocado por editar el teléfono.
      : prev.map(p => p.id === c.id
          ? { ...p, ...c, ordenes: p.ordenes, ordenesRef: p.ordenesRef,
              total_compras: p.total_compras, pedidosPorAtender: p.pedidosPorAtender,
              ultimaOrden: p.ultimaOrden }
          : p));
    toast.success(modo === 'creado' ? 'Cliente creado' : 'Cliente actualizado');
  }, []);

  // El detalle se escribe UNA vez: vive en el panel (ancho) o en el sheet
  // (angosto), nunca en los dos. Dos juegos de props del mismo componente es cómo
  // una de las dos superficies se queda sin un dato y nadie lo ve hasta abrirlo
  // en un teléfono.
  const detalleNodo = elegido ? (
    <Detalle
      cliente={elegido}
      detalle={detalleVigente}
      cargando={cargandoDetalle}
      error={errorDetalle}
      onEditar={() => setEditando(elegido)}
      onEliminar={() => setBorrando(elegido)}
    />
  ) : null;

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
      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--duna-space-4)', marginBottom: 'var(--duna-space-5)' }}>
        {/* SIN conteo bajo el título: el pill "Todos" ya lo dice, y ahí además
            FILTRA. Una cifra que repite a un control accionable le quita sitio a
            la respuesta sin agregar una. */}
        <h1 className="duna-display-m" style={{ minWidth: 0 }}>Clientes</h1>
        {/* EL único primario sólido de la vista. Todo lo demás va secundario o
            ghost — ésa es la regla de un solo sólido por pantalla.

            El "+" no es adorno: es lo que hace que el botón se lea como CREAR y
            no como "ir a clientes nuevos". La pantalla vieja lo tenía y esta
            nació sin él. El TAMAÑO lo pone el sistema (`.duna-btn svg`); acá sólo
            se elige el ícono, igual que `ChipCanal` elige el del canal. */}
        <button
          type="button"
          className="duna-btn duna-btn--primary"
          style={{ marginLeft: 'auto', flexShrink: 0 }}
          onClick={() => setCreando(true)}
        >
          <Plus /> Nuevo cliente
        </button>
      </header>

      {/* ── Buscador ─────────────────────────────────────────────────────────
          La primitiva del sistema. Ella pinta el campo; QUÉ significa empatar con
          un cliente —nombre, correo, y teléfono por dígitos— vive en
          `lib/clientes/filtros.ts`, que es donde se puede afirmar en un test. */}
      <div style={{ maxWidth: 'var(--duna-list-w)', marginBottom: 'var(--duna-space-4)' }}>
        <SearchField
          value={busqueda}
          onChange={setBusqueda}
          label="Buscar un cliente"
          placeholder="Nombre, correo o teléfono…"
        />
      </div>

      {/* ── Carriles ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-2)', marginBottom: 'var(--duna-space-5)' }}>
        {CARRILES_CLIENTES.map(c => (
          <button
            key={c.key}
            type="button"
            className={`duna-pill${carril === c.key ? ' is-on' : ''}`}
            aria-pressed={carril === c.key}
            onClick={() => navegar({ f: c.key === 'todos' ? null : c.key })}
          >
            {c.label}
            {/* EL NÚMERO SÓLO EN LAS COLAS (§ lib/carriles). `conteos` ni siquiera
                calcula los acumuladores, así que acá no queda un valor a mano que
                alguien pueda pintar sin querer: la ausencia es del dato, no del
                render.

                El cero SÍ se muestra —un carril de cola vacío es una respuesta:
                "no hay nada por cobrar"— y por eso la condición mira `undefined`
                y no la verdad del número. */}
            {cuentas[c.key] !== undefined && (
              <span className="duna-mono" style={{ marginLeft: 'var(--duna-space-inline)' }}>{cuentas[c.key]}</span>
            )}
          </button>
        ))}
      </div>

      {error && <div className="duna-note" role="alert">{error}</div>}

      {/* LA CARGA OCUPA EL SITIO DE LA LISTA, con su forma — mismo movimiento
          que en Pedidos, y con el mismo esqueleto: la fila de un cliente ES una
          `order-card`, así que el hueco que reserva es el correcto sin
          parametrizar nada. El texto sigue existiendo para el lector de
          pantalla; lo que desaparece es su renglón, que era el que hacía brincar
          la página al ser reemplazado por tarjetas. */}
      {!error && cargando && (
        <div className="duna-split">
          <div className="duna-split__list">
            <SkeletonOrderCards label="Cargando clientes…" />
          </div>
        </div>
      )}

      {!error && !cargando && visibles.length === 0 && (
        <div className="duna-card duna-card__pad">
          {/* Tres vacíos distintos, y decir cuál evita que el operador crea que
              perdió algo: no hay clientes · la búsqueda no encontró · el carril
              está vacío. */}
          <p className="duna-sub" style={{ margin: 0 }}>
            {clientes.length === 0
              ? 'Todavía no hay clientes.'
              : encontrados.length === 0
                ? `Ningún cliente coincide con "${busqueda.trim()}".`
                : 'Ningún cliente en este carril.'}
          </p>
        </div>
      )}

      {/* `|| elegido` — la otra mitad de buscar en la lista completa: sin él, un
          cliente abierto se quedaba sin dónde pintarse en cuanto la búsqueda o el
          carril vaciaban la lista. El vacío de arriba se sigue mostrando, y es lo
          que explica por qué hay un detalle sin lista. */}
      {(visibles.length > 0 || elegido) && (
        <div className="duna-split">
          <div className="duna-split__list">
            {visibles.map(c => (
              <OrderCard
                key={c.id}
                title={c.nombre}
                // `id` OPCIONAL: un cliente sin correo ni teléfono no tiene un
                // segundo identificador, y la ranura se queda sin emitir en vez de
                // dejar un hueco.
                id={contactoCorto(c)}
                amount={formatCOP(c.total_compras ?? 0)}
                channel={<ChipCanal canal={c.canal} />}
                status={badgeAtencion(c.pedidosPorAtender ?? 0)}
                // SIN `steps`, y la ausencia es la respuesta: un cliente no tiene
                // un camino que recorrer. La primitiva lo admite desde Pedidos.
                steps={undefined}
                // La recencia como TEXTO. `?? undefined`: quien nunca compró no
                // tiene última compra, y la ranura se queda vacía en vez de
                // mostrar la fecha de registro, que responde otra pregunta.
                timeAgo={hace(c.ultimaOrden) ?? undefined}
                selected={c.id === seleccion}
                onClick={() => navegar({ cliente: c.id })}
              />
            ))}
          </div>

          {/* EL PANEL, SÓLO EN ANCHO — mismo reparto que Pedidos. Debajo del
              breakpoint el detalle no se oculta: se monta en el sheet de abajo. */}
          {!esMovil && (
            <div className="duna-split__panel">
              {!elegido && (
                <div className="duna-card duna-card__pad">
                  <p className="duna-sub" style={{ margin: 0 }}>Elige un cliente para ver su detalle.</p>
                </div>
              )}
              {detalleNodo}
            </div>
          )}
        </div>
      )}

      {/* EL MISMO DETALLE, EN ANGOSTO. Apilado, el panel se actualizaba fuera de
          la pantalla: tocar una tarjeta no producía respuesta visible. Va FUERA
          del bloque de arriba para que el enlace profundo abra aunque la lista
          visible esté vacía, y el nodo es UNO para que las dos superficies no
          puedan discrepar. El porqué largo está en Pedidos, que es donde este
          patrón se decidió. */}
      <DunaSheet
        abierto={esMovil && !!elegido}
        onCerrar={() => navegar({ cliente: null })}
        titulo={elegido ? elegido.nombre : 'Detalle del cliente'}
        descripcion="Contacto, historial de pedidos y las acciones disponibles."
      >
        {detalleNodo}
      </DunaSheet>

      {/* ═══ DIÁLOGOS · montados en la PÁGINA, no en el panel ═════════════════ */}
      <CustomerFormModal
        open={formAbierto}
        customer={editando}
        onOpenChange={(abierto) => { if (!abierto) { setCreando(false); setEditando(null); } }}
        onSaved={guardado}
      />
      <ConfirmDeleteDialog
        open={!!borrando}
        onOpenChange={(abierto) => { if (!abierto) setBorrando(null); }}
        title="Eliminar cliente"
        entityLabel={borrando
          ? [borrando.nombre, borrando.telefono ?? borrando.email].filter(Boolean).join(' · ')
          : ''}
        consequence="Se eliminará permanentemente. Esta acción no se puede deshacer."
        confirmLabel="Eliminar cliente"
        successMessage="Cliente eliminado"
        onConfirm={async () => {
          if (!borrando) return;
          // LANZA si el servidor rechaza (el 409 de "tiene N pedidos"): el diálogo
          // se queda abierto y muestra el motivo, que es su contrato. La guarda de
          // la UI es una cortesía; el servidor es el que manda.
          await deleteCustomer(borrando.id);
          setClientes(prev => prev.filter(c => c.id !== borrando.id));
          // Se suelta la selección: el panel no puede quedar mostrando a alguien
          // que ya no existe, y el `?cliente=` en la URL sobreviviría a un refresh.
          if (seleccion === borrando.id) navegar({ cliente: null });
          setBorrando(null);
        }}
      />
    </div>
  );
}

// ─── EL DETALLE ──────────────────────────────────────────────────────────────
//
// Recibe el cliente de la LISTA y su historial del servidor por separado, y no es
// un capricho: la cabecera se pinta de inmediato con lo que la lista ya tiene, y
// lo que exige el viaje (los pedidos) aparece cuando llega. Así abrir un cliente
// no deja el panel en blanco.
function Detalle({ cliente, detalle, cargando, error, onEditar, onEliminar }: {
  cliente: Customer;
  detalle: CustomerWithOrders | null;
  cargando: boolean;
  error: string | null;
  /** El panel RENDERIZA y llama hacia arriba: no es dueño de ninguna mutación. */
  onEditar: () => void;
  onEliminar: () => void;
}) {
  const porAtender = cliente.pedidosPorAtender ?? 0;
  const badge = badgeAtencion(porAtender);

  const nombre   = cliente.nombre?.trim();
  const saludo   = nombre ? `Hola ${nombre}` : 'Hola';
  const waHref   = customerWhatsappHref(cliente.telefono, `${saludo}, te escribimos de ${siteConfig.brand.nombre}.`);
  const mailHref = cliente.email ? `mailto:${cliente.email}?subject=${encodeURIComponent(siteConfig.brand.nombre)}` : null;

  const contacto: { label: string; valor?: string | null }[] = [
    { label: 'Correo',    valor: cliente.email },
    { label: 'Teléfono',  valor: cliente.telefono },
    { label: 'Ciudad',    valor: cliente.ciudad },
    { label: 'Dirección', valor: cliente.direccion },
  ];

  const pedidos = detalle?.orders ?? [];

  return (
    <div className="duna-card duna-card__pad">
      {/* ── Cabecera ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-3)' }}>
        <span className="duna-avatar">{iniciales(cliente.nombre)}</span>
        <div style={{ minWidth: 0 }}>
          <div className="duna-title">{cliente.nombre}</div>
          {contactoCorto(cliente) && <div className="duna-mono">{contactoCorto(cliente)}</div>}
        </div>
        {badge && (
          <span className={`duna-badge ${BADGE_TONE_CLASS[badge.tone]}`} style={{ marginLeft: 'auto' }}>
            <span className="duna-badge__dot" />
            {badge.label}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-3)', marginTop: 'var(--duna-space-3)' }}>
        <ChipCanal canal={cliente.canal} />
        <span className="duna-caption">
          {cliente.ultimaOrden ? `Última compra ${formatFecha(cliente.ultimaOrden)}` : 'Sin compras registradas'}
        </span>
      </div>

      <hr className="duna-divider" style={{ margin: 'var(--duna-space-5) 0' }} />

      {error && <div className="duna-note" role="alert">{error}</div>}

      {/* ── POR QUÉ pide atención · Y LLEVA A SUS PEDIDOS ─────────────────────
          Va PRIMERO, antes del contacto: si el cliente pide algo, es lo que el
          operador vino a resolver.

          Es un ENLACE, no un punto mudo. La fila de atención de un cliente no
          termina acá —lo accionable son sus PEDIDOS— y `a.duna-att-item` existe
          justamente para el caso en que la fila SÍ lleva a algún lado. Aterriza
          en el carril de atención de Pedidos con el alcance de este cliente ya
          puesto, así que lo que se ve al llegar es exactamente lo que el sol
          contó. */}
      {porAtender > 0 && (
        <>
          <div className="duna-eyebrow" style={{ marginBottom: 'var(--duna-space-2)' }}>Necesita tu atención</div>
          <div style={{ marginBottom: 'var(--duna-space-5)' }}>
            <Link
              className="duna-att-item"
              href={`/admin/pedidos?f=atencion&cliente=${encodeURIComponent(cliente.id)}`}
            >
              <span className="duna-att-item__dot" />
              <div className="duna-att-item__body">
                <div className="duna-att-item__title">
                  {porAtender === 1
                    ? 'Tiene 1 pedido que necesita atención'
                    : `Tiene ${porAtender} pedidos que necesitan atención`}
                </div>
                {/* El motivo de CADA pedido vive en el detalle de ese pedido, que
                    es donde además se puede actuar. Repetirlos acá sería una
                    segunda redacción de lo mismo, y divergiría. */}
                <div className="duna-att-item__sub">El motivo de cada uno está en su pedido.</div>
              </div>
              <span className="duna-att-item__cta">Ver pedidos →</span>
            </Link>
          </div>
        </>
      )}

      {/* ── Contacto ─────────────────────────────────────────────────────── */}
      <div className="duna-eyebrow" style={{ marginBottom: 'var(--duna-space-2)' }}>Contacto</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--duna-space-3)' }}>
        {contacto.map(({ label, valor }) => (
          <div key={label} style={{ minWidth: 0 }}>
            <div className="duna-caption">{label}</div>
            {/* El guion dice "no tenemos ese dato". Dejarlo en blanco se lee como
                si algo no hubiera cargado. */}
            <div className="duna-body-sm" style={{ color: 'var(--duna-ink)', overflowWrap: 'anywhere' }}>
              {valor || '—'}
            </div>
          </div>
        ))}
      </div>

      {(waHref || mailHref) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-2)', marginTop: 'var(--duna-space-4)' }}>
          {/* `<a>` y no `<button onClick>`: los dos SALEN de la aplicación, así que
              tienen que admitir pestaña nueva, clic del medio y menú contextual. La
              variante `a.duna-btn` del sistema es lo que hace que un enlace se vea
              como botón sin el subrayado del navegador. */}
          {waHref && (
            <a className="duna-btn duna-btn--secondary" href={waHref} target="_blank" rel="noopener noreferrer">
              Escribir por WhatsApp
            </a>
          )}
          {mailHref && (
            <a className="duna-btn duna-btn--ghost" href={mailHref}>Mandar un correo</a>
          )}
        </div>
      )}

      {cliente.notas && (
        <>
          <div className="duna-eyebrow" style={{ margin: 'var(--duna-space-5) 0 var(--duna-space-2)' }}>Notas</div>
          <p className="duna-body-sm" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{cliente.notas}</p>
        </>
      )}

      <hr className="duna-divider" style={{ margin: 'var(--duna-space-5) 0' }} />

      {/* ── Sus cifras ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-2)' }}>
        <div className="duna-stat">
          <div className="duna-stat__v duna-num">{cliente.ordenes ?? 0}</div>
          <div className="duna-stat__l">Pedidos</div>
        </div>
        <div className="duna-stat">
          <div className="duna-stat__v duna-num">{formatCOP(cliente.total_compras ?? 0)}</div>
          {/* "Comprado" y no "Facturado": es la suma de los PAGOS recibidos, plata
              real, no el valor de los pedidos que hizo. */}
          <div className="duna-stat__l">Comprado</div>
        </div>
      </div>

      <hr className="duna-divider" style={{ margin: 'var(--duna-space-5) 0' }} />

      {/* ── Historial ────────────────────────────────────────────────────────
          Los MISMOS `order-card` de la lista de Pedidos, con el MISMO badge de
          cobro y los MISMOS steps. No es economía: darle a un pedido otro aspecto
          acá sería una segunda opinión sobre su estado, y el operador tendría que
          aprender dos lenguajes para el mismo hecho. Acá el número de pedido va de
          TÍTULO —el cliente ya se sabe— y por eso la ranura de id queda vacía. */}
      <div className="duna-eyebrow" style={{ marginBottom: 'var(--duna-space-3)' }}>Historial de pedidos</div>
      {cargando && <p className="duna-sub" style={{ margin: 0 }}>Cargando el historial…</p>}
      {!cargando && !error && pedidos.length === 0 && (
        <p className="duna-sub" style={{ margin: 0 }}>Este cliente no tiene pedidos registrados.</p>
      )}
      {pedidos.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-3)' }}>
          {pedidos.map(p => <FilaPedido key={p.id} pedido={p} />)}
        </div>
      )}

      <hr className="duna-divider" style={{ margin: 'var(--duna-space-5) 0' }} />

      {/* ── Acciones ─────────────────────────────────────────────────────────
          ELIMINAR SÓLO APARECE CUANDO APLICA. Un cliente con pedidos NO se puede
          borrar nunca —sus pedidos son historia financiera y la FK es
          `SetNull`—, así que no es una acción bloqueada temporalmente: es una que
          no existe para él. La lista vieja la muestra deshabilitada con un
          tooltip; acá vale la regla del panel —una acción que no aplica no está,
          porque un botón muerto es una pregunta— y el porqué ya está a la vista
          dos líneas más arriba, en "N pedidos".

          Se gatea con `ordenesRef` (referencias crudas, incluidas las canceladas),
          que es lo MISMO que cuenta la guarda del servidor. Con el conteo visible
          (`ordenes`, que excluye canceladas) el botón aparecería para un cliente
          de sólo-canceladas y el servidor lo rechazaría con un 409. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-2)' }}>
        <button type="button" className="duna-btn duna-btn--secondary" onClick={onEditar}>
          Editar cliente
        </button>
        {(cliente.ordenesRef ?? 0) === 0 && (
          <button type="button" className="duna-btn duna-btn--ghost" onClick={onEliminar}>
            Eliminar
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Un pedido del historial, con el vocabulario de Pedidos.
 *
 * El cast de `estado` vive acá, en la FRONTERA: `CustomerOrderRow.estado` es el
 * String que devuelve el endpoint y `OrderStatus` es la lectura que hace la app.
 * `condicion_pago` puede faltar en un payload viejo; sin ella `badgeCobro` no
 * puede distinguir una contraentrega, y ANTICIPADO es el default de la columna,
 * así que es la suposición que menos afirma.
 */
function FilaPedido({ pedido }: { pedido: CustomerOrderRow }) {
  const orden = {
    estado:         pedido.estado as OrderStatus,
    condicion_pago: (pedido.condicion_pago ?? 'ANTICIPADO') as CondicionPago,
    shipping:       pedido.shipping,
  };
  const pasos = pasosDelPedido(orden);

  return (
    <OrderCard
      title={pedido.numero_orden}
      amount={formatCOP(pedido.total)}
      // 'lista' y no 'detalle': acá el saldo pendiente NO está dicho en ninguna
      // otra parte de la fila, así que "Por cobrar" sí aporta. Es el mismo
      // criterio con que la lista de Pedidos escala y el detalle no.
      status={badgeCobro(orden, 'lista')}
      steps={pasos ? { count: pasos.labels.length, current: pasos.current, done: pasos.done } : undefined}
      timeAgo={hace(pedido.createdAt) ?? undefined}
    />
  );
}
