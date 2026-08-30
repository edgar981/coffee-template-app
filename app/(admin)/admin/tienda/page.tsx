import PaletaSeccion from '@/components/admin/PaletaSeccion';
import TiendaPaginas from '@/components/admin/TiendaPaginas';

// ─── CONTENIDO DE LA TIENDA (el storefront) ──────────────────────────────────
//
// El contenido EDITORIAL del storefront. Distinto de Configuración, que edita la IDENTIDAD del
// negocio (§ negocio≠tienda). Dos ejes en la pantalla:
//   · COLORES (`PaletaSeccion`) — la PIEL de todo el storefront, store-wide, va ARRIBA del selector
//     de página porque no pertenece a una página (§ content.tema, clave no-sección);
//   · las SECCIONES agrupadas por PÁGINA (`TiendaPaginas`, Home · Nosotros) — cada una con su vista
//     previa en vivo + read↔edit + autoguardado.
// Los DOS adoptan el mismo flujo borrador/publicar: Tienda es "lo que se publica".
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

      {/* COLORES — store-wide, SOBRE el selector de página: la paleta no es de una página, así que va
          FUERA del control de página. La simetría del modelo (`content.tema` es clave no-sección). */}
      <PaletaSeccion />

      {/* Separador entre lo store-wide (colores) y lo per-página (secciones). */}
      <hr style={{ border: 0, borderTop: '1px solid var(--duna-border)', margin: 'var(--duna-space-8) 0' }} />

      <TiendaPaginas />
    </div>
  );
}
