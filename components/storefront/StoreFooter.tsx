"use client";

import Link from "next/link";
import Image from "next/image";

import {
  MessageCircle,
} from "lucide-react";

import { Logo } from "@/components/storefront/Logo";
import {
  siteConfig,
  whatsappUrl,
  instagramUrl,
  formatWhatsappDisplay,
} from "@/lib/config/site";
import { useSiteSettings } from "@/components/storefront/SiteSettingsProvider";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";

// `footerNav`/`legalNav` son ESTRUCTURADOS y se quedan en código (v1). La marca, el
// whatsapp y el instagram vienen de SiteSetting vía el provider (una sola fuente).
const { footerNav, legalNav } = siteConfig;

export default function StoreFooter() {
  const settings = useSiteSettings();
  // La entrada a /nosotros se OCULTA cuando la página está apagada (§ paginas.nosotros). La columna
  // "Empresa" no queda vacía —lleva el bloque de WhatsApp aparte del link—.
  const { paginas } = useSiteContent();
  const empresa = footerNav.empresa.filter((l) => l.href !== "/nosotros" || paginas.nosotros.visible);
  return (
    <footer className="bg-[var(--sf-tinta)] text-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="mb-4">
              {/* Espresso background → dark (cream) stacked lockup */}
              <Logo
                nombre={settings.nombre}
                variant="dark"
                stacked
                subtitle={settings.tagline}
                className="items-start [&>div]:items-start"
              />
            </div>

            <p className="mb-6 text-sm leading-relaxed text-white/50">
              {settings.descripcionFooter}
            </p>

            <div className="flex gap-3">
              <a
                href={instagramUrl(settings.instagram)}
                target="_blank"
                rel="noopener"
                aria-label={`Instagram de ${settings.nombre}`}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 transition-colors hover:bg-white/20"
              >
                <Image
                    src="/icons/instagram-white.svg"
                    alt=""
                    width={16}
                    height={16}
                    className="opacity-60"
                    />
              </a>

              <a
                href={whatsappUrl(settings.whatsapp)}
                target="_blank"
                rel="noopener"
                aria-label={`WhatsApp de ${settings.nombre}`}
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
              {footerNav.tienda.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="transition-colors hover:text-[var(--sf-tostado)]"
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
              {footerNav.ayuda.map((link) => {
                const external = link.href.startsWith("http");
                return (
                  <li key={link.label}>
                    {external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener"
                        className="transition-colors hover:text-[var(--sf-tostado)]"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="transition-colors hover:text-[var(--sf-tostado)]"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Empresa */}
          <div>
            <h4 className="mb-4 text-sm font-semibold text-white">
              Empresa
            </h4>

            <ul className="space-y-2.5 text-sm text-white/50">
              {empresa.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="transition-colors hover:text-[var(--sf-tostado)]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-6 text-sm text-white/50">
              <p>📱 WhatsApp</p>

              <a
                href={whatsappUrl(settings.whatsapp)}
                target="_blank"
                rel="noopener"
                className="text-[var(--sf-tostado)] hover:text-[var(--sf-tostado-6)]"
              >
                {formatWhatsappDisplay(settings.whatsapp)}
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-4 text-xs text-white/30 sm:flex-row sm:px-6 lg:px-8">
          <p>
            © 2026 {settings.nombre}.
            Todos los derechos reservados.
          </p>

          {legalNav.length > 0 && (
            <div className="flex gap-4">
              {legalNav.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="transition-colors hover:text-white/60"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}