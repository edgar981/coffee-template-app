import TiendaPaginas from '@/components/admin/TiendaPaginas';

// ─── CONTENIDO DE LA TIENDA (el storefront) ──────────────────────────────────
//
// El contenido EDITORIAL del storefront, agrupado por PÁGINA (Home · Nosotros). Distinto de
// Configuración, que edita la IDENTIDAD del negocio (§ negocio≠tienda).
//
// Cada sección (`TiendaSeccionEditor`) trae su VISTA PREVIA EN VIVO + read↔edit + autoguardado; el
// selector de página (`TiendaPaginas`) las agrupa. La página /nosotros se puede encender/apagar.
export default function Tienda() {
  return (
    <div>
      <div style={{ minWidth: 0, marginBottom: 'var(--duna-space-4)' }}>
        <h1 className="duna-display-m">Contenido de la tienda</h1>
        <p className="duna-sub" style={{ marginTop: '3px', maxWidth: '42rem' }}>
          Lo que el cliente ve en el storefront. La identidad del negocio —nombre, WhatsApp,
          correos— se edita en Configuración.
        </p>
      </div>

      <TiendaPaginas />
    </div>
  );
}
