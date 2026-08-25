'use client';

import TiendaPreview from '@/components/admin/TiendaPreview';

// ─── CONTENIDO DE LA TIENDA (el storefront) ──────────────────────────────────
//
// El contenido EDITORIAL del storefront —hoy, el hero de la home—. Es distinto de
// Configuración, que edita la IDENTIDAD del negocio (nombre, WhatsApp, correos); esta
// pantalla edita lo que el CLIENTE ve en la tienda (§ negocio≠tienda).
//
// v1: sólo el hero. Las otras secciones (BrandStory, Testimonials, SubscriptionCTA) entran
// acá como secciones nuevas, sobre el mismo modelo SiteContent.
export default function Tienda() {
  // `.duna-sin-split`: pantalla de ALTO FIJO (gate 960). Es lo que hace que el pane de la
  // vista previa herede su altura del chrome en vez de calcularla contra el viewport —un
  // `100vh`/`calc` suelto en el root está prohibido (§ la cadena de altura / #42)—. El split
  // es una anatomía de "dos columnas que scrollean", que encaja mejor en alto fijo que en
  // document-scroll; su regla de scroll conviene a este layout (§ los DOS modelos de scroll).
  return (
    <div className="duna-sin-split">
      <div style={{ minWidth: 0, marginBottom: 'var(--duna-space-4)' }}>
        <h1 className="duna-display-m">Contenido de la tienda</h1>
        <p className="duna-sub" style={{ marginTop: '3px', maxWidth: '42rem' }}>
          Lo que el cliente ve en la home. La identidad del negocio —nombre, WhatsApp,
          correos— se edita en Configuración.
        </p>
      </div>

      <TiendaPreview />
    </div>
  );
}
