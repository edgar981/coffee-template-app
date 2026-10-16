"use client";

// LA COMPOSICIÓN «LÁMINAS» (§ CHAMISAS-NOSOTROS-ALBUM-1, refero-chamisas.md §3 punto 3 / §5 — nuevas,
// elegibles por otras tiendas: "escenas en formato álbum, de 3 a 6, con foto o ilustración y
// esquineros opcionales"). Segunda composición de `nosotrosEscenas`, hermana de la canónica
// («saintLaurent», el módulo still+créditos de Onix) bajo el mismo dispatcher
// (`NosotrosEscenas.tsx`).
//
// LA LÓGICA PURA (cuántas, contador, reparto en páginas, ancho/angosto por posición, el número sin
// duplicar) vive en `lib/storefront/laminas.ts` — este componente sólo monta el DOM y el carrusel/
// scroll, nunca reimplementa esos cálculos.
//
// EL FILTRO Y EL ÍNDICE: igual que «saintLaurent», el NÚMERO visible ("01", "02"…) es la POSICIÓN
// ENTRE LAS VISIBLES (sin foto, no hay lámina), no el slot original; el campo editable usa el slot
// (`idx`) porque tiene que seguir apuntando a su posición real en el array.
//
// § CHAMISAS-APERTURA-ALBUM-AJUSTES-1 — TRES AJUSTES medidos contra la maqueta
// (`.scratch/chamisas-paginas/nosotros-suscripciones.html`, `.lams`/`.lams-hd`/`.track`/`.pg`/`.lam`):
//
// 1. ENCABEZADO DE SECCIÓN nuevo (`eyebrow`/`titulo`, § `NosotrosEscenasContent`) — "la maqueta no
//    dibuja un encabezado sobre las escenas" era cierto SÓLO para «saintLaurent»; «Láminas» SÍ lo
//    pinta ("Álbum de finca" / "Cinco láminas, de la montaña a la bolsa"). El CONTADOR se mueve del
//    pie del carrusel (celular) a ESTE encabezado —`.lams-hd` de la maqueta lo pone ahí, en las DOS
//    anchuras— en vez de centrado debajo.
// 2. EL PANEL DE ESCRITORIO — doble página con lomo punteado DENTRO de una SUPERFICIE recesada
//    (`--sf-superficie`, como `.track{background:var(--surface);border-radius:24px;padding:28px}` de
//    la maqueta), no sólo un `divide-x` sobre el fondo de la sección. Cada página es un GRID de DOS
//    columnas (`.pg{grid-template-columns:1fr 1fr}`), no una columna apilada: las láminas ANCHAS
//    (`esLaminaAncha`) ocupan la fila entera; las angostas se emparejan de a dos.
// 3. EL NÚMERO NO SE DUPLICA (`tituloLamina`) — si el dueño ya escribió "Lámina 01 · …" en su propio
//    título, no se antepone un segundo "Lámina 01 · " (el defecto medido: "Lámina 01 · Lámina 01 ·
//    El territorio").
//
// CELULAR: carrusel con scroll-snap (`snap-x snap-mandatory`), cada lámina al 84% del ancho — el
// padding lateral del contenedor (8% de cada lado) es lo que hace que la primera/última lámina
// también queden centradas y que la siguiente "se asome" por el borde. El CONTADOR ("02/05") sigue
// a la lámina más centrada vía UN `IntersectionObserver` con `threshold: 0.5` sobre cada tarjeta —
// no un cálculo de `scrollLeft` a mano, que tendría que repetir la aritmética del snap.
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { laminasVisibles, contadorLamina, repartoPaginasLaminas, esLaminaAncha, tituloLamina } from '@/lib/storefront/laminas';
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { contenedorAnchoClase } from '@/lib/config/themes';
import CampoEditable from '@/components/storefront/CampoEditable';
import type { NosotrosEscenaItem } from '@/lib/config/site-content-defaults';

interface LaminaConPosicion extends NosotrosEscenaItem {
  idx: number;
  numero: number;
}

export interface NosotrosEscenasAlbumProps {
  items: NosotrosEscenaItem[];
  esquineros: boolean;
  eyebrow: string;
  titulo: string;
}

export default function NosotrosEscenasAlbum({ items, esquineros, eyebrow, titulo }: NosotrosEscenasAlbumProps) {
  const { navTratamiento } = useSiteContent();
  const conIdx = items.map((it, idx) => ({ ...it, idx }));
  const visibles = laminasVisibles(conIdx);
  // `actual` vive ACÁ (el padre), no dentro de `Carrusel`: el ENCABEZADO (§ el ajuste 1, arriba)
  // necesita el MISMO índice que el carrusel reporta — un estado propio por componente habría dado
  // dos contadores que podrían desincronizarse entre sí.
  const [actual, setActual] = useState(0);
  if (visibles.length === 0) return null;

  const laminas: LaminaConPosicion[] = visibles.map((it, i) => ({ ...it, numero: i + 1 }));
  const { izquierda, derecha } = repartoPaginasLaminas(laminas);
  const hayEncabezado = eyebrow.trim() !== '' || titulo.trim() !== '';
  // § CHAMISAS-PAGINAS-ARREGLOS-1 — cierra CHAMISAS-ALBUM-ANCHO-INCONSISTENTE-1: el encabezado y el
  // panel de escritorio vivían en SU PROPIO `max-w-6xl`, distinto del resto de /nosotros (que ya usa
  // este mismo contenedor). `contenedorAnchoClase(navTratamiento.posicion)` reemplaza los dos
  // `max-w-6xl px-* lg:px-16` propios — con `posicion:false` (el default) es BYTE A BYTE el mismo
  // `max-w-6xl px-4 sm:px-6 lg:px-8` de siempre.
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);

  return (
    <section className="bg-[var(--sf-fondo)] py-20">
      {/* EL ENCABEZADO — eyebrow + título a la izquierda, el contador a la derecha (§ el ajuste 1,
          arriba), en las DOS anchuras. El contador SÓLO en celular (`sm:hidden`): en escritorio las
          láminas de la página están TODAS a la vista a la vez, "cuál es la actual" no tiene sentido.
          Sin eyebrow NI título (ninguno de los dos campos lleno) no hay fila que mostrar — se omite
          entera, contador incluido: un número solo flotando sin su encabezado no es el diseño de la
          maqueta, es un residuo. */}
      {hayEncabezado && (
        <div className={`${contenedorClase} mx-auto mb-4 flex items-end justify-between gap-3`}>
          <div>
            {eyebrow.trim() !== '' && (
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--sf-tinta)]">
                <CampoEditable campo="nosotrosEscenas.eyebrow">{eyebrow}</CampoEditable>
              </p>
            )}
            {titulo.trim() !== '' && (
              <h2 className="mt-1.5 font-playfair text-[28px] leading-[1.15] text-[var(--sf-tinta)] lg:text-[32px]">
                <CampoEditable campo="nosotrosEscenas.titulo">{titulo}</CampoEditable>
              </h2>
            )}
          </div>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--sf-tinta)]/60 sm:hidden">
            {contadorLamina(actual, laminas.length)}
          </span>
        </div>
      )}
      {/* CELULAR: carrusel con scroll-snap. */}
      <div className="sm:hidden">
        <Carrusel
          laminas={laminas}
          esquineros={esquineros}
          actual={actual}
          onActualChange={setActual}
          mostrarContadorPropio={!hayEncabezado}
        />
      </div>
      {/* ESCRITORIO: panel recesado con doble página y lomo punteado (§ el ajuste 2, arriba). Está
          `hidden` bajo `sm:`, así que el ancho/relleno de `contenedorClase` se aplica sin prefijo —
          no hay viewport en el que este `<div>` sea visible por debajo de ese breakpoint. */}
      <div className={`hidden sm:block ${contenedorClase} mx-auto`}>
        <div className="relative grid grid-cols-2 gap-0 rounded-[24px] bg-[var(--sf-superficie)] p-7">
          <div className="pointer-events-none absolute inset-y-7 left-1/2 border-l-2 border-dashed border-[var(--sf-tinta)]/30" aria-hidden="true" />
          <Pagina laminas={izquierda} esquineros={esquineros} className="pr-7" />
          <Pagina laminas={derecha} esquineros={esquineros} className="pl-7" />
        </div>
      </div>
    </section>
  );
}

function Pagina({ laminas, esquineros, className }: { laminas: LaminaConPosicion[]; esquineros: boolean; className: string }) {
  return (
    <div className={`grid grid-cols-2 content-start gap-5 ${className}`}>
      {laminas.map((l, i) => (
        <Lamina
          key={l.idx}
          lamina={l}
          esquineros={esquineros}
          ancha={esLaminaAncha(i, laminas.length)}
        />
      ))}
    </div>
  );
}

interface CarruselProps {
  laminas: LaminaConPosicion[];
  esquineros: boolean;
  actual: number;
  onActualChange: (i: number) => void;
  mostrarContadorPropio: boolean;
}

function Carrusel({ laminas, esquineros, actual, onActualChange, mostrarContadorPropio }: CarruselProps) {
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const idx = refs.current.findIndex((el) => el === entry.target);
          if (idx !== -1) onActualChange(idx);
        }
      },
      { threshold: 0.5 },
    );
    refs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `onActualChange` es `setActual` del
    // padre (identidad estable entre renders); incluirla recrearía el observer sin motivo.
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
            <Lamina lamina={l} esquineros={esquineros} ancha={false} />
          </div>
        ))}
      </div>
      {/* Cuando NO hay encabezado (ninguno de los dos campos lleno), el contador se queda acá —el
          sitio de siempre—; con encabezado, lo muestra la fila de arriba (el padre) y esta copia se
          omite, para no repetirlo dos veces en pantalla. */}
      {mostrarContadorPropio && (
        <p className="mt-4 text-center text-xs font-semibold tabular-nums text-[var(--sf-tinta)]/60">
          {contadorLamina(actual, laminas.length)}
        </p>
      )}
    </>
  );
}

// § CHAMISAS-NOSOTROS-FIDELIDAD-1 — CUATRO AJUSTES medidos contra la maqueta
// (`.lam`/`.lam .ph`/`.cn`/`.lam .ph .ilus`/`.lam .d`, `.scratch/chamisas-paginas/
// nosotros-suscripciones.html`) y contra captura real (sin tarjeta, corchetes finos, descripción
// cortada a 2 líneas, pie en itálica debajo — `.capturas/chamisas-baseline-1440/` antes de este fix):
//
// 1. CADA LÁMINA GANA SU PROPIA TARJETA BLANCA (`.lam{background:#FFFFFF (--sf-tarjeta);
//    border-radius:24px;padding:14px 14px 18px}`) — antes la foto y el texto vivían directo sobre el
//    fondo de la página/panel, sin la superficie propia que la maqueta pinta por lámina.
//    `--sf-tarjeta` (§ `app/globals.css`, familia TARJETA/SOBRE) ya existía, declarado para esto —
//    "INERTE: nadie los lee todavía" — y ésta es su primer consumidor real.
// 2. LOS ESQUINEROS PASAN DE CORCHETES (borde fino, `border-*-2`) A TRIÁNGULOS SÓLIDOS
//    (`.cn{width:26px;height:26px;background:#B8461A (--sf-acento)}` + `clip-path` por esquina,
//    a -5px del borde de la FOTO). Siguen siendo HERMANOS de la caja `overflow-hidden` que recorta
//    la foto, no sus hijos — mismo patrón que el sticker de `NosotrosAperturaAlbum.tsx` (§ su
//    "ajuste 2"): adentro, el `-5px` de vuelo se recortaría contra la máscara.
// 3. LA DESCRIPCIÓN YA NO SE CORTA A 2 LÍNEAS (`.lam .d`, sin `line-clamp`) — texto completo.
// 4. EL PIE DE FOTO ("Imagen ilustrativa") PASA DE ITÁLICA DEBAJO A RÓTULO SOBRE LA IMAGEN
//    (`.lam .ph .ilus{left:12px;bottom:12px}`, el MISMO patrón de etiqueta que ya usa la portada
//    «Álbum» — ver el open follow-up de `NosotrosAperturaAlbum.tsx` sobre el campo que a esa pieza
//    le falta; acá el campo YA EXISTE (`items[].pie`), así que el fix es sólo de RENDER).
function Lamina({ lamina, esquineros, ancha }: { lamina: LaminaConPosicion; esquineros: boolean; ancha: boolean }) {
  const { idx, numero, foto, titulo, descripcion, pie } = lamina;
  return (
    // `col-span-2` se queda SOLO en `<figure>` (el ítem del grid, § `esLaminaAncha` — intacto,
    // `lib/storefront/nosotros-escenas.test.ts` afirma esta clase exacta); la TARJETA BLANCA
    // (§ el ajuste 1, arriba) vive en el `<div>` anidado, no en el `<figure>` — así ninguna de las
    // dos responsabilidades (posición en el grid vs. superficie visual) pisa a la otra.
    <figure className={ancha ? 'col-span-2' : undefined}>
      <div className="flex flex-col rounded-[24px] bg-[var(--sf-tarjeta)] p-3.5 pb-[18px]">
        {/* Envoltorio SIN `overflow-hidden` (§ el ajuste 2, arriba) — los esquineros cuelgan -5px del
            borde de la foto y no deben recortarse contra la máscara que recorta la foto misma. */}
        <div className="relative">
          {/* Alto: 10/11 en celular (aprox. al `(84cqw-28px)*1.08` de la maqueta, sobre el ancho YA
              reducido por el padding de la tarjeta); fijo 300px en escritorio, como `.lam .ph`. Radio
              10px CONSTANTE (la tarjeta ya aporta el 24px exterior; `.lam .ph` de la maqueta no
              cambia de radio entre anchos). */}
          <div className="relative aspect-[10/11] overflow-hidden rounded-[10px] bg-[var(--sf-superficie)] sm:aspect-auto sm:h-[300px]">
            <CampoEditable campo={`nosotrosEscenas.items.${idx}.foto`} tipo="imagen">
              <Image
                src={foto}
                alt={titulo.trim() || 'Lámina'}
                fill
                sizes="(max-width: 640px) 84vw, 36vw"
                className="object-cover"
              />
            </CampoEditable>
            {pie.trim() !== '' && (
              <p className="sf-pildora absolute bottom-3 left-3 z-10 bg-[var(--sf-tinta)]/[0.74] px-2.5 py-[3px] text-[11px] tracking-[0.02em] text-[var(--sf-fondo)]">
                <CampoEditable campo={`nosotrosEscenas.items.${idx}.pie`}>{pie}</CampoEditable>
              </p>
            )}
          </div>
          {esquineros && <Esquineros />}
        </div>
        <figcaption className="mt-3.5">
          <p className="font-playfair text-lg text-[var(--sf-tinta)]">
            <CampoEditable campo={`nosotrosEscenas.items.${idx}.titulo`}>{tituloLamina(titulo, numero)}</CampoEditable>
          </p>
          {descripcion.trim() !== '' && (
            <p className="mt-1 text-sm leading-[1.45] text-[var(--sf-tinta)]/80">
              <CampoEditable campo={`nosotrosEscenas.items.${idx}.descripcion`} multilinea>{descripcion}</CampoEditable>
            </p>
          )}
        </figcaption>
      </div>
    </figure>
  );
}

/** Los esquineros de álbum en terracota (§ el spec): triángulos SÓLIDOS (26×26px, `clip-path`),
 *  `--sf-acento` — nunca un hex fijo (el acento de Las Chamisas DERIVA a terracota; otro tenant ve
 *  SU acento, no el de ningún cliente particular). Posicionados a -5px del borde de la FOTO, como
 *  `.cn.tl/.tr/.bl/.br` de la maqueta (26px, offset -5px, `background` sólido recortado por
 *  `clip-path`, nunca un borde). */
function Esquineros() {
  const base = 'pointer-events-none absolute h-[26px] w-[26px] bg-[var(--sf-acento)]';
  return (
    <>
      <span aria-hidden="true" className={`${base} -top-[5px] -left-[5px] [clip-path:polygon(0_0,100%_0,0_100%)]`} />
      <span aria-hidden="true" className={`${base} -top-[5px] -right-[5px] [clip-path:polygon(0_0,100%_0,100%_100%)]`} />
      <span aria-hidden="true" className={`${base} -bottom-[5px] -left-[5px] [clip-path:polygon(0_0,0_100%,100%_100%)]`} />
      <span aria-hidden="true" className={`${base} -bottom-[5px] -right-[5px] [clip-path:polygon(100%_0,100%_100%,0_100%)]`} />
    </>
  );
}
