"use client";

import { Suspense, useState, useEffect } from "react";

import { useSearchParams } from "next/navigation";

import { TrackedOrder } from "@/types/order";

import { getOrderByNumber } from "@/services/order.service";

import { Search, Package, CheckCircle, Truck, MapPin, Coffee, XCircle, AlertTriangle, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import StatusBadge from '@/components/ui/StatusBadge';
import { formatCOP } from '@duna/core/utils';
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { useSiteSettings } from '@/components/storefront/SiteSettingsProvider';
import { navOffsetClase } from '@/lib/config/themes';
import { whatsappUrl } from '@/lib/config/site';
import { TENANT_ORDER_PREFIX } from '@duna/core/metrics/order-stat-filters';
import { composicionSeguimiento } from '@/lib/checkout/composiciones-compra';
import { formatFecha } from '@duna/core/format-fecha';

interface TimelineStep {
  estado: string;

  label: string;

  desc: string;

  icon: React.ElementType;
}

// The timeline stitches BOTH models: steps 0–1 come from Order.status (payment),
// steps 2–4 from Shipping.status (fulfillment).
const TIMELINE: TimelineStep[] = [
  { estado: 'recibido',   label: 'Pedido recibido', desc: 'Tu orden ha sido registrada en nuestro sistema.', icon: Package },
  { estado: 'pagado',     label: 'Pago confirmado', desc: 'Hemos confirmado tu pago y preparamos tu café.', icon: CheckCircle },
  { estado: 'preparando', label: 'Preparando', desc: 'Tu pedido está siendo empacado con mucho cariño.', icon: Coffee },
  { estado: 'en_ruta',    label: 'En ruta', desc: 'Tu pedido está en camino. ¡Pronto llegará!', icon: Truck },
  { estado: 'entregado',  label: 'Entregado', desc: 'Pedido entregado. ¡Disfruta tu café!', icon: CheckCircle },
];

// Combine payment (Order.status) and fulfillment (Shipping.status) into a single
// linear index. Cancelado and Fallido are handled separately (non-linear). A
// paid order whose Shipping doesn't exist yet caps at step 1 — no crash.
function computeStep(estado: string, shippingEstado: string | null): number {
  if (estado === 'pendiente') return 0;
  // Paid or beyond → fulfillment phase is driven by the shipping.
  switch (shippingEstado) {
    case 'entregado':  return 4;
    case 'en_ruta':    return 3;
    case 'preparando': return 2;
    default:           return 1; // paid, shipping not created yet
  }
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

// COMPRA-LINEAS-FIDELIDAD-1 — `SeguimientoTimeline` es la línea de tiempo SOLA, extraída de
// `OrderTrackingInner` por la MISMA razón que `CajonPanel` salió de `CartDrawer.tsx`: no depende de
// `useSiteContent`/`useSiteSettings`/`useSearchParams` (recibe `seguimiento` YA resuelto por
// `composicionSeguimiento`, y `fechaPedido` como STRING, no como `order.createdAt` del Context) —
// así que el editor admin (§ `CompraSeccion.tsx`, el preview de «Camino de compra») la puede montar
// con un `currentStep` y una fecha de muestra, sin armar una orden real. Los branches CANCELADO/
// FALLIDO de `OrderTrackingInner` se QUEDAN ahí: son del ESTADO de la orden, no de la composición
// del camino de compra, y el preview sólo necesita "un resultado" (§ el spec), no los cinco.
export interface SeguimientoTimelineProps {
  seguimiento: ReturnType<typeof composicionSeguimiento>;
  currentStep: number;
  /** ISO — `order.createdAt`. Sólo lo usa «Escaleta», en el paso ACTIVO (§ abajo). */
  fechaPedido: string;
}

export function SeguimientoTimeline({ seguimiento, currentStep, fechaPedido }: SeguimientoTimelineProps) {
  const esEscaleta = seguimiento === 'escaleta';
  const esAlbumSeguimiento = seguimiento === 'album';

  if (esEscaleta) {
    // COMPRA-LINEAS-ONIX-CHAMISAS-1 — «Escaleta» (Onix, § refero-compra.md §4): filete
    // vertical FINO (en vez del círculo grueso + barra), estado en MAYÚSCULAS, y la
    // fecha (la única que el seguimiento conoce — `fechaPedido`, nunca una fecha
    // inventada por paso) con cifras TABULARES a la derecha, sólo en el paso ACTIVO.
    return (
      <div className="bg-[var(--sf-tarjeta)] rounded-2xl sf-borde border-[var(--sf-linea)] p-6">
        <h3 className="font-semibold text-[var(--sf-tinta)] mb-6">Estado del pedido</h3>
        <div className="space-y-0">
          {TIMELINE.map((step, i) => {
            const done = i <= currentStep;
            const active = i === currentStep;
            return (
              <div key={step.estado} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={`h-2 w-2 rounded-full shrink-0 ${done ? 'bg-[var(--sf-acento)]' : 'bg-[var(--sf-linea)]'}`} />
                  {i < TIMELINE.length - 1 && (
                    <div className={`w-px flex-1 min-h-10 mt-1 ${i < currentStep ? 'bg-[var(--sf-acento)]' : 'bg-[var(--sf-linea)]'}`} />
                  )}
                </div>
                <div className={`flex items-baseline justify-between gap-3 pb-6 ${i === TIMELINE.length - 1 ? 'pb-0' : ''}`}>
                  <div>
                    <p className={`text-sm font-semibold uppercase tracking-wide ${done ? 'text-[var(--sf-tinta)]' : 'text-[var(--sf-tostado-3)]'}`}>{step.label}</p>
                    <p className={`text-xs mt-0.5 ${done ? 'text-[var(--sf-texto)]' : 'text-[var(--sf-tostado-2)]'}`}>{step.desc}</p>
                  </div>
                  {active && (
                    <span className="shrink-0 text-xs text-[var(--sf-texto-suave)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatFecha(fechaPedido)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (esAlbumSeguimiento) {
    // «Álbum» (Las Chamisas, § refero-compra.md §4): los estados CUMPLIDOS como
    // sticker pegado (relleno, inclinado); los PENDIENTES como casilla punteada vacía.
    return (
      <div className="bg-[var(--sf-tarjeta)] rounded-2xl sf-borde border-[var(--sf-linea)] p-6">
        <h3 className="font-semibold text-[var(--sf-tinta)] mb-6">Estado del pedido</h3>
        <div className="space-y-0">
          {TIMELINE.map((step, i) => {
            const done = i <= currentStep;
            const active = i === currentStep;
            const Icon = step.icon;
            return (
              <div key={step.estado} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={done
                      ? `w-9 h-9 rounded-full flex items-center justify-center shrink-0 -rotate-6 shadow-sm ${active ? 'bg-[var(--sf-acento)] ring-4 ring-[var(--sf-acento)]/20' : 'bg-[var(--sf-acento)]'}`
                      : 'w-9 h-9 rounded-full flex items-center justify-center shrink-0 border-2 border-dashed border-[var(--sf-linea)]'}
                  >
                    <Icon aria-hidden="true" className={`w-4 h-4 ${done ? 'text-[var(--sf-acento-txt)]' : 'text-[var(--sf-tostado-2)]'}`} />
                  </div>
                  {i < TIMELINE.length - 1 && (
                    <div className={`w-0.5 h-10 mt-1 rounded-full transition-all ${i < currentStep ? 'bg-[var(--sf-acento)]' : 'bg-[var(--sf-linea)]'}`} />
                  )}
                </div>
                <div className={`pb-6 ${i === TIMELINE.length - 1 ? 'pb-0' : ''}`}>
                  <p className={`text-sm font-semibold ${done ? 'text-[var(--sf-tinta)]' : 'text-[var(--sf-tostado-3)]'}`}>{step.label}</p>
                  <p className={`text-xs mt-0.5 ${done ? 'text-[var(--sf-texto)]' : 'text-[var(--sf-tostado-2)]'}`}>{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--sf-tarjeta)] rounded-2xl sf-borde border-[var(--sf-linea)] p-6">
      <h3 className="font-semibold text-[var(--sf-tinta)] mb-6">Estado del pedido</h3>
      <div className="space-y-0">
        {TIMELINE.map((step, i) => {
          const done = i <= currentStep;
          const active = i === currentStep;
          const Icon = step.icon;
          return (
            <div key={step.estado} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${done ? active ? 'bg-[var(--sf-acento)] ring-4 ring-[var(--sf-acento)]/20' : 'bg-[var(--sf-acento)]' : 'bg-[var(--sf-superficie)]'}`}>
                  {/* `done` → el ícono va sobre el círculo de acento (que el cliente
                      puede elegir claro): `acento-txt` (auto-flip). Sin done → sobre
                      superficie clara, con tostado-2 (decorativo). */}
                  <Icon aria-hidden="true" className={`w-4 h-4 ${done ? 'text-[var(--sf-acento-txt)]' : 'text-[var(--sf-tostado-2)]'}`} />
                </div>
                {i < TIMELINE.length - 1 && (
                  <div className={`w-0.5 h-10 mt-1 rounded-full transition-all ${i < currentStep ? 'bg-[var(--sf-acento)]' : 'bg-[var(--sf-linea)]'}`} />
                )}
              </div>
              <div className={`pb-6 ${i === TIMELINE.length - 1 ? 'pb-0' : ''}`}>
                <p className={`text-sm font-semibold ${done ? 'text-[var(--sf-tinta)]' : 'text-[var(--sf-tostado-3)]'}`}>{step.label}</p>
                <p className={`text-xs mt-0.5 ${done ? 'text-[var(--sf-texto)]' : 'text-[var(--sf-tostado-2)]'}`}>{step.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// CHECKOUT-LISTO-PARA-VENDER-1 — ejemplo con el prefijo REAL de la tienda, no el de Café
// Nayoli a secas (§ `paginas-pendientes.md` §2.3: "El placeholder «Ej: CN-000041» trae el
// prefijo de Café Nayoli, no el de esta tienda"). `TENANT_ORDER_PREFIX` es la MISMA constante
// que ya usa el resto del repo para distinguir órdenes reales (CLAUDE.md, § "El dinero pagado
// por cliente" — las `SN-` nunca cuentan); es pura y ya se importa en cliente en otros sitios
// (`StatCard`), así que no trae nada server-only.
const EJEMPLO_NUMERO_ORDEN = `${TENANT_ORDER_PREFIX}000041`;

function OrderTrackingInner() {
  const searchParams = useSearchParams();
  // EL RELLENO SUPERIOR (§ NAV-INTERNAS-CLARO-Y-OFFSET-1) — ver el docstring de `navOffsetClase`
  // (`lib/config/themes.ts`). `false` (todo tenant salvo CORTE) = `pt-16`, byte a byte.
  const { navTratamiento, compra } = useSiteContent();
  const offsetClase = navOffsetClase(navTratamiento.posicion);
  const settings = useSiteSettings();
  const tieneWhatsapp = settings.whatsapp.trim() !== '';

  // COMPRA-LINEAS-ONIX-CHAMISAS-1 — el seguimiento gana una composición ELEGIBLE por tienda.
  // `'comun'` (AUSENTE, el default) rinde EXACTAMENTE la línea de tiempo de siempre, byte-idéntico.
  // COMPRA-LINEAS-FIDELIDAD-1 — el `if esEscaleta`/`esAlbumSeguimiento` que decidía el branch ahora
  // vive DENTRO de `SeguimientoTimeline` (§ arriba); acá sólo hace falta `seguimiento`, para pasarlo.
  const seguimiento = composicionSeguimiento(compra.seguimiento);

  const [query, setQuery] = useState(searchParams.get('orden') || '');
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(!!(searchParams.get('orden') && searchParams.get('email')));
  // CHECKOUT-LISTO-PARA-VENDER-1 — «"Buscar" vacío dice qué falta» (§ el spec, §
  // `paginas-pendientes.md` §2.3: antes `if (!query.trim() || !email.trim()) return;` no
  // decía nada — el botón se quedaba mudo). El botón sigue SIEMPRE activo.
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);
  const [tocados, setTocados] = useState<{ orden: boolean; email: boolean }>({ orden: false, email: false });

  const faltaOrden = query.trim() === '';
  const faltaEmail = email.trim() === '';

  const handleSearch = async () => {
    if (faltaOrden || faltaEmail) {
      setTocados({ orden: true, email: true });
      setErrorBusqueda(
        faltaOrden && faltaEmail
          ? 'Ingresa tu número de orden y tu correo.'
          : faltaOrden
            ? 'Ingresa tu número de orden.'
            : 'Ingresa el correo de tu compra.',
      );
      return;
    }
    setErrorBusqueda(null);
    setLoading(true);
    setSearched(true);
    try {
      const result = await getOrderByNumber(query.trim(), email.trim());
      setOrder(result);
    } catch (e) {
      setOrder(null);
      toast.error(e instanceof Error ? e.message : 'No se pudo consultar el pedido');
    }
    setLoading(false);
  };

  // One-click tracking from the confirmation screen: when both the order number
  // and email arrive as query params, run the lookup automatically on mount.
  useEffect(() => {
    const orden = searchParams.get('orden');
    const mail = searchParams.get('email');
    if (orden && mail) handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isCancelled = order?.estado === 'cancelado' || order?.estado === 'cancelled';
  const isFailed = order?.shipping_estado === 'fallido';
  const currentStep = order ? computeStep(order.estado, order.shipping_estado) : 0;
  // Badge shows the most advanced meaningful state: cancellation, else the
  // fulfillment state once it exists, else the payment state.
  const displayEstado = order
    ? (isCancelled ? 'cancelado' : (order.shipping_estado ?? order.estado))
    : '';

  return (
      <div className={`${offsetClase} min-h-screen bg-[var(--sf-fondo)]`}>
        {/* CHECKOUT-LISTO-PARA-VENDER-1 — «formulario DENTRO de la página, SIN tarjeta
            flotante» (§ el spec del slice, § refero-compra.md §3, referencia West Elm "Track
            your order": "formulario plano dentro de la página, sin tarjeta flotante"). Antes
            era una banda oscura de 16 de alto + una tarjeta blanca con sombra montada encima
            con margen negativo (`-mt-8`), que además dejaba el subtítulo tocando los bordes
            en celular (`paginas-pendientes.md` §2.3) — ese defecto desaparece con la banda. */}
        <div className="max-w-xl mx-auto px-4 py-12">
          <div className="mb-8">
            <p className="text-[var(--sf-acento-texto)] text-xs tracking-widest uppercase mb-2">Seguimiento</p>
            <h1 className="text-3xl font-playfair text-[var(--sf-tinta)] mb-2">Rastrear Pedido</h1>
            <p className="text-[var(--sf-texto-suave)] text-sm">Ingresa tu número de orden y el correo de tu compra para ver el estado de tu envío.</p>
          </div>

          <div className="space-y-4">
            {errorBusqueda && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {errorBusqueda}
              </div>
            )}
            <div>
              <label htmlFor="track-orden" className="block text-xs font-medium text-[var(--sf-texto)] mb-1.5">Número de orden</label>
              <input
                id="track-orden"
                name="track-orden"
                type="text"
                autoComplete="off"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onBlur={() => setTocados(t => ({ ...t, orden: true }))}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder={`Ej: ${EJEMPLO_NUMERO_ORDEN}`}
                aria-invalid={tocados.orden && faltaOrden ? true : undefined}
                className={`w-full h-12 px-4 bg-[var(--sf-superficie)] sf-borde ${tocados.orden && faltaOrden ? 'border-red-400' : 'border-[var(--sf-linea)]'} rounded-xl text-[var(--sf-tinta)] text-base focus:outline-none focus:ring-2 focus:ring-[var(--sf-tinta)]/20 focus:border-[var(--sf-tinta)]`}
              />
              {tocados.orden && faltaOrden && (
                <p className="mt-1 text-xs text-red-600">Ingresa tu número de orden.</p>
              )}
            </div>
            <div>
              <label htmlFor="track-email" className="block text-xs font-medium text-[var(--sf-texto)] mb-1.5">Correo de tu compra</label>
              <input
                id="track-email"
                name="track-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onBlur={() => setTocados(t => ({ ...t, email: true }))}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Ej: correo@ejemplo.com"
                aria-invalid={tocados.email && faltaEmail ? true : undefined}
                className={`w-full h-12 px-4 bg-[var(--sf-superficie)] sf-borde ${tocados.email && faltaEmail ? 'border-red-400' : 'border-[var(--sf-linea)]'} rounded-xl text-[var(--sf-tinta)] text-base focus:outline-none focus:ring-2 focus:ring-[var(--sf-tinta)]/20 focus:border-[var(--sf-tinta)]`}
              />
              {tocados.email && faltaEmail && (
                <p className="mt-1 text-xs text-red-600">Ingresa el correo de tu compra.</p>
              )}
            </div>
            <button
              onClick={handleSearch}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[var(--sf-acento)] hover:bg-[var(--sf-accion-hover,var(--sf-tostado-4))] active:bg-[var(--sf-accion-active,var(--sf-tostado-3))] text-[var(--sf-acento-txt)] font-semibold px-5 py-3 rounded-xl text-sm transition-colors disabled:opacity-60"
            >
              <Search className="w-4 h-4" /> {loading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>

          {/* Result */}
          <div className="pt-10">
          {/* RASTREAR-PEDIDO-ESTADOS-SIN-TRANSICION-1: los tres estados de resultado —sin buscar,
              sin resultado, con orden— entran/salen con AnimatePresence + motion.div (fade +
              desplazamiento vertical), en vez de `{cond && (<div>…)}` planos que cambiaban de
              golpe. */}
          <AnimatePresence mode="wait">
          {!searched && (
            <motion.div key="sin-buscar" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="text-center py-8 text-[var(--sf-tostado-3)]">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Ingresa el número de tu orden y tu correo para comenzar.</p>
            </motion.div>
          )}

          {searched && !loading && !order && (
            <motion.div key="sin-resultado" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="text-left py-8">
              {/* § COMPRA-FIDELIDAD-3 — fidelidad contra `.scratch/lanzamiento/maqueta-compra/
                  compra.html` (`pageRastrear`, bloque `.nf`): el aviso NOMBRA lo que se buscó
                  («No encontramos el pedido {num} con ese correo»), lleva `role="alert"` y TRES
                  tips concretos en vez de una frase sola — antes decía "Orden no encontrada" sin
                  repetir el dato, sin `role="alert"`, y con un solo consejo genérico. Lo escrito
                  (`query`/`email`) sigue CONSERVADO — ningún campo se limpia al fallar. */}
              <div role="alert" className="flex items-start gap-3 rounded-xl bg-[var(--sf-superficie)] p-4">
                <AlertTriangle aria-hidden="true" className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
                <p className="text-sm text-[var(--sf-sobre-superficie,var(--sf-texto))]">
                  <span className="font-semibold text-[var(--sf-sobre-superficie,var(--sf-tinta))]">
                    No encontramos el pedido {query.trim() || '—'} con ese correo.
                  </span>{' '}
                  Conservamos lo que escribiste para que lo corrijas.
                </p>
              </div>
              <ul className="mt-4 space-y-1.5 pl-5 text-sm text-[var(--sf-texto-suave)] list-disc">
                <li>El número está en el correo de confirmación. Su asunto es «Tu pedido {TENANT_ORDER_PREFIX}…».</li>
                <li>Usa el correo con el que compraste, no otro.</li>
                <li>Si pagaste hace unos minutos, espera un momento y busca otra vez.</li>
              </ul>
              {tieneWhatsapp && (
                <a
                  href={whatsappUrl(settings.whatsapp, `Hola, no encuentro mi pedido ${query.trim() ? `(${query.trim()})` : ''}.`)}
                  target="_blank" rel="noopener"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--sf-tinta)] underline hover:no-underline"
                >
                  <MessageCircle className="w-4 h-4" /> Escríbenos por WhatsApp
                </a>
              )}
            </motion.div>
          )}

          {order && (
            <motion.div key="con-resultado" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.2 }} className="space-y-6">
              {/* Order Header */}
              <div className="bg-[var(--sf-tarjeta)] rounded-2xl sf-borde border-[var(--sf-linea)] p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs text-[var(--sf-texto-suave)] mb-1">Número de orden</p>
                    <p className="text-2xl font-bold text-[var(--sf-acento-texto)]">{order.numero_orden}</p>
                  </div>
                  <StatusBadge status={displayEstado} theme="light" />
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-[var(--sf-texto-suave)]">Fecha del pedido</p>
                    <p className="font-medium text-[var(--sf-tinta)]">{formatDate(order.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--sf-texto-suave)]">Total</p>
                    <p className="font-bold text-[var(--sf-tinta)]">{formatCOP(order.total)}</p>
                  </div>
                  {order.ciudad_entrega && (
                    <div className="col-span-2">
                      <p className="text-xs text-[var(--sf-texto-suave)] flex items-center gap-1"><MapPin className="w-3 h-3" /> Destino</p>
                      <p className="font-medium text-[var(--sf-tinta)]">{order.ciudad_entrega}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Cancelled (payment) and failed delivery (fulfillment) get their own
                  rendering; everything else uses the combined linear timeline. */}
              {isCancelled ? (
                <div className="bg-[var(--sf-tarjeta)] rounded-2xl border border-red-200 p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                      <XCircle className="w-4 h-4 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--sf-tinta)]">Pedido cancelado</p>
                      <p className="text-xs mt-0.5 text-[var(--sf-texto-suave)]">Este pedido fue cancelado. Si crees que es un error, contáctanos por WhatsApp y con gusto te ayudamos.</p>
                    </div>
                  </div>
                </div>
              ) : isFailed ? (
                <div className="bg-[var(--sf-tarjeta)] rounded-2xl border border-amber-200 p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--sf-tinta)]">Entrega fallida</p>
                      <p className="text-xs mt-0.5 text-[var(--sf-texto-suave)]">No pudimos completar la entrega. Nuestro equipo se pondrá en contacto contigo por WhatsApp para reprogramarla.</p>
                    </div>
                  </div>
                </div>
              ) : (
                // COMPRA-LINEAS-FIDELIDAD-1 — la línea de tiempo vive en `SeguimientoTimeline`
                // (§ arriba), compartida con el preview del editor admin.
                <SeguimientoTimeline seguimiento={seguimiento} currentStep={currentStep} fechaPedido={order.createdAt} />
              )}

              {/* Items */}
              {order.items?.length > 0 && (
                <div className="bg-[var(--sf-tarjeta)] rounded-2xl sf-borde border-[var(--sf-linea)] p-6">
                  <h3 className="font-semibold text-[var(--sf-tinta)] mb-4">Productos</h3>
                  <div className="space-y-2">
                    {order.items.map((item, i: number) => (
                      <div key={i} className="flex justify-between text-sm py-2 sf-divisor-b border-[var(--sf-superficie)] last:border-0">
                        <span className="text-[var(--sf-texto)]">{item.producto_nombre} × {item.cantidad}</span>
                        <span className="font-medium text-[var(--sf-tinta)]">{formatCOP(item.subtotal)}</span>
                      </div>
                    ))}
                    <div className="space-y-2 pt-3 text-sm">
                      <div className="flex justify-between text-[var(--sf-texto)]">
                        <span>Subtotal</span><span>{formatCOP(order.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-[var(--sf-texto)]">
                        <span>Envío</span>
                        <span className={order.costo_envio === 0 ? 'text-emerald-600' : ''}>{order.costo_envio === 0 ? 'Gratis' : formatCOP(order.costo_envio)}</span>
                      </div>
                      <div className="flex justify-between pt-2 sf-divisor-t border-[var(--sf-superficie)] font-bold">
                        <span>Total</span>
                        <span className="text-[var(--sf-acento-texto)]">{formatCOP(order.total)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* CHECKOUT-LISTO-PARA-VENDER-1 — WhatsApp SIEMPRE disponible junto al resultado,
                  también cuando SÍ se encontró la orden (§ el spec: "guía… WhatsApp"). */}
              {tieneWhatsapp && (
                <a
                  href={whatsappUrl(settings.whatsapp, `Hola, quiero consultar mi pedido ${order.numero_orden}`)}
                  target="_blank" rel="noopener"
                  className="flex items-center justify-center gap-1.5 py-1 text-sm text-[var(--sf-texto-suave)] hover:text-[var(--sf-texto)] transition-colors"
                >
                  <MessageCircle className="w-4 h-4" /> Escríbenos por WhatsApp
                </a>
              )}
            </motion.div>
          )}
          </AnimatePresence>
          </div>
        </div>
      </div>
  );
}

// useSearchParams() (order number + email from the URL) requires a Suspense
// boundary to prerender — Next.js CSR bailout.
export default function OrderTracking() {
  // El fallback de Suspense se renderiza ANTES de que `OrderTrackingInner` monte, así que necesita
  // su propio `navOffsetClase` (§ NAV-INTERNAS-CLARO-Y-OFFSET-1).
  const { navTratamiento } = useSiteContent();
  return (
    <Suspense fallback={<div className={`${navOffsetClase(navTratamiento.posicion)} min-h-screen`} />}>
      <OrderTrackingInner />
    </Suspense>
  );
}
