"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { motion } from "framer-motion";

import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useCartStore } from "@/lib/cartStore";

// BackToTop (§ CROMO-VOLVER-ARRIBA-1) — gemelo tematizable del `.to-top` del prototipo
// (`docs/prototipos/cafeone/css/app.css:340-353`, `js/app.js:356-365`): una pastilla fija
// abajo-derecha que aparece tras scrollear y lleva de vuelta al tope.
//
// GATEADO por `content.volverArriba.visible` (`VolverArribaContent`, § site-content-defaults.ts):
// AUSENTE/`false` = el comportamiento de HOY — este componente rinde `null`, así que Nayoli y
// cualquier tenant que no declare el eje quedan BYTE-IDÉNTICOS (ni un nodo nuevo en el árbol). Sólo
// CORTE lo enciende (`themes.ts`). Se monta SIEMPRE desde el layout (`app/(storefront)/layout.tsx`,
// como StoreNav/StoreFooter/CartDrawer) y decide su propio silencio adentro — el MISMO mecanismo que
// `Marquesina`/`Origen` (montadas siempre, `seccionEsVisible` decide el `null`).
//
// EL UMBRAL: `window.scrollY > window.innerHeight` — el del PROTOTIPO (`js/app.js:361`), no los
// `window.scrollY > 20` de `StoreNav` (que decide un cambio de FONDO del nav, apenas se despega el
// tope). Acá se está montando un control flotante nuevo que no debe competir con el hero recién
// visto; un viewport completo de scroll es lo que el prototipo mide.
//
// SE OCULTA con el carrito abierto (`useCartStore().isOpen`) — el gemelo de `body.drawer-open
// .to-top{opacity:0}` del prototipo (`css/app.css:352`): dos superficies flotantes compitiendo por
// la esquina inferior derecha es ruido, no chrome.
//
// COLOR: fondo `--sf-accion`, ícono `--sf-tinta` — EL MISMO PAR que ya visten los 5 CTA primarios
// del storefront (HeroCurtina/HeroFicha/HeroMedia/SubscriptionCTABloque/SubscriptionCTALinea,
// `bg-[var(--sf-accion,var(--sf-tostado))] … text-[var(--sf-tinta)]`) — NO un token
// `--sf-accion-texto` (no existe en este sistema): el prototipo llama a ese rol `--text-on-accent`
// (`css/app.css:342`), y acá ese rol ya lo cumple `--sf-tinta` sobre `--sf-accion`.
//
// MOVIMIENTO REDUCIDO: el canal es `ReducedMotionProvider` (`app/(storefront)/layout.tsx`,
// `<MotionConfig reducedMotion="user">`, § `lib/animation.ts`) — con la preferencia activa, congela
// el `y` (transform) de la transición de abajo y deja sólo el fundido de opacidad. Ningún `@media`
// propio.
export default function BackToTop() {
  const { volverArriba } = useSiteContent();
  const { isOpen } = useCartStore();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const check = () => setScrolled(window.scrollY > window.innerHeight);
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, []);

  if (!volverArriba.visible) return null;

  const visible = scrolled && !isOpen;

  return (
    <motion.button
      type="button"
      aria-label="Volver arriba"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      initial={false}
      animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 8 }}
      className={`fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center sf-pildora bg-[var(--sf-accion,var(--sf-tostado))] text-[var(--sf-tinta)] shadow-lg transition-colors hover:bg-[var(--sf-tostado-4)] ${
        visible ? "" : "pointer-events-none"
      }`}
    >
      <ArrowUp className="h-5 w-5" aria-hidden="true" />
    </motion.button>
  );
}
