"use client";
import { useSiteSettings } from '@/components/storefront/SiteSettingsProvider';
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { navOffsetClase } from '@/lib/config/themes';
import SuscripcionPlanes from '@/components/storefront/suscripciones/SuscripcionPlanes';
import SuscripcionPasos from '@/components/storefront/suscripciones/SuscripcionPasos';
import PreguntasFrecuentes from '@/components/storefront/PreguntasFrecuentes';

// El CUERPO de /suscripciones (cliente). El GATE de capacidad —redirect 307 cuando
// `paginas.suscripciones.visible` es false— vive en el `page.tsx` server (§ Backlog #49, opción 2),
// igual que /nosotros: la página EXISTE y sólo está apagada, así que redirige a la home, no da 404.
//
// El encabezado y los PLANES son DATO editable (§ Backlog #49, opción 1): viven en la sección
// `suscripcionPlanes` de SiteContent, renderizada por `SuscripcionPlanes` —el MISMO componente que la
// vista previa del editor monta—. El `whatsapp` (para el CTA "Me interesa", que abre WhatsApp, no crea
// pedidos) sale de SiteSetting (una sola fuente) y se pasa por PROP: el componente se monta también en
// el preview del panel, que no tiene el SiteSettingsProvider del storefront. Las PreguntasFrecuentes
// son DATO editable, sección repeater (§ SUSCRIPCIONES-FAQ-DATO-1) que NACE VACÍA — sus cuatro
// respuestas de código (RETIRADAS) prometían cobro recurrente, ciclos y envío gratis que no existen
// en el sistema. Se auto-oculta (hide-on-empty) hasta que el owner cargue preguntas reales.
//
// EL RELLENO SUPERIOR (§ NAV-INTERNAS-CLARO-Y-OFFSET-1, cierra SUSCRIPCIONES-OFFSET-CONTENIDO-FUERA-
// DE-TOUCHES-1): usa `navOffsetClase(navTratamiento.posicion)`, la MISMA pieza que ya usan las otras
// seis páginas internas (tienda, la ficha, preguntas-frecuentes, rastrear-pedido, checkout y su
// retorno) — no un `pt-16` propio. `false` (todo tenant salvo CORTE) = `'pt-16'`, byte a byte lo que
// este archivo ya reservaba; `page.tsx` YA NO envuelve con `navOffsetDeltaClase` (ese wrapper existía
// SÓLO porque este archivo estaba fuera de `touches:` cuando se escribió — ver el asiento de
// DECISIONS.md de esa tanda).
export default function SuscripcionesContenido() {
  const settings = useSiteSettings();
  const { navTratamiento } = useSiteContent();
  const offsetClase = navOffsetClase(navTratamiento.posicion);
  return (
    <div className={offsetClase}>
      <SuscripcionPlanes whatsapp={settings.whatsapp} />
      <SuscripcionPasos />
      <main className="bg-[var(--sf-fondo)]">
        <PreguntasFrecuentes />
      </main>
    </div>
  );
}
