'use client';

import TiendaHeroSeccion from '@/components/admin/TiendaHeroSeccion';

// ─── CONTENIDO DE LA TIENDA (el storefront) ──────────────────────────────────
//
// El contenido EDITORIAL del storefront —hoy, el hero de la home—. Es distinto de
// Configuración, que edita la IDENTIDAD del negocio (nombre, WhatsApp, correos); esta
// pantalla edita lo que el CLIENTE ve en la tienda (§ negocio≠tienda).
//
// v1: sólo el hero. Las otras secciones (BrandStory, Testimonials, SubscriptionCTA) entran
// acá como secciones nuevas, sobre el mismo modelo SiteContent.
export default function Tienda() {
  return (
    <div>
      <div style={{ minWidth: 0 }}>
        <h1 className="duna-display-m">Contenido de la tienda</h1>
        <p className="duna-sub" style={{ marginTop: '3px', maxWidth: '42rem' }}>
          Lo que el cliente ve en la home. La identidad del negocio —nombre, WhatsApp,
          correos— se edita en Configuración.
        </p>
      </div>

      <section style={{ marginTop: 'var(--duna-space-8)' }}>
        <TiendaHeroSeccion />
      </section>
    </div>
  );
}
