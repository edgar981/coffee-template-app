import {
  CheckCircle,
  Coffee,
  Star,
  Zap,
} from "lucide-react";

export const SUBSCRIPTION_STEPS = [
  {
    id: "01",

    icon: Star,

    label: "Elige tu plan",

    description:
      "Selecciona la frecuencia y cantidad que mejor se adapte a ti.",
  },

  {
    id: "02",

    icon: Coffee,

    label: "Personalizamos",

    description:
      "Nuestro equipo selecciona los mejores cafés del mes para ti.",
  },

  {
    id: "03",

    icon: Zap,

    label: "Tostamos fresco",

    description:
      "Tostamos tu café días antes del envío para máxima frescura.",
  },

  {
    id: "04",

    icon: CheckCircle,

    label: "Recíbelo en casa",

    description:
      "Llega directamente a tu puerta con trazabilidad completa.",
  },
];