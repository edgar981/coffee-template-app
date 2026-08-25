import TiendaSeccionEditor from '@/components/admin/TiendaSeccionEditor';
import { SECCIONES_TIENDA } from '@/components/admin/tienda-secciones';

// ─── CONTENIDO DE LA TIENDA (el storefront) ──────────────────────────────────
//
// El contenido EDITORIAL del storefront —hoy, el hero y la Historia de la home—. Distinto de
// Configuración, que edita la IDENTIDAD del negocio (§ negocio≠tienda).
//
// Cada sección (`TiendaSeccionEditor`) trae su VISTA PREVIA EN VIVO (componentes reales del
// storefront alimentados por el form) + read↔edit + autoguardado. La cáscara es una sola; lo que
// cambia entre secciones es la config (§ tienda-secciones). La "home completa en una vista" (una
// sección sobre otra) es su propio disparador —hoy cada sección se ve por separado—.
export default function Tienda() {
  return (
    <div>
      <div style={{ minWidth: 0, marginBottom: 'var(--duna-space-4)' }}>
        <h1 className="duna-display-m">Contenido de la tienda</h1>
        <p className="duna-sub" style={{ marginTop: '3px', maxWidth: '42rem' }}>
          Lo que el cliente ve en la home. La identidad del negocio —nombre, WhatsApp,
          correos— se edita en Configuración.
        </p>
      </div>

      <div style={{ display: 'grid', gap: 'var(--duna-space-8)' }}>
        {SECCIONES_TIENDA.map(config => (
          <TiendaSeccionEditor key={config.seccion} config={config} />
        ))}
      </div>
    </div>
  );
}
