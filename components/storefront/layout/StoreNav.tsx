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
import { bandaEsOscura } from '@/lib/config/esquema-style';
import { resolverOrden } from '@/lib/config/site-content-defaults';

export default function StoreNav() {
  const { nombre } = useSiteSettings();
  // "Nosotros" es RUTA (/nosotros), y sólo aparece si la página está ENCENDIDA (§ paginas.nosotros).
  // Apagada, el enlace desaparece. Antes era un ancla a la home (`/#nuestra-historia`), cuyo
  // active-state por `pathname.startsWith` nunca matcheaba —la ruta real lo arregla—.
  const { paginas, esquemas, tema, orden } = useSiteContent();
  const links = [
    { label: 'Tienda', path: '/tienda' },
    // Suscripciones y Nosotros son CAPACIDADES apagables: su link aparece sólo si la página está viva
    // (§ paginas.*.visible). Un link a una página que redirige a la home sería un enlace muerto.
    ...(paginas.suscripciones.visible ? [{ label: 'Suscripciones', path: '/suscripciones' }] : []),
    ...(paginas.nosotros.visible ? [{ label: 'Nosotros', path: '/nosotros' }] : []),
  ];

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

  // El nav flota TRANSPARENTE sólo en home+sin-scroll (sobre la PRIMERA banda del orden, § eje 5
  // parte c); su TEXTO va claro sólo si, además, esa banda queda OSCURA (§ `bandaEsOscura`,
  // EJE-5-ORDEN-NAV-CANONICA). CON esquema asignado es el cálculo de contraste de siempre; SIN
  // esquema es la CANÓNICA declarada de la banda (`BANDAS_OSCURAS` en site-content-defaults.ts:
  // hero/brandStory/subscriptionCTA oscuras, el resto claras) — YA NO asume que la primera banda es
  // siempre el hero. El orden default arranca en 'hero' (oscura, sin esquema) → byte-idéntico al
  // `isHome && !scrolled` de hoy.
  //
  // MINA CERRADA (era HUECO CONOCIDO): `heroEsOscuro` era específica del hero y su fallback SIN
  // esquema asumía SIEMPRE la canónica del hero (oscura) para CUALQUIER banda primera — correcto
  // sólo mientras `orden[0]` era necesariamente 'hero'. El eje 5 (el orden como dato) rompió esa
  // garantía; `bandaEsOscura` toma la canónica DE LA BANDA que resulte primera, no la del hero.
  const navFlotando = isHome && !scrolled;
  const primera = resolverOrden(orden)[0];
  const navClaro = navFlotando && bandaEsOscura(primera, esquemas, tema.fondo, tema.tinta, tema.acento);

  const navBg = navFlotando
    ? (navClaro ? 'bg-transparent text-[var(--sf-sobre)]' : 'bg-transparent text-[var(--sf-tinta)]')
    : 'bg-[var(--sf-tarjeta)]/95 backdrop-blur shadow-sm text-[var(--sf-tinta)]';

  const linkColor = navClaro ? 'text-[var(--sf-sobre)]/80 hover:text-[var(--sf-sobre)]' : 'text-[var(--sf-texto)] hover:text-[var(--sf-tinta)]';
  const iconColor = navClaro ? 'text-[var(--sf-sobre)]/80 hover:text-[var(--sf-sobre)]' : 'text-[var(--sf-texto)] hover:text-[var(--sf-tinta)]';

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${navBg}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-18">
            {/* Logo */}
            <Link href="/" aria-label={`${nombre} — inicio`} className="transition-colors">
              {/* Cream lockup over the transparent hero, espresso once scrolled */}
              <Logo nombre={nombre} variant={navClaro ? 'dark' : 'light'} conMark={STOREFRONT_TIENE_MARK} />
            </Link>

            {/* Desktop Nav */}
            <nav className="relative hidden lg:flex items-center gap-8">
              {links.map(l => (
                <Link key={l.path} href={l.path} className={`text-sm font-medium transition-colors ${linkColor} ${pathname.startsWith(l.path) ? 'text-[var(--sf-acento-texto)]!' : ''}`}>
                  {l.label}
                </Link>
              ))}
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

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="fixed top-16 left-0 right-0 z-40 bg-[var(--sf-tarjeta)] shadow-lg sf-divisor-b border-[var(--sf-linea)]">
            <nav className="relative flex flex-col px-4 py-4 gap-4">
              {links.map(l => (
                <Link key={l.path} href={l.path} onClick={() => setMobileOpen(false)} className="text-[var(--sf-acento-2)] font-medium py-2 sf-divisor-b border-[var(--sf-superficie)] last:border-0">{l.label}</Link>
              ))}
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