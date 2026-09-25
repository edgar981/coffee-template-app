"use client";

import Link from "next/link";
import Image from "next/image";

import {
  MessageCircle,
} from "lucide-react";

import { Logo } from "@/components/storefront/Logo";
import { STOREFRONT_TIENE_MARK } from "@/lib/config/storefront-marca";
import {
  siteConfig,
  whatsappUrl,
  formatWhatsappDisplay,
  urlDeRedSocial,
  type RedSocialGuardada,
} from "@/lib/config/site";
import { useSiteSettings } from "@/components/storefront/SiteSettingsProvider";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { faqSuscripcionesVisible } from "@/lib/config/site-content-defaults";

// `footerNav`/`legalNav` son ESTRUCTURADOS y se quedan en código (v1). La marca viene de
// SiteSetting vía el provider (una sola fuente).
const { footerNav, legalNav } = siteConfig;

// LOS BOTONES SOCIALES SALEN DE `settings.redes` (§ MUESTRARIO-REDES-ADICIONALES-1) — la MISMA
// fuente que `RielSocial` (`lib/config/site.ts`, `parseRedesSociales`/`urlDeRedSocial`). Reemplaza
// la lectura directa de `settings.instagram`/`.whatsapp` de este bloque; el "📱 WhatsApp" de la
// columna Empresa (más abajo) sigue leyendo `settings.whatsapp` DIRECTO — es contacto de negocio,
// no un ícono de esta lista, y esa columna no se tocó.
//
// El ASSET es por-tipo, igual que en `RielSocial`: Instagram con el SVG propio, WhatsApp con
// `MessageCircle` de lucide, Facebook/X/Pinterest SIN asset (no existe ni en el repo ni en lucide
// 1.16) — rinden sin ícono, § el spec: "no inventes un SVG".
function iconoDeRedFooter(red: RedSocialGuardada) {
  if (red.tipo === "instagram") {
    return (
      <Image
        src="/icons/instagram-white.svg"
        alt=""
        width={16}
        height={16}
        className="opacity-60"
      />
    );
  }
  if (red.tipo === "whatsapp") return <MessageCircle className="h-4 w-4 text-[var(--sf-sobre)]/60" />;
  return null;
}

const LABEL_RED_FOOTER: Record<RedSocialGuardada["tipo"], string> = {
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  x: "X",
  pinterest: "Pinterest",
};

export default function StoreFooter() {
  const settings = useSiteSettings();
  const content = useSiteContent();
  // La entrada a /nosotros se OCULTA cuando la página está apagada (§ paginas.nosotros). La columna
  // "Empresa" no queda vacía —lleva el bloque de WhatsApp aparte del link—.
  const { paginas } = content;
  const empresa = footerNav.empresa.filter((l) => l.href !== "/nosotros" || paginas.nosotros.visible);
  // La entrada a /suscripciones se OCULTA cuando la capacidad está apagada (§ paginas.suscripciones,
  // Backlog #49). La columna "Tienda" no queda vacía —lleva "Todos los productos" aparte—.
  const tienda = footerNav.tienda.filter((l) => l.href !== "/suscripciones" || paginas.suscripciones.visible);
  // La entrada a /preguntas-frecuentes se OCULTA cuando esa página no tiene nada que mostrar
  // (§ SUSCRIPCIONES-FAQ-DATO-1, faqSuscripcionesVisible — MISMA condición que la ruta). La columna
  // "Ayuda" no queda vacía —le queda "Rastrear Pedido"—.
  const ayuda = footerNav.ayuda.filter((l) => l.href !== "/preguntas-frecuentes" || faqSuscripcionesVisible(content));
  return (
    <footer className="bg-[var(--sf-tinta)] text-[var(--sf-sobre)]">
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
                conMark={STOREFRONT_TIENE_MARK}
                className="items-start [&>div]:items-start"
              />
            </div>

            <p className="mb-6 text-sm leading-relaxed text-[var(--sf-sobre)]/50">
              {settings.descripcionFooter}
            </p>

            {/* Los botones sociales salen de `settings.redes`: una lista vacía no rinde nada
                (idéntico al criterio de antes — un botón muerto es peor que no mostrarlo). */}
            <div className="flex gap-3">
              {settings.redes.map((red) => (
                <a
                  key={red.tipo}
                  href={urlDeRedSocial(red)}
                  target="_blank"
                  rel="noopener"
                  aria-label={`${LABEL_RED_FOOTER[red.tipo]} de ${settings.nombre}`}
                  className="flex h-9 w-9 items-center justify-center sf-radio-lg bg-[var(--sf-sobre)]/10 transition-colors hover:bg-[var(--sf-sobre)]/20"
                >
                  {iconoDeRedFooter(red)}
                </a>
              ))}
            </div>
          </div>

          {/* Tienda */}
          <div>
            <h4 className="mb-4 text-sm font-semibold text-[var(--sf-sobre)]">
              Tienda
            </h4>

            <ul className="space-y-2.5 text-sm text-[var(--sf-sobre)]/50">
              {tienda.map((link) => (
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
            <h4 className="mb-4 text-sm font-semibold text-[var(--sf-sobre)]">
              Ayuda
            </h4>

            <ul className="space-y-2.5 text-sm text-[var(--sf-sobre)]/50">
              {ayuda.map((link) => {
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
            <h4 className="mb-4 text-sm font-semibold text-[var(--sf-sobre)]">
              Empresa
            </h4>

            <ul className="space-y-2.5 text-sm text-[var(--sf-sobre)]/50">
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

            {settings.whatsapp && (
              <div className="mt-6 text-sm text-[var(--sf-sobre)]/50">
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
            )}
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="sf-divisor-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-4 text-xs text-[var(--sf-sobre)]/30 sm:flex-row sm:px-6 lg:px-8">
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
                  className="transition-colors hover:text-[var(--sf-sobre)]/60"
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