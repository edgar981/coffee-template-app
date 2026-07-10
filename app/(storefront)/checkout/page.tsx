"use client";
import { useState } from 'react';
import Link from "next/link";
import { ArrowLeft, Shield, Lock, CreditCard, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCartStore } from '@/lib/cartStore';
import { createOrder, type CheckoutResult } from "@/services/checkout.service";
import { formatCOP } from '@/lib/utils';
import { toast } from 'sonner';
import StatusBadge from '@/components/ui/StatusBadge';
import {
  computeShippingCost,
  getShippingMethod,
  findSlotLabel,
  type ShippingMethodId,
} from '@/lib/shipping-config';
import { COLOMBIA_DEPARTMENTS, isBogotaDC } from '@/lib/colombia-departments';

const STEPS = ['Información', 'Pago'];

export default function Checkout() {
  const { items, subtotal, clearCart } = useCartStore();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  // Authoritative, server-persisted order — sourced entirely from the
  // create-order response, never from the (soon-to-be-cleared) cart store.
  const [confirmation, setConfirmation] = useState<CheckoutResult | null>(null);

  const [info, setInfo] = useState({ nombre: '', apellido: '', email: '', telefono: '' });
  const [address, setAddress] = useState({ linea1: '', detalle: '', ciudad: '', departamento: '', cp: '' });
  const [slot, setSlot] = useState<string | null>(null);
  const [payment, setPayment] = useState('nequi');
  const [refTransfer, setRefTransfer] = useState('');

  // Bogotá-ness is derived from departamento — the single source of truth.
  const isBogota = isBogotaDC(address.departamento);
  const metodoEnvio: ShippingMethodId | null = address.departamento
    ? (isBogota ? 'bogota' : 'nacional')
    : null;
  const shippingMethod = metodoEnvio ? getShippingMethod(metodoEnvio) : null;
  // null shipping = departamento not chosen yet → summary shows a placeholder.
  const shippingCost = metodoEnvio ? computeShippingCost(metodoEnvio, subtotal) : null;
  const total = subtotal + (shippingCost ?? 0);

  // Phone: fixed +57 prefix, capture local digits, store normalized +57XXXXXXXXXX.
  const phoneDigits = info.telefono.replace(/\D/g, '');
  const phoneValid = /^3\d{9}$/.test(phoneDigits);

  const paymentOptions = [
    { id: 'nequi', label: 'Nequi', desc: 'Enviar a 300 123 4567' },
    { id: 'daviplata', label: 'Daviplata', desc: 'Enviar a 300 123 4567' },
    { id: 'transferencia', label: 'Transferencia Bancaria', desc: 'Bancolombia · Cta Ahorro · 123-456789-00' },
    { id: 'efectivo', label: 'Contra entrega', desc: 'Solo disponible en Bogotá D.C.' },
  ];

  // "Contra entrega" (efectivo) is only valid for Bogotá D.C. deliveries — hide
  // it otherwise. Server enforces the same rule off departamento; this is UX only.
  const availablePayments = paymentOptions.filter(
    (o) => o.id !== 'efectivo' || isBogota,
  );

  // Changing departamento re-derives the method; leaving Bogotá clears the franja
  // AND resets a contra-entrega choice so no invalid combo reaches the Pago step.
  const selectDepartamento = (value: string) => {
    setAddress((a) => ({ ...a, departamento: value }));
    if (!isBogotaDC(value)) {
      setSlot(null);
      if (payment === 'efectivo') setPayment('nequi');
    }
  };

  const handleOrder = async () => {
    setLoading(true);
    try {
      // Trust only slugs + quantities and customer/shipping details. The server
      // recomputes every price, the shipping cost, the total and the order
      // number, and returns the authoritative order number to display.
      const result = await createOrder({
        customer: {
          nombre:   info.nombre,
          apellido: info.apellido,
          email:    info.email,
          telefono: `+57${phoneDigits}`,   // normalized, WhatsApp-ready
        },
        shipping: {
          direccion:         address.linea1,
          direccion_detalle: address.detalle.trim() || null,
          ciudad:            address.ciudad,
          departamento:      address.departamento,
          franja:            slot,
        },
        payment: {
          metodo:     payment as 'nequi' | 'daviplata' | 'transferencia' | 'efectivo',
          referencia: refTransfer.trim() || undefined,
        },
        items: items.map((i) => ({
          slug:     i.slug,
          cantidad: i.quantity,
        })),
      });
      // Capture the server response before emptying the cart.
      setConfirmation(result);
      clearCart();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al procesar la orden');
    }
    setLoading(false);
  };

  if (confirmation) {
    return (
        <div className="min-h-[80vh] flex items-center justify-center pt-16 px-4">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full text-center">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Clock className="w-10 h-10 text-amber-600" />
            </div>
            <h1 className="text-3xl font-playfair text-[#1a0f08] mb-2">¡Pedido recibido!</h1>
            <p className="text-[#5a3a28] mb-2">Gracias, {info.nombre}. Recibimos tu pedido.</p>
            <p className="text-sm text-[#8B6650] mb-4">Tu pedido está reservado. Confirmaremos el pago por WhatsApp y luego preparamos tu envío.</p>
            <div className="flex items-center justify-center gap-2 mb-6">
              <span className="text-xs text-[#8B6650]">Estado:</span>
              <StatusBadge status={confirmation.estado} theme="light" />
            </div>
            <div className="bg-[#f0e8de] rounded-2xl p-5 mb-6 text-left">
              <p className="text-xs text-[#8B6650] mb-1 text-center">Número de orden</p>
              <p className="text-2xl font-bold text-[#8B4513] mb-4 text-center">{confirmation.numero_orden}</p>
              <div className="space-y-2 pt-3 border-t border-[#e8ddd0]">
                {confirmation.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs text-[#5a3a28]">
                    <span className="min-w-0 truncate pr-2">{item.producto_nombre} × {item.cantidad}</span>
                    <span className="shrink-0 font-medium">{formatCOP(item.subtotal)}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-2 pt-3 mt-3 border-t border-[#e8ddd0] text-sm">
                <div className="flex justify-between text-[#5a3a28]">
                  <span>Subtotal</span><span>{formatCOP(confirmation.subtotal)}</span>
                </div>
                <div className="flex justify-between text-[#5a3a28]">
                  <span>Envío</span>
                  <span className={confirmation.costo_envio === 0 ? 'text-emerald-600' : ''}>{confirmation.costo_envio === 0 ? 'Gratis' : formatCOP(confirmation.costo_envio)}</span>
                </div>
                {confirmation.metodo_envio && (
                  <div className="flex justify-between text-[#5a3a28]">
                    <span>Entrega</span>
                    <span className="text-right">
                      {getShippingMethod(confirmation.metodo_envio)?.label ?? confirmation.metodo_envio}
                      {findSlotLabel(confirmation.franja) ? ` · ${findSlotLabel(confirmation.franja)}` : ''}
                    </span>
                  </div>
                )}
                {confirmation.direccion_detalle && (
                  <div className="flex justify-between text-[#5a3a28]">
                    <span>Detalles</span>
                    <span className="text-right">{confirmation.direccion_detalle}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-[#1a0f08] text-base pt-1 border-t border-[#e8ddd0]">
                  <span>Total</span><span>{formatCOP(confirmation.total)}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Link href={`/rastrear-pedido?orden=${encodeURIComponent(confirmation.numero_orden)}&email=${encodeURIComponent(info.email)}`} className="block w-full bg-[#1a0f08] text-white font-semibold py-3.5 rounded-xl text-sm hover:bg-[#2d1a0e] transition-colors">Rastrear mi pedido</Link>
              <Link href="/tienda" className="block w-full border border-[#e8ddd0] text-[#5a3a28] font-medium py-3.5 rounded-xl text-sm hover:bg-[#f0e8de] transition-colors">Seguir comprando</Link>
            </div>
          </motion.div>
        </div>
    );
  }

  if (items.length === 0) {
    return (
        <div className="min-h-[60vh] flex items-center justify-center pt-16">
          <div className="text-center">
            <p className="text-xl font-playfair mb-4">Tu carrito está vacío</p>
            <Link href="/" className="text-[#8B4513] underline text-sm">← Explorar productos</Link>
          </div>
        </div>
    );
  }

  return (
      <div className="pt-16 min-h-screen bg-[#faf7f4]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Link href="/tienda" className="p-2 hover:bg-[#f0e8de] rounded-lg transition-colors cursor-pointer">
              <ArrowLeft className="w-5 h-5 text-[#5a3a28]" />
            </Link>
            <h1 className="text-2xl font-playfair text-[#1a0f08]">Checkout</h1>
          </div>

          {/* Steps */}
          <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2 shrink-0">
                <div className={`flex items-center gap-2 ${i === step ? 'text-[#8B4513]' : i < step ? 'text-emerald-600' : 'text-[#a07050]'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === step ? 'bg-[#8B4513] text-white' : i < step ? 'bg-emerald-600 text-white' : 'bg-[#e8ddd0] text-[#8B6650]'}`}>
                    {i < step ? '✓' : i + 1}
                  </div>
                  <span className="text-sm font-medium">{s}</span>
                </div>
                {i < STEPS.length - 1 && <div className="w-8 h-px bg-[#e8ddd0] mx-1" />}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Form */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl border border-[#e8ddd0] p-6">
                {/* Step 0: Info */}
                {step === 0 && (
                  <div className="space-y-4">
                    <h2 className="font-semibold text-[#1a0f08] mb-4">Información de contacto</h2>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Nombre *" value={info.nombre} onChange={v => setInfo({ ...info, nombre: v })} />
                      <Field label="Apellido *" value={info.apellido} onChange={v => setInfo({ ...info, apellido: v })} />
                    </div>
                    <Field label="Correo electrónico *" type="email" value={info.email} onChange={v => setInfo({ ...info, email: v })} />
                    <div>
                      <label className="block text-xs font-medium text-[#5a3a28] mb-1.5">Teléfono / WhatsApp *</label>
                      <div className="flex items-stretch">
                        <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-[#e8ddd0] bg-[#f0e8de] text-sm font-medium text-[#5a3a28] select-none">+57</span>
                        <input
                          type="tel" inputMode="numeric" value={info.telefono}
                          onChange={e => setInfo({ ...info, telefono: e.target.value })} placeholder="300 000 0000"
                          className="w-full px-4 py-3 bg-[#faf7f4] border border-[#e8ddd0] rounded-r-xl text-sm text-[#1a0f08] focus:outline-none focus:ring-2 focus:ring-[#8B4513]/20 focus:border-[#8B4513]"
                        />
                      </div>
                      {info.telefono && !phoneValid && (
                        <p className="mt-1 text-xs text-red-600">Ingresa un celular colombiano de 10 dígitos (ej. 300 123 4567).</p>
                      )}
                    </div>
                    <div className="space-y-4">
                    <h2 className="font-semibold text-[#1a0f08] mb-4">Dirección de entrega</h2>
                    <Field label="Dirección *" value={address.linea1} onChange={v => setAddress({ ...address, linea1: v })} placeholder="Calle, Carrera, número" />
                    <Field label="Detalles adicionales (opcional)" value={address.detalle} onChange={v => setAddress({ ...address, detalle: v })} placeholder="Apto, torre, interior, indicaciones de entrega." />
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Ciudad *" value={address.ciudad} onChange={v => setAddress({ ...address, ciudad: v })} />
                      <div>
                        <label className="block text-xs font-medium text-[#5a3a28] mb-1.5">Departamento *</label>
                        <select
                          value={address.departamento} onChange={e => selectDepartamento(e.target.value)}
                          className="w-full px-4 py-3 bg-[#faf7f4] border border-[#e8ddd0] rounded-xl text-sm text-[#1a0f08] focus:outline-none focus:ring-2 focus:ring-[#8B4513]/20 focus:border-[#8B4513]"
                        >
                          <option value="" disabled>Selecciona departamento</option>
                          {COLOMBIA_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-3 mt-4">
                      <p className="text-sm font-semibold text-[#1a0f08]">Método de envío</p>
                      {/* Method, price and franja are derived from departamento. */}
                      {!shippingMethod ? (
                        <p className="text-sm text-[#8B6650] p-4 rounded-xl border-2 border-dashed border-[#e8ddd0]">
                          Selecciona tu departamento para ver el método y el costo de envío.
                        </p>
                      ) : (
                        <div>
                          <div className="flex items-center justify-between p-4 rounded-xl border-2 border-[#8B4513] bg-[#8B4513]/5">
                            <div>
                              <span className="block text-sm font-medium text-[#1a0f08]">{shippingMethod.label}</span>
                              <span className="block text-xs text-[#8B6650]">{shippingMethod.description}</span>
                            </div>
                            <span className="text-sm font-bold text-[#8B4513] shrink-0">{shippingCost === 0 ? 'Gratis' : formatCOP(shippingCost!)}</span>
                          </div>
                          {/* Franja horaria — required for Bogotá D.C., framed as a preference */}
                          {isBogota && shippingMethod.slots && (
                            <div className="mt-3 ml-4 pl-4 border-l-2 border-[#e8ddd0] space-y-2">
                              <p className="text-xs font-semibold text-[#5a3a28]">Franja horaria * <span className="font-normal text-[#8B6650]">(preferencia)</span></p>
                              {shippingMethod.slots.map(s => (
                                <label key={s.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${slot === s.id ? 'border-[#8B4513] bg-[#8B4513]/5' : 'border-[#e8ddd0]'}`}>
                                  <input type="radio" name="slot" value={s.id} checked={slot === s.id} onChange={() => setSlot(s.id)} className="accent-[#8B4513]" />
                                  <span className="text-sm text-[#1a0f08]">{s.label}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-3 mt-2">
                      <button onClick={() => setStep(0)} className="flex-1 border border-[#e8ddd0] text-[#5a3a28] font-medium py-3.5 rounded-xl text-sm hover:bg-[#f0e8de]">Atrás</button>
                      <button onClick={() => setStep(1)} disabled={!address.linea1 || !address.ciudad || !address.departamento || !phoneValid || (isBogota && !slot)} className="flex-1 bg-[#1a0f08] disabled:opacity-40 text-white font-semibold py-3.5 rounded-xl text-sm hover:bg-[#2d1a0e]">Continuar al pago</button>
                    </div>
                  </div>
                  </div>
                )}

                {/* Step 1: Shipping */}
                

                {/* Step 2: Payment */}
                {step === 1 && (
                  <div className="space-y-4">
                    <h2 className="font-semibold text-[#1a0f08] mb-4">Método de pago</h2>
                    <div className="space-y-3">
                      {availablePayments.map(opt => (
                        <label key={opt.id} className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${payment === opt.id ? 'border-[#8B4513] bg-[#8B4513]/5' : 'border-[#e8ddd0]'}`}>
                          <input type="radio" name="payment" value={opt.id} checked={payment === opt.id} onChange={() => setPayment(opt.id)} className="mt-0.5 accent-[#8B4513]" />
                          <div>
                            <p className="text-sm font-semibold text-[#1a0f08]">{opt.label}</p>
                            <p className="text-xs text-[#8B6650]">{opt.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                    {(payment === 'nequi' || payment === 'daviplata' || payment === 'transferencia') && (
                      <Field label="Referencia de pago (opcional)" value={refTransfer} onChange={setRefTransfer} placeholder="Número de confirmación" />
                    )}
                    <div className="bg-[#f0e8de] rounded-xl p-4 flex items-start gap-2 text-xs text-[#5a3a28]">
                      <Lock className="w-3.5 h-3.5 text-[#8B4513] shrink-0 mt-0.5" />
                      <span>Tu información está segura. Nuestro equipo confirmará el pago por WhatsApp y procesará tu pedido en menos de 2 horas hábiles.</span>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setStep(0)} className="flex-1 border border-[#e8ddd0] text-[#5a3a28] font-medium py-3.5 rounded-xl text-sm hover:bg-[#f0e8de]">Atrás</button>
                      <button onClick={handleOrder} disabled={loading} className="flex-1 bg-[#8B4513] hover:bg-[#5a2d0c] disabled:opacity-60 text-white font-bold py-3.5 rounded-xl text-sm transition-colors">
                        {loading ? 'Procesando...' : `Confirmar pedido · ${formatCOP(total)}`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Order Summary */}
            <div>
              <div className="bg-white rounded-2xl border border-[#e8ddd0] p-5 sticky top-20">
                <h3 className="font-semibold text-[#1a0f08] mb-4">Resumen del pedido</h3>
                <div className="space-y-3 mb-4">
                  {items.map(item => (
                    <div key={item.key} className="flex gap-3">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#f0e8de] shrink-0">
                        <img src={item.imagen} alt={item.nombre} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[#1a0f08] line-clamp-2">{item.nombre}</p>
                        <p className="text-xs text-[#8B6650]">× {item.quantity}</p>
                      </div>
                      <p className="text-xs font-bold text-[#1a0f08] shrink-0">{formatCOP(item.precio * item.quantity)}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 pt-3 border-t border-[#e8ddd0] text-sm">
                  <div className="flex justify-between text-[#5a3a28]">
                    <span>Subtotal</span><span>{formatCOP(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-[#5a3a28]">
                    <span>Envío</span>
                    {shippingCost === null
                      ? <span className="text-[#8B6650]">Selecciona departamento</span>
                      : <span className={shippingCost === 0 ? 'text-emerald-600' : ''}>{shippingCost === 0 ? 'Gratis' : formatCOP(shippingCost)}</span>}
                  </div>
                  <div className="flex justify-between font-bold text-[#1a0f08] text-base pt-1 border-t border-[#e8ddd0]">
                    <span>Total</span><span>{formatCOP(total)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-4 text-xs text-[#8B6650]">
                  <Shield className="w-3.5 h-3.5 text-[#8B4513]" />
                  <span>Compra 100% segura y verificada</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}

interface FieldProps {
  label: string;

  value: string;

  onChange: (value: string) => void;

  type?: string;

  placeholder?: string;
}

function Field({ label, value, onChange, type = 'text', placeholder }: FieldProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#5a3a28] mb-1.5">{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-4 py-3 bg-[#faf7f4] border border-[#e8ddd0] rounded-xl text-sm text-[#1a0f08] focus:outline-none focus:ring-2 focus:ring-[#8B4513]/20 focus:border-[#8B4513]"
      />
    </div>
  );
}