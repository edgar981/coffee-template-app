"use client";
import { useState } from 'react';
import Link from "next/link";
import { ArrowLeft, Shield, Lock, CreditCard, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCartStore } from '@/lib/cartStore';
import { createOrder } from "@/services/checkout.service";
import { formatCOP } from '@/lib/utils';
import { toast } from 'sonner';

const STEPS = ['Información', 'Pago'];

export default function Checkout() {
  const { items, subtotal, clearCart } = useCartStore();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  const [info, setInfo] = useState({ nombre: '', apellido: '', email: '', telefono: '' });
  const [address, setAddress] = useState({ linea1: '', ciudad: 'Bogotá', departamento: 'Cundinamarca', cp: '' });
  const [shipping, setShipping] = useState('standard');
  const [payment, setPayment] = useState('nequi');
  const [refTransfer, setRefTransfer] = useState('');

  const shippingCost = subtotal > 150000 ? 0 : shipping === 'express' ? 18000 : 8000;
  const total = subtotal + shippingCost;

  const shippingOptions = [
    { id: 'standard', label: 'Estándar (3–5 días)', price: subtotal > 150000 ? 0 : 8000 },
    { id: 'express', label: 'Express (1–2 días)', price: 18000 },
  ];

  const paymentOptions = [
    { id: 'nequi', label: 'Nequi', desc: 'Enviar a 300 123 4567' },
    { id: 'daviplata', label: 'Daviplata', desc: 'Enviar a 300 123 4567' },
    { id: 'transferencia', label: 'Transferencia Bancaria', desc: 'Bancolombia · Cta Ahorro · 123-456789-00' },
    { id: 'efectivo', label: 'Contra entrega', desc: 'Solo disponible en Bogotá' },
  ];

  const handleOrder = async () => {
    setLoading(true);
    const n = `SN-${Math.floor(1000 + Math.random() * 9000)}`;
    try {
      await createOrder({
  numero_orden: n,

  cliente_nombre:
    `${info.nombre} ${info.apellido}`.trim(),

  cliente_telefono: info.telefono,

  estado: "pendiente",

  items: items.map((i) => ({
    producto_nombre: i.nombre,
    cantidad: i.quantity,
    precio_unitario: i.precio,
    subtotal: i.precio * i.quantity,
  })),

  subtotal,

  costo_envio: shippingCost,

  total,

  metodo_pago: payment,

  direccion_entrega: address.linea1,

  ciudad_entrega: address.ciudad,

  email: info.email,
});
      setOrderNumber(n);
      clearCart();
    } catch (e) {
      toast.error('Error al procesar la orden');
    }
    setLoading(false);
  };

  if (orderNumber) {
    return (
        <div className="min-h-[80vh] flex items-center justify-center pt-16 px-4">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-emerald-600" />
            </div>
            <h1 className="text-3xl font-playfair text-[#1a0f08] mb-2">¡Pedido confirmado!</h1>
            <p className="text-[#5a3a28] mb-2">Gracias por tu compra, {info.nombre}.</p>
            <p className="text-sm text-[#8B6650] mb-6">Nos pondremos en contacto via WhatsApp para confirmar el pago.</p>
            <div className="bg-[#f0e8de] rounded-2xl p-5 mb-6">
              <p className="text-xs text-[#8B6650] mb-1">Número de orden</p>
              <p className="text-2xl font-bold text-[#8B4513]">{orderNumber}</p>
              <p className="text-sm text-[#5a3a28] mt-2">Total: <strong>{formatCOP(total)}</strong></p>
            </div>
            <div className="flex flex-col gap-3">
              <Link href={`/rastrear-pedido?orden=${orderNumber}`} className="block w-full bg-[#1a0f08] text-white font-semibold py-3.5 rounded-xl text-sm hover:bg-[#2d1a0e] transition-colors">Rastrear mi pedido</Link>
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
                    <Field label="Teléfono / WhatsApp *" value={info.telefono} onChange={v => setInfo({ ...info, telefono: v })} placeholder="+57 300 000 0000" />
                    <div className="space-y-4">
                    <h2 className="font-semibold text-[#1a0f08] mb-4">Dirección de entrega</h2>
                    <Field label="Dirección *" value={address.linea1} onChange={v => setAddress({ ...address, linea1: v })} placeholder="Calle, Carrera, número" />
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Ciudad *" value={address.ciudad} onChange={v => setAddress({ ...address, ciudad: v })} />
                      <Field label="Departamento" value={address.departamento} onChange={v => setAddress({ ...address, departamento: v })} />
                    </div>
                    <div className="space-y-3 mt-4">
                      <p className="text-sm font-semibold text-[#1a0f08]">Método de envío</p>
                      {shippingOptions.map(opt => (
                        <label key={opt.id} className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${shipping === opt.id ? 'border-[#8B4513] bg-[#8B4513]/5' : 'border-[#e8ddd0]'}`}>
                          <div className="flex items-center gap-3">
                            <input type="radio" name="shipping" value={opt.id} checked={shipping === opt.id} onChange={() => setShipping(opt.id)} className="accent-[#8B4513]" />
                            <span className="text-sm font-medium text-[#1a0f08]">{opt.label}</span>
                          </div>
                          <span className="text-sm font-bold text-[#8B4513]">{opt.price === 0 ? 'Gratis' : formatCOP(opt.price)}</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-3 mt-2">
                      <button onClick={() => setStep(0)} className="flex-1 border border-[#e8ddd0] text-[#5a3a28] font-medium py-3.5 rounded-xl text-sm hover:bg-[#f0e8de]">Atrás</button>
                      <button onClick={() => setStep(1)} disabled={!address.linea1 || !address.ciudad} className="flex-1 bg-[#1a0f08] disabled:opacity-40 text-white font-semibold py-3.5 rounded-xl text-sm hover:bg-[#2d1a0e]">Continuar al pago</button>
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
                      {paymentOptions.map(opt => (
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
                    <span className={shippingCost === 0 ? 'text-emerald-600' : ''}>{shippingCost === 0 ? 'Gratis' : formatCOP(shippingCost)}</span>
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