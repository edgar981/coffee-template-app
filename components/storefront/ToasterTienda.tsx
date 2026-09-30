'use client';

import type { CSSProperties } from 'react';
import { Toaster } from 'sonner';

import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { corteAplicado } from '@/lib/config/themes';
import { configToasterTienda } from '@/lib/storefront/toast-tienda';

// ToasterTienda (§ TOAST-COMO-PROTOTIPO-1) — el ÚNICO Toaster de la tienda. El genérico de
// `app/layout.tsx` (`components/ui/sonner.tsx`) se apaga fuera de admin/pre-auth precisamente para
// dejarle el paso: sonner es un store GLOBAL — dos `<Toaster>` sin `id` muestran el MISMO aviso dos
// veces —, así que "un solo Toaster activo por ruta" exige que uno de los dos calle, y el que calla
// es el genérico en cuanto la ruta no es admin. Se monta SIEMPRE desde el layout del storefront
// (como StoreNav/CartDrawer/BackToTop/RielSocial/ScrollInercia) y decide su propio estilo adentro —
// el MISMO mecanismo que esos cuatro: "decide su propio silencio adentro".
//
// GATEADO por `corteAplicado(content.tema.origenAccion)` (`lib/config/themes.ts`), el MISMO gate
// que ScrollInercia/BackToTop/RielSocial/EntradaPagina: AUSENTE/`null` (Nayoli y todo tenant sin
// CORTE) → `configToasterTienda(false)`, la config EXACTA que tenía el Toaster de `app/layout.tsx`
// antes de este slice (richColors, top-center) — byte a byte. Sólo CORTE toma el estilo
// `.toast`/`.toast.is-open` del prototipo (banda oscura del tema, texto claro, esquinas rectas,
// abajo a la izquierda, con su entrada — la de sonner, que ya respeta `prefers-reduced-motion` de
// fábrica: sin desplazamiento con movimiento reducido, sin tocar nada acá).
//
// El `className="toast-tienda"` SÓLO se agrega con CORTE (`config.vars` no-null): es lo que
// escopea la regla de `app/globals.css` que distingue el error con un filete del acento — sin él,
// esa regla también pintaría el error de Nayoli (mismo `--sf-acento`, cualquier tenant), que es
// justo el cambio que este slice no debe hacer.
export default function ToasterTienda() {
  const { tema } = useSiteContent();
  const config = configToasterTienda(corteAplicado(tema.origenAccion));

  return (
    <Toaster
      className={config.vars ? 'toast-tienda' : undefined}
      position={config.position}
      richColors={config.richColors}
      duration={config.duration}
      style={config.vars as CSSProperties | undefined}
    />
  );
}
