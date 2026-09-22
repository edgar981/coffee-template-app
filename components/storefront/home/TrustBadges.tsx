"use client";

import {
  Leaf,
  Coffee,
  Truck,
  Shield,
} from "lucide-react";

import { DEFAULTS, type TrustBadgesContent } from "@/lib/config/site-content-defaults";

// Los ÍCONOS son ESTRUCTURA fija por posición (§ REGISTRY.trustBadges): sólo el TEXTO es dato.
const ICONOS = [Leaf, Coffee, Truck, Shield] as const;

// El ícono y el label se apoyan DIRECTO en el fondo de la banda (`--sf-banda`, crema por defecto) —
// NO están dentro de una tarjeta —, así que van `--sf-sobre-banda` con el literal de hoy como
// fallback (§ eje 5b, home-2): sin esquema asignado, byte-idéntico (acento-texto/acento-2); con un
// esquema —medido el peor caso, `acento`— pasaban de 1.00:1/2.04:1 (el ícono literalmente se fundía
// con el fondo) a ≥4.5:1.
//
// `content` llega por PROP, no por `useSiteContent()` (§ CONTENIDO-CAFE-A-DATO-B-1, mismo patrón
// que el `negocio` de GrindChooser): este componente se monta también en la vista previa de paleta
// del admin (`PaletaSeccion.tsx`, FUERA del árbol del storefront, SIN `SiteContentProvider` —
// `useSiteContent()` ahí LANZARÍA, § Las tres capas — montar un componente en otro árbol de
// providers). Sin prop (ese caso) cae al DEFAULT NEUTRO — inerte, no navegable, no importa qué diga.
export default function TrustBadges({ style, content }: { style?: React.CSSProperties; content?: TrustBadgesContent }) {
  const c = content ?? DEFAULTS.trustBadges;
  const BADGES = [c.badge1, c.badge2, c.badge3, c.badge4];
  return (
    <section className="sf-divisor-y border-[var(--sf-linea)] bg-[var(--sf-banda,var(--sf-fondo))] py-6" style={style}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {BADGES.map(
            (text, i) => {
              const Icon = ICONOS[i];
              return (
                <div
                  key={i}
                  className="flex items-center gap-3"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--sf-tostado)]/20">
                    <Icon className="h-4 w-4 text-[var(--sf-sobre-banda,var(--sf-acento-texto))]" />
                  </div>

                  <span className="text-sm font-medium text-[var(--sf-sobre-banda,var(--sf-acento-2))]">
                    {text}
                  </span>
                </div>
              );
            }
          )}
        </div>
      </div>
    </section>
  );
}