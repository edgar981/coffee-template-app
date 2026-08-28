"use client";

import {
  Leaf,
  Coffee,
  Truck,
  Shield,
} from "lucide-react";

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

export default function TrustBadges() {
  return (
    <section className="border-y border-[var(--sf-linea)] bg-[var(--sf-fondo)] py-6">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {BADGES.map(
            ({ icon: Icon, text }) => (
              <div
                key={text}
                className="flex items-center gap-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--sf-tostado)]/20">
                  <Icon className="h-4 w-4 text-[var(--sf-acento-texto)]" />
                </div>

                <span className="text-sm font-medium text-[var(--sf-acento-2)]">
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