"use client";
import { useSiteSettings } from '@/components/storefront/SiteSettingsProvider';
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
// siguen como componente aparte (§ Backlog #63: su copy café-shape es otra superficie, otra tanda).
export default function SuscripcionesContenido() {
  const settings = useSiteSettings();
  return (
    <div className="pt-16">
      <SuscripcionPlanes whatsapp={settings.whatsapp} />
      <SuscripcionPasos />
      <main className="bg-[var(--sf-fondo)]">
        <PreguntasFrecuentes />
      </main>
    </div>
  );
}
