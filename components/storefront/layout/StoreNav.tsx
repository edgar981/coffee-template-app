"use client";
import { useState, useEffect } from 'react';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBag, Menu, X, Search } from 'lucide-react';
import { useCartStore } from '@/lib/cartStore';
import { motion, AnimatePresence } from 'framer-motion';
import NavSearch from './NavSearch';
import { Logo } from '@/components/storefront/Logo';
import { STOREFRONT_TIENE_MARK } from '@/lib/config/storefront-marca';
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { useSiteSettings } from '@/components/storefront/SiteSettingsProvider';
import { tratamientoNav } from '@/lib/config/esquema-style';
import { resolverOrden, varianteDeBanda, itemsDeMenu, menuCtaHref } from '@/lib/config/site-content-defaults';

export default function StoreNav() {
  const { nombre, tagline } = useSiteSettings();
  // El MENÚ es DATO (§ CROMO-MENU-COMO-DATO-1): `itemsDeMenu` resuelve las etiquetas + el orden
  // editables sobre el set CERRADO de tres ítems, y sigue gateando "Nosotros"/"Suscripciones" por
  // `paginas.*.visible`, SIN CAMBIO (renombrar no es encender). Con `content.menu` en su default —
  // ningún tenant lo edita— `links` es EXACTAMENTE el array de hoy: label/path de las tres rutas, en
  // el mismo orden. El CTA (`menuCtaHref`) nace apagado (`null`) hasta que el dueño lo configure.
  const content = useSiteContent();
  const { esquemas, tema, orden, cromo } = content;
  const links = itemsDeMenu(content);
  const ctaHref = menuCtaHref(content);

  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { count, openCart } = useCartStore();
  const pathname = usePathname();
  const isHome = pathname === '/';

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  // El nav trata a la PRIMERA banda del orden (§ eje 5 parte c) con UNA sola regla,
  // `tratamientoNav` (esquema-style.ts): flota TRANSPARENTE sólo en home+sin-scroll Y sobre una
  // banda UNIFORME; si flota, su TEXTO va claro sólo si esa banda queda OSCURA. CON esquema
  // asignado la darkness es el cálculo de contraste de siempre; SIN esquema es la CANÓNICA
  // declarada de la banda (`bandaOscuraCanonica` en site-content-defaults.ts: hero/brandStory/
  // subscriptionCTA oscuras, el resto claras) — YA NO asume que la primera banda es siempre el
  // hero. El orden default arranca en 'hero' con variante 'curtina' (uniforme, oscura, sin
  // esquema) → byte-idéntico al `isHome && !scrolled` de hoy.
  //
  // MINA CERRADA (era HUECO CONOCIDO): `heroEsOscuro` era específica del hero y su fallback SIN
  // esquema asumía SIEMPRE la canónica del hero (oscura) para CUALQUIER banda primera — correcto
  // sólo mientras `orden[0]` era necesariamente 'hero'. El eje 5 (el orden como dato) rompió esa
  // garantía; `bandaEsOscura` toma la canónica DE LA BANDA que resulte primera, no la del hero.
  //
  // MINA CERRADA #2 (§ EJE-5-VARIANTES-HERO): la canónica de la banda primera dejó de ser fija cuando
  // el hero ganó variantes de composición — 'ficha' es CLARA, al revés de 'curtina'. `bandaEsOscura`
  // ahora recibe también la VARIANTE de esa banda (`varianteDeBanda`); sin esto, un hero·ficha
  // primero-y-sin-esquema habría dejado el nav con texto claro sobre banda clara.
  //
  // MINA CERRADA #3 (§ EJE-5-NAV-UNIFORME): flotar transparente ASUMÍA que la primera banda siempre
  // admite un único color de texto — cierto mientras esa banda era la curtina (foto oscura a sangre)
  // o un esquema asignado (un solo color derivado). La ficha del hero es BI-TONAL —crema a la
  // izquierda, foto oscura a la derecha— y ningún color único se lee sobre las dos mitades; el gate
  // visual del owner lo encontró (texto oscuro del nav ilegible sobre la foto). `tratamientoNav`
  // pregunta PRIMERO si la banda es uniforme (`bandaUniforme`, § site-content-defaults.ts): si no lo
  // es, el nav cae a SÓLIDO desde el primer render, sin importar scroll ni esquema.
  const primera = resolverOrden(orden)[0];
  const t = tratamientoNav(primera, varianteDeBanda(content, primera), esquemas, tema.fondo, tema.tinta, tema.acento);
  // `cromo.navTinta` (§ CROMO-NAV-FOOTER-TEMATIZABLE-1): declaración OPCIONAL del preset — el nav es
  // una banda `--sf-tinta` SÓLIDA SIEMPRE, sin importar home/scroll. `false` (todo tenant salvo el
  // que lo declare, § CORTE en themes.ts) → el `tratamientoNav`/`navFlotando` de HOY, exacto, sin
  // tocar. `true` BYPASSA el floating por completo: nunca transparente, nunca cae a la tarjeta clara
  // del scroll de hoy — reusa `navClaro` para el resto de la fila (link/ícono/logo), como la banda
  // oscura flotante ya hacía.
  const navBandaTinta = cromo.navTinta;
  const navFlotando = !navBandaTinta && isHome && !scrolled && t.flotante;
  const navClaro = navBandaTinta || (navFlotando && t.textoClaro);

  const navBg = navBandaTinta
    ? 'bg-[var(--sf-tinta)] shadow-sm text-[var(--sf-sobre)]'
    : navFlotando
      ? (navClaro ? 'bg-transparent text-[var(--sf-sobre)]' : 'bg-transparent text-[var(--sf-tinta)]')
      : 'bg-[var(--sf-tarjeta)]/95 backdrop-blur shadow-sm text-[var(--sf-tinta)]';

  const linkColor = navClaro ? 'text-[var(--sf-sobre)]/80 hover:text-[var(--sf-sobre)]' : 'text-[var(--sf-texto)] hover:text-[var(--sf-tinta)]';
  const iconColor = navClaro ? 'text-[var(--sf-sobre)]/80 hover:text-[var(--sf-sobre)]' : 'text-[var(--sf-texto)] hover:text-[var(--sf-tinta)]';
  // El logo del nav (§ CROMO-NAV-FOOTER-TEMATIZABLE-1): `cromo.navSubtitulo` exhibe el `tagline`
  // bajo el nombre (REUSA `Logo.subtitle`, que ya existe para el footer, § Logo.tsx) — `false` (el
  // default) → `subtitle` queda `undefined` y `Logo` renderiza EXACTAMENTE su rama de siempre.
  const logoLink = (
    <Link href="/" aria-label={`${nombre} — inicio`} className="transition-colors">
      {/* Cream lockup over the transparent hero, espresso once scrolled */}
      <Logo
        nombre={nombre}
        variant={navClaro ? 'dark' : 'light'}
        conMark={STOREFRONT_TIENE_MARK}
        subtitle={cromo.navSubtitulo ? tagline : undefined}
      />
    </Link>
  );

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${navBg}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-18">
            {/* Logo (§ CROMO-NAV-FOOTER-TEMATIZABLE-1): el badge de `cromo.navBadge` sólo envuelve el
                logo en un flex propio cuando HAY texto — vacío (el default) deja `logoLink` como
                único hijo, sin un <div> extra alrededor, byte-idéntico a hoy. */}
            {cromo.navBadge ? (
              <div className="flex items-center gap-3">
                {logoLink}
                <span className={`hidden sm:inline-flex items-center px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${navClaro ? 'bg-[var(--sf-sobre)]/10 text-[var(--sf-sobre)]' : 'bg-[var(--sf-tinta)]/5 text-[var(--sf-tinta)]'}`}>
                  {cromo.navBadge}
                </span>
              </div>
            ) : logoLink}

            {/* Desktop Nav */}
            <nav className="relative hidden lg:flex items-center gap-8">
              {links.map(l => (
                <Link key={l.path} href={l.path} className={`text-sm font-medium transition-colors ${linkColor} ${pathname.startsWith(l.path) ? 'text-[var(--sf-acento-texto)]!' : ''}`}>
                  {l.label}
                </Link>
              ))}
              {/* El CTA del menú (§ CROMO-MENU-COMO-DATO-1): apagado por defecto (`ctaHref` null), así
                  que Nayoli no gana nada acá. Se pinta como ACCIÓN —un botón, no un link plano—,
                  tomando la FORMA del bloque `/cuenta` muerto de más abajo (pill con fondo de tinte),
                  no su destino ni su contenido. */}
              {ctaHref && (
                <Link
                  href={ctaHref}
                  className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors ${navClaro ? 'bg-[var(--sf-sobre)]/10 text-[var(--sf-sobre)] hover:bg-[var(--sf-sobre)]/20' : 'bg-[var(--sf-acento)]/10 text-[var(--sf-acento-4)] hover:bg-[var(--sf-acento)]/20'}`}
                >
                  {content.menu.ctaLabel}
                </Link>
              )}
            </nav>

            <NavSearch
  isOpen={searchOpen}
  onClose={() =>
    setSearchOpen(false)
  }
/>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button className={`p-2 cursor-pointer rounded-full transition-colors ${iconColor}`} onClick={() => setSearchOpen(true)}>
                <Search className="w-5 h-5" />
              </button>
              <button onClick={openCart} className={`relative p-2 rounded-full transition-colors ${iconColor} cursor-pointer`}>
                <ShoppingBag className="w-5 h-5" />
                {count > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-[var(--sf-acento)] text-[var(--sf-acento-txt)] text-[10px] rounded-full flex items-center justify-center font-bold" style={{ width: 18, height: 18, fontSize: 10 }}>
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </button>
              {/* v1: /cuenta link hidden — restore when account feature ships */}
              {/* <Link href="/cuenta" className={`hidden sm:flex items-center ml-1 text-sm font-medium rounded-full transition-colors ${linkColor}`}>
                <button className={`p-2 pt-1.5 cursor-pointer rounded-full transition-colors ${iconColor} bg-[var(--sf-acento)]/10`}>
                  <span className="text-xs font-bold text-[var(--sf-acento-4)]">Mi</span>
                </button>
              </Link> */}
              <button className={`lg:hidden p-2 ${iconColor}`} onClick={() => setMobileOpen(!mobileOpen)}>
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu — `cromo.navTinta` NO lo toca: el spec de CROMO-NAV-FOOTER-TEMATIZABLE-1 acota
          la superficie al header fijo (banda/logo/sub-encabezado/badge), no al drawer móvil. */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="fixed top-16 left-0 right-0 z-40 bg-[var(--sf-tarjeta)] shadow-lg sf-divisor-b border-[var(--sf-linea)]">
            <nav className="relative flex flex-col px-4 py-4 gap-4">
              {links.map(l => (
                <Link key={l.path} href={l.path} onClick={() => setMobileOpen(false)} className="text-[var(--sf-acento-2)] font-medium py-2 sf-divisor-b border-[var(--sf-superficie)] last:border-0">{l.label}</Link>
              ))}
              {/* El CTA del menú (§ CROMO-MENU-COMO-DATO-1), la misma pieza que el desktop nav —
                  pintada como acción, no como link plano—. */}
              {ctaHref && (
                <Link
                  href={ctaHref}
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium bg-[var(--sf-acento)]/10 text-[var(--sf-acento-4)]"
                >
                  {content.menu.ctaLabel}
                </Link>
              )}
              {/* v1: /cuenta link hidden — restore when account feature ships */}
              {/* <Link href="/cuenta" onClick={() => setMobileOpen(false)} className="text-[var(--sf-acento-2)] font-medium py-2">Mi Cuenta</Link> */}
              <Link href="/rastrear-pedido" onClick={() => setMobileOpen(false)} className="text-[var(--sf-acento-2)] font-medium py-2">Rastrear Pedido</Link>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}