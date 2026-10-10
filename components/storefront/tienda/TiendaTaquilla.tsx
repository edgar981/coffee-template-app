"use client";

// EL CATÁLOGO · COMPOSICIÓN «TAQUILLA» (§ TIENDA-ONIX-CARTELERA-1). Montada por `TiendaCatalogo.tsx`
// sólo con una matriz VÁLIDA (`derivarMatrizTaquilla`, § lib/tienda/taquilla.ts) — sin ella, ESE
// archivo cae solo a la grilla de «Actual», mismo patrón que «Láminas»/`mostrarSelectorAntojo`.
//
// SOBRE EL FONDO CLARO de la tienda (§ el spec: "no sobre la tinta") — a diferencia de la Apertura,
// que es oscura. CADA CELDA ES UN PRODUCTO REAL del catálogo: clickearla cambia la foto (fundido de
// 200ms), el nombre base, las notas y el precio del botón — nunca un mapeo inventado.
//
// EL RIESGO DE DINERO (§ TIENDA-COMPOSICIONES-CENSO-1): `moliendaAceptada` rechaza en el checkout un
// producto que declara opciones si llega sin molienda. Cada celda pasa por `decidirMolienda`/
// `agregableDirecto`, igual que `ProductCard.handleAdd` — nunca `addItem(producto, 1)` a secas.
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCartStore } from '@/lib/cartStore';
import { decidirMolienda } from '@duna/core/moliendas-opciones';
import { formatCOP } from '@duna/core/utils';
import { whatsappUrl } from '@/lib/config/site';
import { derivarMatrizTaquilla, celdaDe, nombreBaseProducto, type MatrizTaquilla } from '@/lib/tienda/taquilla';
import type { Product } from '@/types/product';

interface TiendaTaquillaProps {
  catalog: Product[];
  whatsapp?: string;
  /** § TiendaCatalogoContent.barraFijaMovil — encendida por defecto; `false` explícito la apaga. */
  barraFijaMovil: boolean;
}

export default function TiendaTaquilla({ catalog, whatsapp, barraFijaMovil }: TiendaTaquillaProps) {
  const matriz = useMemo(() => derivarMatrizTaquilla(catalog), [catalog]);
  const [seleccion, setSeleccion] = useState<{ categoria: string; peso: number } | null>(null);
  const botonRef = useRef<HTMLDivElement | null>(null);
  const [botonFueraDeVista, setBotonFueraDeVista] = useState(false);

  useEffect(() => {
    const el = botonRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(([entry]) => setBotonFueraDeVista(!entry.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [matriz]);

  if (!matriz) return null;

  // La selección DEFAULT es la primera fila × primera columna — determinista: no hay un criterio de
  // "destacado" declarado en el catálogo del que elegir otra cosa.
  const activa = seleccion ?? { categoria: matriz.filas[0], peso: matriz.columnas[0] };
  const producto = matriz.celdas.get(celdaDe(activa.categoria, activa.peso))!;

  return (
    <div>
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:items-start">
        <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden bg-[var(--sf-superficie)]">
          {producto.imagen ? (
            <Image
              key={producto.id}
              src={producto.imagen}
              alt={producto.nombre}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-contain transition-opacity duration-200"
            />
          ) : null}
        </div>

        <div>
          <h2 className="font-playfair text-3xl text-[var(--sf-tinta)] sm:text-4xl">
            {nombreBaseProducto(producto.nombre)}
          </h2>
          {producto.notas && producto.notas.length > 0 && (
            <p className="mt-2 text-sm text-[var(--sf-texto-suave)]">{producto.notas.join(' · ')}</p>
          )}

          <TablaTaquilla matriz={matriz} activa={activa} onElegir={setSeleccion} />

          <div ref={botonRef} className="mt-6">
            <BotonTaquilla producto={producto} whatsapp={whatsapp} />
          </div>
        </div>
      </div>

      {barraFijaMovil && botonFueraDeVista && (
        <BarraFijaMovil producto={producto} whatsapp={whatsapp} />
      )}
    </div>
  );
}

function TablaTaquilla({
  matriz, activa, onElegir,
}: {
  matriz: MatrizTaquilla;
  activa: { categoria: string; peso: number };
  onElegir: (c: { categoria: string; peso: number }) => void;
}) {
  return (
    <div
      className="mt-8 grid overflow-hidden border border-[var(--sf-linea)]/20"
      style={{ gridTemplateColumns: `minmax(0,1fr) repeat(${matriz.columnas.length}, minmax(0,1fr))` }}
    >
      <div />
      {matriz.columnas.map((peso) => (
        <div
          key={peso}
          className="border-l border-[var(--sf-linea)]/20 px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.1em] text-[var(--sf-texto-suave)]"
        >
          {peso} g
        </div>
      ))}
      {matriz.filas.map((categoria) => (
        <CeldaFila key={categoria} categoria={categoria} matriz={matriz} activa={activa} onElegir={onElegir} />
      ))}
    </div>
  );
}

function CeldaFila({
  categoria, matriz, activa, onElegir,
}: {
  categoria: string;
  matriz: MatrizTaquilla;
  activa: { categoria: string; peso: number };
  onElegir: (c: { categoria: string; peso: number }) => void;
}) {
  return (
    <>
      <div className="flex items-center border-t border-[var(--sf-linea)]/20 px-3 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--sf-texto-suave)]">
        {categoria}
      </div>
      {matriz.columnas.map((peso) => {
        const p = matriz.celdas.get(celdaDe(categoria, peso))!;
        const elegida = activa.categoria === categoria && activa.peso === peso;
        const agotada = !p.disponible;
        return (
          <button
            key={peso}
            type="button"
            onClick={() => onElegir({ categoria, peso })}
            aria-pressed={elegida}
            className={`relative flex min-h-[64px] flex-col items-center justify-center border-l border-t border-[var(--sf-linea)]/20 px-2 py-2 text-center font-playfair text-xl tabular-nums transition-colors sm:min-h-[72px] sm:text-2xl ${
              elegida
                ? 'bg-[var(--sf-tinta)] text-[var(--sf-fondo)]'
                : 'text-[var(--sf-tinta)] hover:bg-[var(--sf-superficie)]'
            }`}
          >
            {formatCOP(p.precio)}
            {agotada && (
              <span className="mt-1 text-[10px] font-sans font-semibold uppercase tracking-[0.1em] opacity-70">
                Agotado
              </span>
            )}
          </button>
        );
      })}
    </>
  );
}

function BotonTaquilla({ producto, whatsapp }: { producto: Product; whatsapp?: string }) {
  const { addItem } = useCartStore();
  const [agregado, setAgregado] = useState(false);
  const decision = decidirMolienda(producto.moliendasOpciones);
  const agregaDirecto = decision.modo === 'ninguna' || decision.modo === 'automatica';
  const agotado = !producto.disponible;

  if (agotado) {
    if (!whatsapp) return null;
    return (
      <a
        href={whatsappUrl(whatsapp, `Hola, ¿cuándo vuelve a haber ${producto.nombre}?`)}
        target="_blank"
        rel="noreferrer"
        className="sf-pildora block w-full border border-[var(--sf-tinta)] px-6 py-3 text-center text-sm font-semibold uppercase tracking-[0.08em] text-[var(--sf-tinta)]"
      >
        Avísame por WhatsApp
      </a>
    );
  }

  // «Agotada: … el botón pasa a fantasma». Con molienda de elección REAL (§ ProductCard.handleAdd:
  // "Sin preventDefault: el click sigue al <Link>"), acá no hay <Link> que envuelva — se navega a la
  // ficha del producto, el único sitio donde el cliente elige entre varias.
  if (!agregaDirecto) {
    return (
      <a
        href={`/tienda/${producto.slug}`}
        className="sf-pildora block w-full bg-[var(--sf-accion,var(--sf-tostado))] px-6 py-3 text-center text-sm font-semibold uppercase tracking-[0.08em] text-[var(--sf-accion-txt,var(--sf-tinta))]"
      >
        Elegir molienda · {formatCOP(producto.precio)}
      </a>
    );
  }

  const handleAdd = () => {
    addItem(producto, 1, decision.modo === 'automatica' ? { molienda: decision.nombre } : {});
    setAgregado(true);
    window.setTimeout(() => setAgregado(false), 1600);
  };

  return (
    <button
      type="button"
      onClick={handleAdd}
      className="sf-pildora block w-full bg-[var(--sf-accion,var(--sf-tostado))] px-6 py-3 text-center text-sm font-semibold uppercase tracking-[0.08em] text-[var(--sf-accion-txt,var(--sf-tinta))] transition-opacity"
    >
      {agregado ? 'Agregado ✓' : `Agregar · ${formatCOP(producto.precio)}`}
    </button>
  );
}

// LA BARRA FIJA DEL CELULAR (§ TIENDA-ONIX-CARTELERA-1, el spec item 6) — SIN precedente en el
// storefront (§ TIENDA-COMPOSICIONES-CENSO-1). Aparece cuando el botón principal sale de pantalla
// (el `IntersectionObserver` del padre); respeta el borde inferior del teléfono
// (`env(safe-area-inset-bottom)`). `md:hidden`: en escritorio el botón principal rara vez sale de
// pantalla sin que el visitante ya esté mirando otra cosa, y la maqueta aprobada la dibuja sólo para
// el celular.
function BarraFijaMovil({ producto, whatsapp }: { producto: Product; whatsapp?: string }) {
  const { addItem } = useCartStore();
  const decision = decidirMolienda(producto.moliendasOpciones);
  const agregaDirecto = decision.modo === 'ninguna' || decision.modo === 'automatica';
  const agotado = !producto.disponible;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-[var(--sf-linea)]/20 bg-[var(--sf-tinta)] px-4 py-3 md:hidden"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <span className="truncate text-xs font-semibold uppercase tracking-[0.08em] text-[var(--sf-fondo)]">
        {producto.variante || producto.nombre} — {formatCOP(producto.precio)}
      </span>
      {agotado ? (
        whatsapp && (
          <a
            href={whatsappUrl(whatsapp, `Hola, ¿cuándo vuelve a haber ${producto.nombre}?`)}
            target="_blank"
            rel="noreferrer"
            className="sf-pildora shrink-0 border border-[var(--sf-fondo)] px-4 py-2 text-xs font-semibold uppercase text-[var(--sf-fondo)]"
          >
            Avísame
          </a>
        )
      ) : agregaDirecto ? (
        <button
          type="button"
          onClick={() => addItem(producto, 1, decision.modo === 'automatica' ? { molienda: decision.nombre } : {})}
          className="sf-pildora shrink-0 bg-[var(--sf-accion,var(--sf-tostado))] px-4 py-2 text-xs font-semibold uppercase text-[var(--sf-accion-txt,var(--sf-tinta))]"
        >
          Agregar
        </button>
      ) : (
        <a
          href={`/tienda/${producto.slug}`}
          className="sf-pildora shrink-0 bg-[var(--sf-accion,var(--sf-tostado))] px-4 py-2 text-xs font-semibold uppercase text-[var(--sf-accion-txt,var(--sf-tinta))]"
        >
          Elegir
        </a>
      )}
    </div>
  );
}
