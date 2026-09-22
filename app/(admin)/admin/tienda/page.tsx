import { Suspense } from 'react';
import PaletaSeccion from '@/components/admin/PaletaSeccion';
import MenuSeccion from '@/components/admin/MenuSeccion';
import TiendaPaginas from '@/components/admin/TiendaPaginas';

// ─── CONTENIDO DE LA TIENDA (el storefront) ──────────────────────────────────
//
// El contenido EDITORIAL del storefront. Distinto de Configuración, que edita la IDENTIDAD del
// negocio (§ negocio≠tienda). Tres ejes en la pantalla:
//   · COLORES (`PaletaSeccion`) — la PIEL de todo el storefront, store-wide, va ARRIBA del selector
//     de página porque no pertenece a una página (§ content.tema, clave no-sección);
//   · MENÚ (`MenuSeccion`, § CROMO-MENU-PANEL-EDITOR-1) — el mismo cromo TRANSVERSAL que la paleta
//     (el nav aparece en toda página), así que va junto a ella y no dentro de una pestaña de
//     `TiendaPaginas`. Editor BESPOKE sin vista previa en vivo (patrón `PaletaSeccion`, no
//     `TiendaSeccionEditor` — la RULING de `CROMO-MENU-COMO-DATO-1`);
//   · las SECCIONES agrupadas por PÁGINA (`TiendaPaginas`, Home · Nosotros · Suscripciones) — cada
//     una con su vista previa en vivo + read↔edit + autoguardado.
// Los TRES adoptan el mismo flujo borrador/publicar: Tienda es "lo que se publica".
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

      {/* Separador entre las dos piezas store-wide (colores · menú). */}
      <hr style={{ border: 0, borderTop: '1px solid var(--duna-border)', margin: 'var(--duna-space-8) 0' }} />

      {/* MENÚ — store-wide, junto a Colores: el nav es cromo transversal, no contenido de una
          página (§ MenuSeccion, el porqué de "sin vista previa"). */}
      <MenuSeccion />

      {/* Separador entre lo store-wide (colores · menú) y lo per-página (secciones). */}
      <hr style={{ border: 0, borderTop: '1px solid var(--duna-border)', margin: 'var(--duna-space-8) 0' }} />

      {/* <Suspense> porque TiendaPaginas usa `useSearchParams` (deep-link del aviso de config,
          § Backlog #65) — mismo requisito que Pedidos con `?pedido=`. */}
      <Suspense fallback={null}>
        <TiendaPaginas />
      </Suspense>
    </div>
  );
}
