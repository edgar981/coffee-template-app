import { Subscription } from "@/types/subscription";

// Planes de la PROPUESTA de suscripción: el MISMO café de la finca (una sola
// variedad), variando cantidad y frecuencia. Sin precio ni descuento — el CTA
// abre WhatsApp ("Me interesa"), no crea pedidos.
export const SUBSCRIPTION_PLANS: Subscription[] = [
  {
    id: "plan-250",
    nombre: "Plan 250 g",
    descripcion: "Una bolsa de 250 g cada mes",
    beneficios: [
      "Grano o molido, como prefieras",
      "El mismo café de nuestra finca en Supatá",
      "Tostado fresco en tandas semanales",
    ],
  },
  {
    id: "plan-500",
    nombre: "Plan 500 g",
    descripcion: "Una bolsa de 500 g cada mes",
    beneficios: [
      "Grano o molido, como prefieras",
      "El mismo café de nuestra finca en Supatá",
      "Tostado fresco en tandas semanales",
    ],
    popular: true,
  },
  {
    id: "plan-familiar",
    nombre: "Plan Familiar",
    descripcion: "Dos bolsas de 500 g cada mes",
    beneficios: [
      "Grano o molido, como prefieras",
      "Ideal para el hogar o la oficina",
      "Tostado fresco en tandas semanales",
    ],
  },
];
