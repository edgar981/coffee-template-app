import TiendaHeroSeccion from '@/components/admin/TiendaHeroSeccion';

// ─── CONTENIDO DE LA TIENDA (el storefront) ──────────────────────────────────
//
// El contenido EDITORIAL del storefront —hoy, el hero de la home—. Distinto de Configuración,
// que edita la IDENTIDAD del negocio (§ negocio≠tienda).
//
// TRANSITORIO (retiro del iframe, commit A): sin vista previa por ahora — sólo el editor, que
// autoguarda. La VISTA PREVIA EN VIVO (componentes reales alimentados por el form) + el read↔edit
// entran en el commit siguiente.
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

      <TiendaHeroSeccion />
    </div>
  );
}
