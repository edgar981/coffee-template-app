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

    label: "Elige grano o molido",

    description:
      "Siempre el mismo café de nuestra finca — tú eliges cómo lo prefieres.",
  },

  {
    id: "03",

    icon: Zap,

    label: "Tostamos fresco",

    description:
      "Tostamos tu café en tandas semanales, días antes del envío.",
  },

  {
    id: "04",

    icon: CheckCircle,

    label: "Recíbelo en casa",

    description:
      "Enviamos tu café fresco a todo el país.",
  },
];