"use client";

import {
  Leaf,
  Coffee,
  Truck,
  Shield,
} from "lucide-react";

import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { REGISTRY, seccionEsVisible } from "@/lib/config/site-content-defaults";

const BADGES = [
  {
    icon: Leaf,
    text: "Origen 100% colombiano",
  },

  {
    icon: Coffee,
    text: "Tostado artesanal semanal",
  },

  {
    icon: Truck,
    text: "Envío a todo el país",
  },

  {
    icon: Shield,
    text: "Garantía de frescura",
  },
];

// El ícono y el label se apoyan DIRECTO en el fondo de la banda (`--sf-banda`, crema por defecto) —
// NO están dentro de una tarjeta —, así que van `--sf-sobre-banda` con el literal de hoy como
// fallback (§ eje 5b, home-2): sin esquema asignado, byte-idéntico (acento-texto/acento-2); con un
// esquema —medido el peor caso, `acento`— pasaban de 1.00:1/2.04:1 (el ícono literalmente se fundía
// con el fondo) a ≥4.5:1.
//
// EL INTERRUPTOR (§ CORTE-TRUSTBADGES-OCULTABLE-1, ver el docstring de `TrustBadgesContent`,
// site-content-defaults.ts): MISMO mecanismo que Marquesina/Origen — se lee `content.trustBadges` y
// `seccionEsVisible` decide si la sección se apaga (`null`). SE APAGA, NO SE BORRA: el array
// `BADGES` de arriba sigue siendo estructura de código; sólo el "¿se muestra?" es dato.
export default function TrustBadges({ style }: { style?: React.CSSProperties } = {}) {
  const { trustBadges } = useSiteContent();
  if (!seccionEsVisible(REGISTRY.trustBadges, trustBadges)) return null;

  return (
    <section className="sf-divisor-y border-[var(--sf-linea)] bg-[var(--sf-banda,var(--sf-fondo))] py-6" style={style}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {BADGES.map(
            ({ icon: Icon, text }) => (
              <div
                key={text}
                className="flex items-center gap-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--sf-tostado)]/20">
                  <Icon className="h-4 w-4 text-[var(--sf-sobre-banda,var(--sf-acento-texto))]" />
                </div>

                <span className="text-sm font-medium text-[var(--sf-sobre-banda,var(--sf-acento-2))]">
                  {text}
                </span>
              </div>
            )
          )}
        </div>
      </div>
    </section>
  );
}