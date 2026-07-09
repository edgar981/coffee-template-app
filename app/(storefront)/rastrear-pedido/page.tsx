"use client";

import { useState } from "react";

import { useSearchParams } from "next/navigation";

import { Order } from "@/types/order";

import { getOrderByNumber } from "@/services/order.service";

import { Search, Package, CheckCircle, Truck, Clock, MapPin, Coffee } from 'lucide-react';
import { motion } from 'framer-motion';
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

const ORDER_IDX: Record<string, number> = { pendiente: 0, confirmado: 1, pagado: 1, preparando: 2, enviado: 3, entregado: 4 };

export default function OrderTracking() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('orden') || '');
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(!!searchParams.get('orden'));

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    const results = await getOrderByNumber(query.trim());
    setOrder(results);
    setLoading(false);
  };

  const currentStep = order ? (ORDER_IDX[order.estado] ?? 0) : 0;

  return (
      <div className="pt-16 min-h-screen">
        {/* Header */}
        <div className="bg-[#1a0f08] py-16 text-center">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-[#d4a97a] text-xs tracking-widest uppercase mb-3">Seguimiento</p>
            <h1 className="text-4xl font-playfair text-white mb-3">Rastrear Pedido</h1>
            <p className="text-white/60 text-sm">Ingresa tu número de orden para ver el estado de tu envío.</p>
          </motion.div>
        </div>

        {/* Search */}
        <div className="max-w-xl mx-auto px-4 -mt-8 relative z-10">
          <div className="bg-white rounded-2xl shadow-lg border border-[#e8ddd0] p-2 flex gap-2">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Ej: SN-0041"
              className="flex-1 px-4 py-3 text-[#1a0f08] text-sm focus:outline-none bg-transparent"
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="flex items-center gap-2 bg-[#8B4513] hover:bg-[#5a2d0c] text-white font-semibold px-5 py-3 rounded-xl text-sm transition-colors shrink-0"
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
              <p className="text-sm">Ingresa el número de tu orden para comenzar.</p>
            </div>
          )}

          {searched && !loading && !order && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-[#f0e8de] rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-7 h-7 text-[#c0a080]" />
              </div>
              <p className="font-medium text-[#1a0f08] mb-1">Orden no encontrada</p>
              <p className="text-sm text-[#8B6650]">Verifica el número de orden en tu correo o WhatsApp.</p>
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
                    <p className="text-xs text-[#8B6650]">Cliente</p>
                    <p className="font-medium text-[#1a0f08]">{order.cliente_nombre}</p>
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

              {/* Timeline */}
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

              {/* Items if available */}
              {order.items?.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#e8ddd0] p-6">
                  <h3 className="font-semibold text-[#1a0f08] mb-4">Productos</h3>
                  <div className="space-y-2">
                    {order.items?.map((item, i: number) => (
                      <div key={i} className="flex justify-between text-sm py-2 border-b border-[#f0e8de] last:border-0">
                        <span className="text-[#5a3a28]">{item.producto_nombre} × {item.cantidad}</span>
                        <span className="font-medium text-[#1a0f08]">{formatCOP(item.subtotal)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm pt-2 font-bold">
                      <span>Total</span>
                      <span className="text-[#8B4513]">{formatCOP(order.total)}</span>
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