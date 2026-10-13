"use client";

// LA COMPOSICIÓN «LÁMINAS» (§ CHAMISAS-NOSOTROS-ALBUM-1, refero-chamisas.md §3 punto 3 / §5 — nuevas,
// elegibles por otras tiendas: "escenas en formato álbum, de 3 a 6, con foto o ilustración y
// esquineros opcionales"). Segunda composición de `nosotrosEscenas`, hermana de la canónica
// («saintLaurent», el módulo still+créditos de Onix) bajo el mismo dispatcher
// (`NosotrosEscenas.tsx`).
//
// LA LÓGICA PURA (cuántas, contador, reparto en páginas) vive en `lib/storefront/laminas.ts` —
// este componente sólo monta el DOM y el carrusel/scroll, nunca reimplementa esos cálculos.
//
// EL FILTRO Y EL ÍNDICE: igual que «saintLaurent», el NÚMERO visible ("01", "02"…) es la POSICIÓN
// ENTRE LAS VISIBLES (sin foto, no hay lámina), no el slot original; el campo editable usa el slot
// (`idx`) porque tiene que seguir apuntando a su posición real en el array.
//
// CELULAR: carrusel con scroll-snap (`snap-x snap-mandatory`), cada lámina al 84% del ancho — el
// padding lateral del contenedor (8% de cada lado) es lo que hace que la primera/última lámina
// también queden centradas y que la siguiente "se asome" por el borde. El CONTADOR ("02/05") sigue
// a la lámina más centrada vía UN `IntersectionObserver` con `threshold: 0.5` sobre cada tarjeta —
// no un cálculo de `scrollLeft` a mano, que tendría que repetir la aritmética del snap.
//
// ESCRITORIO: doble página de álbum, lomo punteado al centro (`divide-x divide-dashed`) — el
// reparto de qué lámina va en cada página sale de `repartoPaginasLaminas` (3+2 con cinco láminas,
// como la maqueta). Dentro de cada página, las láminas se apilan en una columna — es la lectura MÁS
// simple de "página de álbum" sin inventar una grilla que ninguna captura confirma.
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { laminasVisibles, contadorLamina, repartoPaginasLaminas } from '@/lib/storefront/laminas';
import CampoEditable from '@/components/storefront/CampoEditable';
import type { NosotrosEscenaItem } from '@/lib/config/site-content-defaults';

interface LaminaConPosicion extends NosotrosEscenaItem {
  idx: number;
  numero: number;
}

export default function NosotrosEscenasAlbum({ items, esquineros }: { items: NosotrosEscenaItem[]; esquineros: boolean }) {
  const conIdx = items.map((it, idx) => ({ ...it, idx }));
  const visibles = laminasVisibles(conIdx);
  if (visibles.length === 0) return null;

  const laminas: LaminaConPosicion[] = visibles.map((it, i) => ({ ...it, numero: i + 1 }));
  const { izquierda, derecha } = repartoPaginasLaminas(laminas);

  return (
    <section className="bg-[var(--sf-fondo)] py-20">
      {/* CELULAR: carrusel con scroll-snap. */}
      <div className="sm:hidden">
        <Carrusel laminas={laminas} esquineros={esquineros} />
      </div>
      {/* ESCRITORIO: doble página con lomo punteado. */}
      <div className="hidden sm:mx-auto sm:grid sm:max-w-5xl sm:grid-cols-2 sm:divide-x sm:divide-dashed sm:divide-[var(--sf-tinta)]/30 sm:px-10">
        <div className="flex flex-col gap-10 sm:pr-10">
          {izquierda.map((l) => <Lamina key={l.idx} lamina={l} esquineros={esquineros} />)}
        </div>
        <div className="flex flex-col gap-10 sm:pl-10">
          {derecha.map((l) => <Lamina key={l.idx} lamina={l} esquineros={esquineros} />)}
        </div>
      </div>
    </section>
  );
}

function Carrusel({ laminas, esquineros }: { laminas: LaminaConPosicion[]; esquineros: boolean }) {
  const [actual, setActual] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const idx = refs.current.findIndex((el) => el === entry.target);
          if (idx !== -1) setActual(idx);
        }
      },
      { threshold: 0.5 },
    );
    refs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [laminas.length]);

  return (
    <>
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-[8%] pb-2">
        {laminas.map((l, i) => (
          <div
            key={l.idx}
            ref={(el) => { refs.current[i] = el; }}
            className="w-[84%] shrink-0 snap-center"
          >
            <Lamina lamina={l} esquineros={esquineros} />
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-xs font-semibold tabular-nums text-[var(--sf-tinta)]/60">
        {contadorLamina(actual, laminas.length)}
      </p>
    </>
  );
}

function Lamina({ lamina, esquineros }: { lamina: LaminaConPosicion; esquineros: boolean }) {
  const { idx, numero, foto, titulo, descripcion, pie } = lamina;
  return (
    <figure>
      {/* RADIO 24, SIN SOMBRA (§ el spec) — la tarjeta es la foto misma, sin marco de superficie. */}
      <div className="relative aspect-[4/5] overflow-hidden rounded-[24px] bg-[var(--sf-superficie)]">
        <CampoEditable campo={`nosotrosEscenas.items.${idx}.foto`} tipo="imagen">
          <Image
            src={foto}
            alt={titulo.trim() || 'Lámina'}
            fill
            sizes="(max-width: 640px) 84vw, 36vw"
            className="object-cover"
          />
        </CampoEditable>
        {esquineros && <Esquineros />}
      </div>
      <figcaption className="mt-4">
        <p className="font-playfair text-lg text-[var(--sf-tinta)]">
          {`Lámina ${String(numero).padStart(2, '0')} · `}
          <CampoEditable campo={`nosotrosEscenas.items.${idx}.titulo`}>{titulo}</CampoEditable>
        </p>
        {descripcion.trim() !== '' && (
          <p className="mt-1 text-sm text-[var(--sf-tinta)]/80 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
            <CampoEditable campo={`nosotrosEscenas.items.${idx}.descripcion`} multilinea>{descripcion}</CampoEditable>
          </p>
        )}
        {pie.trim() !== '' && (
          <p className="mt-1 text-xs italic text-[var(--sf-tinta)]/50">
            <CampoEditable campo={`nosotrosEscenas.items.${idx}.pie`}>{pie}</CampoEditable>
          </p>
        )}
      </figcaption>
    </figure>
  );
}

/** Los esquineros de álbum en terracota (§ el spec) — `--sf-acento`, nunca un hex fijo (el acento de
 *  Las Chamisas DERIVA a terracota; otro tenant ve SU acento, no el de ningún cliente particular). */
function Esquineros() {
  const base = 'pointer-events-none absolute h-5 w-5 border-[var(--sf-acento)]';
  return (
    <>
      <span aria-hidden="true" className={`${base} top-2 left-2 border-t-2 border-l-2`} />
      <span aria-hidden="true" className={`${base} top-2 right-2 border-t-2 border-r-2`} />
      <span aria-hidden="true" className={`${base} bottom-2 left-2 border-b-2 border-l-2`} />
      <span aria-hidden="true" className={`${base} bottom-2 right-2 border-b-2 border-r-2`} />
    </>
  );
}
