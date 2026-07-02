import { Subscription } from "@/types/subscription";

export const SUBSCRIPTION_PLANS: Subscription[] = [
  { id: 's1', nombre: 'Esencial', precio: 72000, descripcion: '2 bolsas de 250g / mes', beneficios: ['Selección curada mensual', 'Descuento 10%', 'Envío gratis'], theme: 'essential' },
  { id: 's2', nombre: 'Premium', precio: 115000, descripcion: '1 microlote selecto 250g / mes', beneficios: ['Microlote de origen único', 'Descuento 15%', 'Envío gratis', 'Guía de cata'], theme: 'premium', popular: true },
  { id: 's3', nombre: 'Barista', precio: 165000, descripcion: '3 bolsas + accesorios / mes', beneficios: ['3 cafés diferentes', 'Descuento 20%', 'Envío gratis', 'Accesorio sorpresa'], theme: 'barista' },
];