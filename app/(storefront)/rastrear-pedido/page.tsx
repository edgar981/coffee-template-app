"use client";

import { useState, useEffect } from "react";

import { useSearchParams } from "next/navigation";

import { TrackedOrder } from "@/types/order";

import { getOrderByNumber } from "@/services/order.service";

import { Search, Package, CheckCircle, Truck, Clock, MapPin, Coffee, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import StatusBadge from '@/components/ui/StatusBadge';
import { formatCOP } from '@/lib/utils';

interface TimelineStep {
  estado: string;

  label: string;

  desc: string;

  icon: React.ElementType;
}

const TIMELINE: TimelineStep[] = [
  { estado: 'pendiente', label: 'Pedido recibido', desc: 'Tu orden ha sido registrada en nuestro sistema.', icon: Package },
  { estado: 'confirmado', label: 'Pedido confirmado', desc: 'Hemos confirmado tu pago y preparamos tu café.', icon: CheckCircle },
  { estado: 'preparando', label: 'Preparando', desc: 'Tu pedido está siendo empacado con mucho cariño.', icon: Coffee },
  { estado: 'enviado', label: 'Enviado', desc: 'Tu pedido está en camino. ¡Pronto llegará!', icon: Truck },
  { estado: 'entregado', label: 'Entregado', desc: 'Pedido entregado. ¡Disfruta tu café!', icon: CheckCircle },
];

// Keyed on the exact lowercase-Spanish strings the DB stores in Order.estado.
// `pagado` maps onto the "confirmado" step (payment confirmed). `cancelado` is
// intentionally absent — it is handled separately and must NOT fall through to
// the linear timeline.
const ORDER_IDX: Record<string, number> = { pendiente: 0, confirmado: 1, pagado: 1, preparando: 2, enviado: 3, entregado: 4 };

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

export default function OrderTracking() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('orden') || '');
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(!!(searchParams.get('orden') && searchParams.get('email')));

  const handleSearch = async () => {
    if (!query.trim() || !email.trim()) return;
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
  const currentStep = order ? (ORDER_IDX[order.estado] ?? 0) : 0;

  return (
      <div className="pt-16 min-h-screen">
        {/* Header */}
        <div className="bg-[#1a0f08] py-16 text-center">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-[#d4a97a] text-xs tracking-widest uppercase mb-3">Seguimiento</p>
            <h1 className="text-4xl font-playfair text-white mb-3">Rastrear Pedido</h1>
            <p className="text-white/60 text-sm">Ingresa tu número de orden y el correo de tu compra para ver el estado de tu envío.</p>
          </motion.div>
        </div>

        {/* Search */}
        <div className="max-w-xl mx-auto px-4 -mt-8 relative z-10">
          <div className="bg-white rounded-2xl shadow-lg border border-[#e8ddd0] p-5 space-y-4">
            <div>
              <label htmlFor="track-orden" className="block text-xs font-medium text-[#5a3a28] mb-1.5">Número de orden</label>
              <input
                id="track-orden"
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Ej: CN-000041"
                className="w-full px-4 py-3 bg-[#faf7f4] border border-[#e8ddd0] rounded-xl text-[#1a0f08] text-sm focus:outline-none focus:ring-2 focus:ring-[#8B4513]/20 focus:border-[#8B4513]"
              />
            </div>
            <div>
              <label htmlFor="track-email" className="block text-xs font-medium text-[#5a3a28] mb-1.5">Correo de tu compra</label>
              <input
                id="track-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Ej: correo@ejemplo.com"
                className="w-full px-4 py-3 bg-[#faf7f4] border border-[#e8ddd0] rounded-xl text-[#1a0f08] text-sm focus:outline-none focus:ring-2 focus:ring-[#8B4513]/20 focus:border-[#8B4513]"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#8B4513] hover:bg-[#5a2d0c] text-white font-semibold px-5 py-3 rounded-xl text-sm transition-colors disabled:opacity-60"
            >
              <Search className="w-4 h-4" /> {loading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        </div>

        {/* Result */}
        <div className="max-w-2xl mx-auto px-4 py-12">
          {!searched && (
            <div className="text-center py-8 text-[#a07050]">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Ingresa el número de tu orden y tu correo para comenzar.</p>
            </div>
          )}

          {searched && !loading && !order && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-[#f0e8de] rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-7 h-7 text-[#c0a080]" />
              </div>
              <p className="font-medium text-[#1a0f08] mb-1">Orden no encontrada</p>
              <p className="text-sm text-[#8B6650]">Verifica el número de orden y el correo con el que hiciste tu compra.</p>
            </div>
          )}

          {order && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              {/* Order Header */}
              <div className="bg-white rounded-2xl border border-[#e8ddd0] p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs text-[#8B6650] mb-1">Número de orden</p>
                    <p className="text-2xl font-bold text-[#8B4513]">{order.numero_orden}</p>
                  </div>
                  <StatusBadge status={order.estado} theme="light" />
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-[#8B6650]">Fecha del pedido</p>
                    <p className="font-medium text-[#1a0f08]">{formatDate(order.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#8B6650]">Total</p>
                    <p className="font-bold text-[#1a0f08]">{formatCOP(order.total)}</p>
                  </div>
                  {order.ciudad_entrega && (
                    <div className="col-span-2">
                      <p className="text-xs text-[#8B6650] flex items-center gap-1"><MapPin className="w-3 h-3" /> Destino</p>
                      <p className="font-medium text-[#1a0f08]">{order.ciudad_entrega}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Status: cancelled gets its own rendering; everything else uses the linear timeline. */}
              {isCancelled ? (
                <div className="bg-white rounded-2xl border border-red-200 p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                      <XCircle className="w-4 h-4 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#1a0f08]">Pedido cancelado</p>
                      <p className="text-xs mt-0.5 text-[#8B6650]">Este pedido fue cancelado. Si crees que es un error, contáctanos por WhatsApp y con gusto te ayudamos.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-[#e8ddd0] p-6">
                  <h3 className="font-semibold text-[#1a0f08] mb-6">Estado del pedido</h3>
                  <div className="space-y-0">
                    {TIMELINE.map((step, i) => {
                      const done = i <= currentStep;
                      const active = i === currentStep;
                      const Icon = step.icon;
                      return (
                        <div key={step.estado} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${done ? active ? 'bg-[#8B4513] ring-4 ring-[#8B4513]/20' : 'bg-[#8B4513]' : 'bg-[#f0e8de]'}`}>
                              <Icon className={`w-4 h-4 ${done ? 'text-white' : 'text-[#c0a080]'}`} />
                            </div>
                            {i < TIMELINE.length - 1 && (
                              <div className={`w-0.5 h-10 mt-1 rounded-full transition-all ${i < currentStep ? 'bg-[#8B4513]' : 'bg-[#e8ddd0]'}`} />
                            )}
                          </div>
                          <div className={`pb-6 ${i === TIMELINE.length - 1 ? 'pb-0' : ''}`}>
                            <p className={`text-sm font-semibold ${done ? 'text-[#1a0f08]' : 'text-[#a07050]'}`}>{step.label}</p>
                            <p className={`text-xs mt-0.5 ${done ? 'text-[#5a3a28]' : 'text-[#c0a080]'}`}>{step.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Items */}
              {order.items?.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#e8ddd0] p-6">
                  <h3 className="font-semibold text-[#1a0f08] mb-4">Productos</h3>
                  <div className="space-y-2">
                    {order.items.map((item, i: number) => (
                      <div key={i} className="flex justify-between text-sm py-2 border-b border-[#f0e8de] last:border-0">
                        <span className="text-[#5a3a28]">{item.producto_nombre} × {item.cantidad}</span>
                        <span className="font-medium text-[#1a0f08]">{formatCOP(item.subtotal)}</span>
                      </div>
                    ))}
                    <div className="space-y-2 pt-3 text-sm">
                      <div className="flex justify-between text-[#5a3a28]">
                        <span>Subtotal</span><span>{formatCOP(order.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-[#5a3a28]">
                        <span>Envío</span>
                        <span className={order.costo_envio === 0 ? 'text-emerald-600' : ''}>{order.costo_envio === 0 ? 'Gratis' : formatCOP(order.costo_envio)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-[#f0e8de] font-bold">
                        <span>Total</span>
                        <span className="text-[#8B4513]">{formatCOP(order.total)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
  );
}
