"use client";
import { useState, useEffect } from 'react';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBag, Menu, X, Search, Coffee } from 'lucide-react';
import { useCartStore } from '@/lib/cartStore';
import { motion, AnimatePresence } from 'framer-motion';
import NavSearch from './NavSearch';

const links = [
  { label: 'Tienda', path: '/tienda' },
  { label: 'Suscripciones', path: '/suscripciones' },
  { label: 'Nosotros', path: '/nosotros' },
];

export default function StoreNav() {
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

  const navBg = isHome && !scrolled
    ? 'bg-transparent text-white'
    : 'bg-white/95 backdrop-blur shadow-sm text-[#1a0f08]';

  const logoColor = isHome && !scrolled ? 'text-white' : 'text-[#1a0f08]';
  const linkColor = isHome && !scrolled ? 'text-white/80 hover:text-white' : 'text-[#5a3a28] hover:text-[#1a0f08]';
  const iconColor = isHome && !scrolled ? 'text-white/80 hover:text-white' : 'text-[#5a3a28] hover:text-[#1a0f08]';

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${navBg}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-18">
            {/* Logo */}
            <Link href="/" className={`flex items-center gap-2 font-playfair font-medium text-lg ${logoColor} transition-colors`}>
              <Coffee className="w-5 h-5" />
              Sierra Nativa
            </Link>

            {/* Desktop Nav */}
            <nav className="relative hidden lg:flex items-center gap-8">
              {links.map(l => (
                <Link key={l.path} href={l.path} className={`text-sm font-medium transition-colors ${linkColor} ${pathname.startsWith(l.path) ? 'text-[#8B4513]!' : ''}`}>
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
                  <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-[#8B4513] text-white text-[10px] rounded-full flex items-center justify-center font-bold" style={{ width: 18, height: 18, fontSize: 10 }}>
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </button>
              <Link href="/cuenta" className={`hidden sm:flex items-center ml-1 text-sm font-medium rounded-full transition-colors ${linkColor}`}>
                <button className={`p-2 pt-1.5 cursor-pointer rounded-full transition-colors ${iconColor} bg-[#8B4513]/10`}>
                  <span className="text-xs font-bold text-[#b5794e]">Mi</span>
                </button>
              </Link>
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
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="fixed top-16 left-0 right-0 z-40 bg-white shadow-lg border-b border-[#e8ddd0]">
            <nav className="relative flex flex-col px-4 py-4 gap-4">
              {links.map(l => (
                <Link key={l.path} href={l.path} onClick={() => setMobileOpen(false)} className="text-[#3d2314] font-medium py-2 border-b border-[#f0e8de] last:border-0">{l.label}</Link>
              ))}
              <Link href="/cuenta" onClick={() => setMobileOpen(false)} className="text-[#3d2314] font-medium py-2">Mi Cuenta</Link>
              <Link href="/rastrear-pedido" onClick={() => setMobileOpen(false)} className="text-[#3d2314] font-medium py-2">Rastrear Pedido</Link>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}