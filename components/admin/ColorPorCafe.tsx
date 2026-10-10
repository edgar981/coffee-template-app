'use client';

import { ImageIcon } from 'lucide-react';
import type { Product } from '@/types/product';
import type { RaicesPaleta } from '@/lib/config/palette-derive';
import { colorDeLamina, sugerenciasLaminas, HEX6 } from '@/lib/tienda/laminas';
import { MuestraColor } from '@/components/admin/editor/MuestraColor';

// EL PICKER DE COLOR POR PRODUCTO (§ TIENDA-CHAMISAS-ALBUM-1) — un renglón por café del catálogo
// REAL, cada uno con su `<MuestraColor>` (§ EDITOR-PANEL-PIEL-1: mismo patrón que el acento de marca
// o el color de badge — sugerencias con nombre llano, «Por defecto» siempre, «Personalizado» dentro
// de «Avanzado»). El mapa que esto escribe (`coloresPorProducto`) es `id-de-producto → hex`; "sin
// color" es el estado REAL de la mayoría de productos (asignación por orden, § `colorDeLamina`), no
// una excepción — por eso CADA renglón nace en "Por defecto" hasta que el dueño elige algo distinto.
//
// Vive FUERA de `TiendaSeccionEditor.tsx` (su único montador) por el mismo criterio que
// `ProductoCombobox` NO sigue: acá sí hay un path propio en `touches:` (§ el spec), así que es su
// propio archivo desde el día uno — no hace falta esperar a un segundo consumidor.
export interface ColorPorCafeProps {
  /** El catálogo REAL (§ `cargarCatalogoReal`, `TiendaSeccionEditor.tsx`) — puede venir vacío
   *  mientras el fetch no resolvió. */
  productos: Product[];
  productosListos: boolean;
  /** El mapa guardado (`form.coloresPorProducto`), tal como vive en el borrador. */
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  /** Las raíces del tema real del tenant, para derivar la paleta de reserva y las sugerencias —
   *  AUSENTE cae a Nayoli (§ `sugerenciasLaminas`/`colorDeLamina`, que ya tienen ese default). */
  raices?: RaicesPaleta;
}

export function ColorPorCafe({ productos, productosListos, value, onChange, raices }: ColorPorCafeProps) {
  const sugerencias = sugerenciasLaminas(raices);

  if (!productosListos) {
    return <p className="duna-field__hint">Cargando catálogo…</p>;
  }
  if (productos.length === 0) {
    return <p className="duna-field__hint">Sin productos en el catálogo todavía.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-4)' }}>
      {productos.map((p, i) => {
        const elegido = value[p.id];
        const esPorDefecto = !(typeof elegido === 'string' && HEX6.test(elegido));
        const efectivo = colorDeLamina(p.id, i, value, raices);
        const quitar = () => {
          if (!(p.id in value)) return;
          onChange(Object.fromEntries(Object.entries(value).filter(([id]) => id !== p.id)));
        };
        return (
          <div key={p.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--duna-space-3)' }}>
            <span className="duna-tile" style={{ width: 28, height: 28, flexShrink: 0, marginTop: 2 }}>
              {p.imagen
                // eslint-disable-next-line @next/next/no-img-element -- miniatura chica, mismo patrón que ProductoCombobox (TiendaSeccionEditor.tsx)
                ? <img src={p.imagen} alt="" />
                : <ImageIcon aria-hidden width={14} height={14} />}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="duna-field__label" style={{ margin: 0, marginBottom: 'var(--duna-space-2)' }}>{p.nombre}</p>
              <MuestraColor
                value={efectivo}
                onChange={(hex) => onChange({ ...value, [p.id]: hex })}
                ariaLabel={`Color de la lámina de ${p.nombre}`}
                sugerencias={sugerencias}
                onPorDefecto={quitar}
                esPorDefecto={esPorDefecto}
              />
            </div>
          </div>
        );
      })}
      <p className="duna-field__hint" style={{ margin: 0 }}>
        «Por defecto» asigna el color por orden de catálogo, derivado del tema de la tienda — nunca un
        color fijo. Sólo tiene efecto con la composición «Láminas» del Catálogo.
      </p>
    </div>
  );
}

export default ColorPorCafe;
