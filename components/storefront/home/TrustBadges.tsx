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
    <section className="border-y border-[#e8ddd0] bg-[#f9f5f0] py-6">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {BADGES.map(
            ({ icon: Icon, text }) => (
              <div
                key={text}
                className="flex items-center gap-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#d4a97a]/20">
                  <Icon className="h-4 w-4 text-[#8B4513]" />
                </div>

                <span className="text-sm font-medium text-[#3d2314]">
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