"use client";

import Link from "next/link";
import Image from "next/image";

import {
  Coffee,
  MessageCircle,
} from "lucide-react";

const shopLinks = [
  {
    label: "Todos los productos",
    href: "/tienda",
  },
  {
    label: "Café en Grano",
    href: "/tienda?cat=cafe_grano",
  },
  {
    label: "Cold Brew",
    href: "/tienda?cat=cold_brew",
  },
  {
    label: "Cajas de Regalo",
    href: "/tienda?cat=caja_regalo",
  },
  {
    label: "Suscripciones",
    href: "/suscripciones",
  },
];

const helpLinks = [
  {
    label: "Rastrear Pedido",
    href: "/rastrear-pedido",
  },
  {
    label: "Preguntas Frecuentes",
    href: "/preguntas-frecuentes",
  },
  {
    label: "Política de Envíos",
    href: "/tienda/envios",
  },
  {
    label: "Devoluciones",
    href: "/tienda/devoluciones",
  },
  {
    label: "Contacto",
    href: "/tienda/contacto",
  },
];

const companyLinks = [
  {
    label: "Nuestra Historia",
    href: "/tienda/nosotros",
  },
  {
    label: "Blog",
    href: "/tienda/blog",
  },
  {
    label: "Sostenibilidad",
    href: "/tienda/sostenibilidad",
  },
  {
    label: "Trabaja con nosotros",
    href: "/tienda/empleo",
  },
];

export default function StoreFooter() {
  return (
    <footer className="bg-[#1a0f08] text-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="mb-4 flex items-center gap-2">
              <Coffee className="h-5 w-5 text-[#d4a97a]" />

              <span className="font-playfair text-xl font-medium">
                Sierra Nativa
              </span>
            </div>

            <p className="mb-6 text-sm leading-relaxed text-white/50">
              Café de especialidad colombiano.
              Del cafetal a tu taza, con
              trazabilidad completa.
            </p>

            <div className="flex gap-3">
              <a
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 transition-colors hover:bg-white/20"
              >
                <Image
                    src="/icons/instagram-white.svg"
                    alt="Instagram"
                    width={16}
                    height={16}
                    className="opacity-60"
                    />
              </a>

              <a
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 transition-colors hover:bg-white/20"
              >
                <MessageCircle className="h-4 w-4 text-white/60" />
              </a>
            </div>
          </div>

          {/* Tienda */}
          <div>
            <h4 className="mb-4 text-sm font-semibold text-white">
              Tienda
            </h4>

            <ul className="space-y-2.5 text-sm text-white/50">
              {shopLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="transition-colors hover:text-[#d4a97a]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Ayuda */}
          <div>
            <h4 className="mb-4 text-sm font-semibold text-white">
              Ayuda
            </h4>

            <ul className="space-y-2.5 text-sm text-white/50">
              {helpLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="transition-colors hover:text-[#d4a97a]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Empresa */}
          <div>
            <h4 className="mb-4 text-sm font-semibold text-white">
              Empresa
            </h4>

            <ul className="space-y-2.5 text-sm text-white/50">
              {companyLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="transition-colors hover:text-[#d4a97a]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-6 text-sm text-white/50">
              <p>📱 WhatsApp</p>

              <a
                href="https://wa.me/573001234567"
                className="text-[#d4a97a] hover:text-[#e8c095]"
              >
                +57 300 123 4567
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-4 text-xs text-white/30 sm:flex-row sm:px-6 lg:px-8">
          <p>
            © 2026 Sierra Nativa Coffee.
            Todos los derechos reservados.
          </p>

          <div className="flex gap-4">
            <Link
              href="/tienda/privacidad"
              className="transition-colors hover:text-white/60"
            >
              Privacidad
            </Link>

            <Link
              href="/tienda/terminos"
              className="transition-colors hover:text-white/60"
            >
              Términos
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}