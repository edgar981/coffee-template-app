"use client";

import Image from "next/image";
import { MessageCircle } from "lucide-react";

import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useSiteSettings } from "@/components/storefront/SiteSettingsProvider";
import { urlDeRedSocial, type RedSocialGuardada } from "@/lib/config/site";

// RielSocial (§ CROMO-RIEL-SOCIAL-1) — gemelo tematizable del `.rail` del prototipo
// (`docs/prototipos/cafeone/css/app.css:326-338`, `index.html:109-115`): un nav vertical fijo a la
// izquierda, centrado verticalmente, pastilla, superficie `--sf-tinta` con íconos en el sobre-tinta
// (`--sf-sobre`). Sólo visible a `min-width:1560px` (§ el prototipo, `css/app.css:339`).
//
// GATEADO por `content.rielSocial.visible` (`RielSocialContent`, § site-content-defaults.ts):
// AUSENTE/`false` = el comportamiento de HOY — este componente rinde `null`, así que Nayoli y
// cualquier tenant que no declare el eje quedan BYTE-IDÉNTICOS (ni un nodo nuevo en el árbol). Sólo
// CORTE lo enciende (`themes.ts`). Se monta SIEMPRE desde el layout (`app/(storefront)/layout.tsx`,
// como StoreNav/StoreFooter/CartDrawer/BackToTop) y decide su propio silencio adentro — el MISMO
// mecanismo que `BackToTop`.
//
// LOS LINKS SALEN DE `SiteSetting.redes` (§ MUESTRARIO-REDES-ADICIONALES-1) — LA MISMA FUENTE
// ÚNICA que ya usa `StoreFooter` (vía `useSiteSettings()` + `parseRedesSociales`/`urlDeRedSocial`,
// `lib/config/site.ts`). Reemplaza la lectura directa de `settings.instagram`/`.whatsapp`: esas
// dos columnas se BACKFILLEARON a `redes` en la migración que la creó, y desde ahí cada
// representación es dueña de la suya (§ el docstring de `SiteSetting.redes`, schema.prisma). Cada
// botón se oculta cuando su red no está en la lista (idéntico al footer — un enlace a
// instagram.com/ o wa.me/ sin handle/número es un botón muerto); si la lista está vacía, el riel
// entero no se monta (una pastilla vacía no es chrome, es un hueco).
//
// EL ASSET ES POR-TIPO (`iconoDeRed`, abajo): Instagram usa el MISMO `/icons/instagram-white.svg`
// que ya usa `StoreFooter` (reusado, no un segundo SVG de marca); WhatsApp usa el MISMO
// `MessageCircle` de lucide que el footer (no hay ícono de marca en lucide 1.x, § ChipCanal.tsx).
// Facebook/X/Pinterest NO TIENEN asset en el repo — ni SVG propio, ni lucide 1.16 los trae
// (verificado: sin Facebook/Twitter/Pinterest en `node_modules/lucide-react`) — así que rinden
// SIN ícono, el hueco textual del handle/URL como contenido visible del botón (§ el spec: "no
// inventes un SVG"). El asset es decisión del owner — este componente no lo suple.
function iconoDeRed(red: RedSocialGuardada) {
  if (red.tipo === "instagram") return <Image src="/icons/instagram-white.svg" alt="" width={18} height={18} />;
  if (red.tipo === "whatsapp") return <MessageCircle className="h-[18px] w-[18px]" aria-hidden="true" />;
  return null;
}

const LABEL_RED: Record<RedSocialGuardada["tipo"], string> = {
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  x: "X",
  pinterest: "Pinterest",
};

// HOVER a opacidad reducida, EL VALOR EXACTO del prototipo (`.rail a:hover{opacity:.62}`,
// `css/app.css:337`) — no el tratamiento de fondo-con-tinte que usa `StoreFooter` para las mismas
// redes: son dos composiciones distintas del mismo dato, cada una con la afordancia de SU
// prototipo/pantalla de origen.
export default function RielSocial() {
  const { rielSocial } = useSiteContent();
  const settings = useSiteSettings();

  if (!rielSocial.visible) return null;
  if (settings.redes.length === 0) return null;

  return (
    <nav
      aria-label="Redes sociales"
      className="fixed left-6 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-1 sf-pildora bg-[var(--sf-tinta)] px-1.5 py-3 min-[1560px]:flex"
    >
      {settings.redes.map((red) => (
        <a
          key={red.tipo}
          href={urlDeRedSocial(red)}
          target="_blank"
          rel="noopener"
          aria-label={`${LABEL_RED[red.tipo]} de ${settings.nombre}`}
          className="flex h-8 w-8 items-center justify-center sf-pildora text-[var(--sf-sobre)] transition-opacity hover:opacity-[.62]"
        >
          {iconoDeRed(red)}
        </a>
      ))}
    </nav>
  );
}
