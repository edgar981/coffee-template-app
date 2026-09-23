"use client";

import Image from "next/image";
import { MessageCircle } from "lucide-react";

import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useSiteSettings } from "@/components/storefront/SiteSettingsProvider";
import { instagramUrl, whatsappUrl } from "@/lib/config/site";

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
// LOS DOS LINKS SON `SiteSetting.instagram`/`SiteSetting.whatsapp` — LA MISMA FUENTE ÚNICA que ya
// usa `StoreFooter` (vía `useSiteSettings()` + `instagramUrl`/`whatsappUrl`, `lib/config/site.ts`).
// No es un modelo de redes nuevo: es el MISMO dato, en OTRA composición. Cada botón se oculta cuando
// su campo está vacío (idéntico al footer — un enlace a instagram.com/ o wa.me/ sin número es un
// botón muerto); si los DOS están vacíos, el riel entero no se monta (una pastilla vacía no es
// chrome, es un hueco).
//
// El ASSET de Instagram es el MISMO `/icons/instagram-white.svg` que ya usa `StoreFooter` (`fill:
// #fff`, atenuado con opacidad) — reusado, no un segundo SVG de marca. WhatsApp usa el MISMO
// `MessageCircle` de lucide que el footer (no hay ícono de marca en lucide 1.x, § ChipCanal.tsx).
//
// HOVER a opacidad reducida, EL VALOR EXACTO del prototipo (`.rail a:hover{opacity:.62}`,
// `css/app.css:337`) — no el tratamiento de fondo-con-tinte que usa `StoreFooter` para sus mismos
// dos botones: son dos composiciones distintas del mismo dato, cada una con la afordancia de SU
// prototipo/pantalla de origen.
export default function RielSocial() {
  const { rielSocial } = useSiteContent();
  const settings = useSiteSettings();

  if (!rielSocial.visible) return null;
  if (!settings.instagram && !settings.whatsapp) return null;

  return (
    <nav
      aria-label="Redes sociales"
      className="fixed left-6 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-1 sf-pildora bg-[var(--sf-tinta)] px-1.5 py-3 min-[1560px]:flex"
    >
      {settings.instagram && (
        <a
          href={instagramUrl(settings.instagram)}
          target="_blank"
          rel="noopener"
          aria-label={`Instagram de ${settings.nombre}`}
          className="flex h-8 w-8 items-center justify-center sf-pildora text-[var(--sf-sobre)] transition-opacity hover:opacity-[.62]"
        >
          <Image src="/icons/instagram-white.svg" alt="" width={18} height={18} />
        </a>
      )}

      {settings.whatsapp && (
        <a
          href={whatsappUrl(settings.whatsapp)}
          target="_blank"
          rel="noopener"
          aria-label={`WhatsApp de ${settings.nombre}`}
          className="flex h-8 w-8 items-center justify-center sf-pildora text-[var(--sf-sobre)] transition-opacity hover:opacity-[.62]"
        >
          <MessageCircle className="h-[18px] w-[18px]" aria-hidden="true" />
        </a>
      )}
    </nav>
  );
}
