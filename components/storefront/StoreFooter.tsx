"use client";

import Link from "next/link";
import Image from "next/image";

import {
  MessageCircle,
} from "lucide-react";

import { Logo } from "@/components/storefront/Logo";
import { STOREFRONT_TIENE_MARK } from "@/lib/config/storefront-marca";
import {
  whatsappUrl,
  formatWhatsappDisplay,
  urlDeRedSocial,
  type RedSocialGuardada,
} from "@/lib/config/site";
import { useSiteSettings } from "@/components/storefront/SiteSettingsProvider";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { columnasDeFooter, type FooterContent } from "@/lib/config/site-content-defaults";

// EL PIE DE PÁGINA como SECCIÓN del REGISTRY (§ MUESTRARIO-FOOTER-TEMA-1). Antes `footerNav`/
// `legalNav` vivían en `siteConfig` (código fijo, cero fidelidad de preset posible); hoy los
// encabezados de columna y las etiquetas de sus enlaces son DATO (`content.footer`), con una
// VARIANTE de composición (`content.footer.variante`: 'franjas' la de HOY, 'apilado' la del
// muestrario). La marca/tagline SIGUE saliendo de `SiteSetting` (sin cambio, § useSiteSettings
// abajo) — lo único que cambia entre variantes es CÓMO se compone, no de dónde sale.
//
// LAS TRES COLUMNAS (con sus hrefs de ESTRUCTURA y el filtrado por página visible) se arman en
// `columnasDeFooter` (site-content-defaults.ts, PURA — capa 1 la prueba sin jsdom).

// LOS BOTONES SOCIALES SALEN DE `settings.redes` (§ MUESTRARIO-REDES-ADICIONALES-1) — la MISMA
// fuente que `RielSocial` (`lib/config/site.ts`, `parseRedesSociales`/`urlDeRedSocial`). El
// "📱 WhatsApp" de la columna Empresa (más abajo) sigue leyendo `settings.whatsapp` DIRECTO — es
// contacto de negocio, no un ícono de esta lista.
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
  const { footer } = content;
  const { tienda, ayuda, empresa } = columnasDeFooter(content);

  return footer.variante === "apilado"
    ? <FooterApilado settings={settings} footer={footer} tienda={tienda} ayuda={ayuda} empresa={empresa} />
    : <FooterColumnas settings={settings} footer={footer} tienda={tienda} ayuda={ayuda} empresa={empresa} />;
}

type SettingsFooter = ReturnType<typeof useSiteSettings>;

interface VariantProps {
  settings: SettingsFooter;
  footer: FooterContent;
  tienda: { label: string; href: string }[];
  ayuda: { label: string; href: string }[];
  empresa: { label: string; href: string }[];
}

// VARIANTE 'franjas' — LA CANÓNICA: el pie de HOY, VERBATIM (byte-idéntico a antes de este slice;
// sólo cambió DE DÓNDE salen los textos — de `siteConfig.footerNav`/`legalNav` a `content.footer`).
function FooterColumnas({ settings, footer, tienda, ayuda, empresa }: VariantProps) {
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
              {footer.columnaTienda}
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
              {footer.columnaAyuda}
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
              {footer.columnaEmpresa}
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

          {footer.items.length > 0 && (
            <div className="flex gap-4">
              {footer.items.map((link) => (
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

// VARIANTE 'apilado' — LA DEL MUESTRARIO (§ MUESTRARIO-FOOTER-TEMA-1, medida contra
// `docs/prototipos/cafeone/index.html:322+`, SIN el formulario de newsletter —fuera de alcance,
// § el spec de MUESTRARIO-FOOTER-TARJETA-IMAGEN-1: requiere modelo, endpoint y registro de
// consentimiento, es FEATURE no tema—): la marca (wordmark apilado + tagline) ocupa el ANCHO
// COMPLETO arriba, y las columnas de enlaces se acomodan DEBAJO en una fila — la misma relación
// "marca arriba, contenido debajo" del `.footer-mark`/`.footer-top`/`.footer-cols` del prototipo,
// con el mismo DATO que la canónica (nada nuevo que mantener sincronizado).
//
// LA TARJETA DE IMAGEN opcional (§ MUESTRARIO-FOOTER-TARJETA-IMAGEN-1) — en el muestrario es el
// MAPA con marcador (`.map-card`/`.map-cap` del prototipo, líneas 348-361), pero es una imagen que
// el dueño SUBE, no una integración de mapas. `tieneTarjeta` gatea sobre `footer.tarjetaImagen`
// SOLO (mismo criterio que `SubscriptionCTALinea.tieneImagenFondo`): vacía → el layout de siempre,
// SIN wrapper de grid extra (byte-idéntico); con imagen, la marca pasa a la columna izquierda de un
// grid `1.1fr 1fr` (§ `.footer-top` del prototipo) y la tarjeta ocupa la derecha. `tarjetaTexto`
// SOLO, sin `tarjetaImagen`, NO rinde nada — sería un pie de foto flotando sobre nada.
function FooterApilado({ settings, footer, tienda, ayuda, empresa }: VariantProps) {
  const columnas: { titulo: string; links: { label: string; href: string }[] }[] = [
    { titulo: footer.columnaTienda, links: tienda },
    { titulo: footer.columnaAyuda, links: ayuda },
    ...(empresa.length > 0 ? [{ titulo: footer.columnaEmpresa, links: empresa }] : []),
  ];
  const tieneTarjeta = footer.tarjetaImagen.trim() !== "";

  const marca = (
    <>
      <Logo
        nombre={settings.nombre}
        variant="dark"
        stacked
        subtitle={settings.tagline}
        conMark={STOREFRONT_TIENE_MARK}
        className="items-start [&>div]:items-start"
      />
      <p className="mt-4 max-w-[40ch] text-base leading-relaxed text-[var(--sf-sobre)]/50">
        {settings.descripcionFooter}
      </p>
      <div className="mt-6 flex gap-3">
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
    </>
  );

  return (
    <footer className="bg-[var(--sf-tinta)] text-[var(--sf-sobre)]">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        {/* La marca ocupa el ancho completo arriba (§ `.footer-mark`/`.footer-top .tag` del
            prototipo) — mismo `Logo`/`descripcionFooter` que la canónica, sólo reordenado. Con
            tarjeta, comparte fila con ella (§ `.footer-top` del prototipo, grid 1.1fr/1fr). */}
        <div className="border-b border-white/10 pb-10">
          {tieneTarjeta ? (
            <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-start">
              <div>{marca}</div>
              <div className="relative min-h-[300px] overflow-hidden sf-radio-lg">
                <Image
                  src={footer.tarjetaImagen}
                  alt={footer.tarjetaTexto || ""}
                  fill
                  sizes="(min-width: 1024px) 480px, 100vw"
                  className="object-cover"
                />
                {footer.tarjetaTexto && (
                  <p className="absolute bottom-4 left-4 bg-[var(--sf-tarjeta)] px-3 py-1.5 text-xs text-[var(--sf-sobre-tarjeta,var(--sf-tinta))]">
                    {footer.tarjetaTexto}
                  </p>
                )}
              </div>
            </div>
          ) : marca}
        </div>

        {/* Las columnas debajo (§ `.footer-cols` del prototipo) — mismo dato que la canónica; el
            WhatsApp de contacto se cuelga de la última columna, como en `FooterColumnas`. */}
        <div className="grid grid-cols-1 gap-10 pt-10 sm:grid-cols-3">
          {columnas.map((col) => (
            <div key={col.titulo}>
              <h4 className="mb-4 text-sm font-semibold text-[var(--sf-sobre)]">{col.titulo}</h4>
              <ul className="space-y-2.5 text-sm text-[var(--sf-sobre)]/50">
                {col.links.map((link) => {
                  const external = link.href.startsWith("http");
                  return (
                    <li key={link.label}>
                      {external ? (
                        <a href={link.href} target="_blank" rel="noopener" className="transition-colors hover:text-[var(--sf-tostado)]">
                          {link.label}
                        </a>
                      ) : (
                        <Link href={link.href} className="transition-colors hover:text-[var(--sf-tostado)]">
                          {link.label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {settings.whatsapp && (
            <div className="text-sm text-[var(--sf-sobre)]/50">
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

      {/* Bottom Bar — idéntica a la canónica. */}
      <div className="sf-divisor-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-4 text-xs text-[var(--sf-sobre)]/30 sm:flex-row sm:px-6 lg:px-8">
          <p>
            © 2026 {settings.nombre}.
            Todos los derechos reservados.
          </p>

          {footer.items.length > 0 && (
            <div className="flex gap-4">
              {footer.items.map((link) => (
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
