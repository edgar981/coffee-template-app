"use client";

// EL CATÁLOGO · COMPOSICIÓN «LÁMINAS» (§ TIENDA-CHAMISAS-ALBUM-1). Se elige por antojo, no
// recorriendo un inventario: sin buscador ni filtros, cada café es una lámina de SU color. Montada
// por `TiendaCatalogo.tsx` sólo con `mostrarSelectorAntojo(catalog)` (≤6 productos); con más, ESE
// archivo cae solo a la grilla de «Actual» (§ el spec: "Con más de 6 productos ... quedan los
// filtros de «Actual»").
//
// EL MOVIMIENTO va por el marco de `lib/movimiento/` (§ el spec), nunca framer-motion ad-hoc: C01
// («Tarjetas escalonadas») ya hace las DOS cosas que esta composición pide —entrada escalonada Y
// elevar/rotar levemente al pasar el mouse (`hoverTarjetas`, dentro de `c01`, § animaciones.ts)—,
// así que no hace falta un id nuevo en el catálogo. Reducción de movimiento, preview del editor y
// el gate de `prefers-reduced-motion` ya los resuelve `useMovimiento` — este componente no repite
// ninguno de los tres.
import Image from 'next/image';
import Link from 'next/link';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { useCartStore } from '@/lib/cartStore';
import { decidirMolienda } from '@duna/core/moliendas-opciones';
import { formatCOP } from '@duna/core/utils';
import { whatsappUrl } from '@/lib/config/site';
import { colorDeLamina, lavadoLamina } from '@/lib/tienda/laminas';
import Movimiento from '@/components/storefront/movimiento/Movimiento';
import type { Product } from '@/types/product';

interface TiendaLaminasProps {
  catalog: Product[];
  coloresPorProducto: Record<string, string>;
  /** Para «Avísame por WhatsApp» en una lámina agotada — llega por PROP, no por `useSiteSettings()`
   *  (mismo motivo que `SuscripcionPlanes`/`GrindChooser`: este componente también se monta en la
   *  vista previa del panel, § VistaTiendaEnVivo.tsx, árbol sin `SiteSettingsProvider`). Ausente →
   *  sin botón, nunca un `wa.me/` muerto. */
  whatsapp?: string;
}

function Lamina({ product, color, whatsapp }: { product: Product; color: string; whatsapp?: string }) {
  const { addItem } = useCartStore();
  const decision = decidirMolienda(product.moliendasOpciones);
  const agregaDirecto = decision.modo === 'ninguna' || decision.modo === 'automatica';
  const agotado = !product.disponible;
  const lavado = lavadoLamina(agotado ? mezclaApagada(color) : color);

  const handleAdd = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (agotado) { e.preventDefault(); return; }
    if (!agregaDirecto) return;
    e.preventDefault();
    addItem(product, 1, decision.modo === 'automatica' ? { molienda: decision.nombre } : {});
    toast.success(`${product.nombre} agregado al carrito`);
  };

  return (
    <Link
      id={`cafe-${product.slug}`}
      href={`/tienda/${product.slug}`}
      className="group block scroll-mt-24 rounded-[24px] p-5 transition-opacity [&:target]:ring-4 [&:target]:ring-[var(--sf-acento)]"
      style={{ backgroundColor: lavado }}
    >
      {/* EL ARCO 4:5 (§ la referencia, "la imagen dentro de un arco de medio punto"): `rounded-t-full`
          traza un semicírculo contra el ancho del contenedor, `rounded-b-[20px]` cierra la base —
          funciona con las fotos 3:4 de hoy (`object-cover` recorta, no deforma). */}
      <div className="relative mx-auto w-[70%] overflow-hidden rounded-t-full rounded-b-[20px]" style={{ aspectRatio: '4 / 5' }}>
        {product.imagen ? (
          <Image
            src={product.imagen}
            alt={product.nombre}
            fill
            sizes="(max-width: 768px) 70vw, 23vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-[var(--sf-superficie)]" />
        )}
        {product.badge && !agotado && (
          <span className="sf-pildora absolute top-2 right-2 bg-[var(--sf-tostado)] text-[var(--sf-tinta)] px-2.5 py-1 text-xs font-semibold rotate-[8deg]">
            {product.badge}
          </span>
        )}
        {agotado && (
          <span className="sf-pildora absolute top-2 right-2 bg-[var(--sf-tostado)] text-[var(--sf-tinta)] px-2.5 py-1 text-xs font-semibold">
            se nos acabó
          </span>
        )}
      </div>

      <h3 className="mt-4 font-playfair text-2xl text-[var(--sf-tinta)]">{product.nombre}</h3>
      {product.notas && product.notas.length > 0 && (
        <p className="mt-1 text-sm text-[var(--sf-tinta)] opacity-80">{product.notas.join(' · ')}</p>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="font-semibold tabular-nums text-[var(--sf-tinta)]">{formatCOP(product.precio)}</span>
        {agotado ? (
          whatsapp && (
            <a
              href={whatsappUrl(whatsapp, `Hola, ¿cuándo vuelve a haber ${product.nombre}?`)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="sf-pildora border border-[var(--sf-tinta)] px-4 py-2 text-sm font-medium text-[var(--sf-tinta)]"
            >
              Avísame por WhatsApp
            </a>
          )
        ) : (
          <button
            type="button"
            onClick={handleAdd}
            className="sf-pildora bg-[var(--sf-tinta)] px-4 py-2 text-sm font-medium text-[var(--sf-fondo)]"
          >
            {agregaDirecto ? 'Agregar' : 'Elegir molienda'}
          </button>
        )}
      </div>
    </Link>
  );
}

/** El color APAGADO de un producto agotado: una mezcla hacia el fondo (20%, § el spec: "el color
 *  baja al 20%") ANTES de pasar por el lavado AA de siempre. */
function mezclaApagada(color: string): string {
  // Interpola linealmente en sRGB hacia blanco — suficiente para "apagar" visualmente sin traer el
  // motor OKLCH completo para un solo efecto de estado; el lavado posterior sigue garantizando AA.
  const hex = color.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const mezclar = (c: number) => Math.round(c * 0.2 + 255 * 0.8);
  return `#${[r, g, b].map((c) => mezclar(c).toString(16).padStart(2, '0')).join('')}`;
}

export default function TiendaLaminas({ catalog, coloresPorProducto, whatsapp }: TiendaLaminasProps) {
  const items = useMemo(
    () => catalog.map((p, i) => ({ product: p, color: colorDeLamina(p.id, i, coloresPorProducto) })),
    [catalog, coloresPorProducto],
  );

  return (
    <Movimiento id="C01" as="div" className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {items.map(({ product, color }, i) => (
        <div key={product.id} className={i % 3 === 1 ? 'md:mt-14' : undefined}>
          <Lamina product={product} color={color} whatsapp={whatsapp} />
        </div>
      ))}
    </Movimiento>
  );
}
