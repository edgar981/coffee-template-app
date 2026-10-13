"use client";

// LA HISTORIA «FRASE Y PÁRRAFOS» (§ CHAMISAS-NOSOTROS-ALBUM-1, refero-chamisas.md §3 punto 2: "Una
// frase grande en serif y dos párrafos cortos ... separados por una línea punteada. En escritorio,
// a dos columnas"). TERCERA composición de `nosotrosHistoria`, hermana de «Relato»/«Sinopsis
// partida» (Onix) bajo el mismo dispatcher (`NosotrosHistoria.tsx`).
//
// REUSA TRES CAMPOS, NINGUNO NUEVO: `titulo` → la frase grande en serif (el MISMO dato que el título
// de «Relato», reposicionado); `parrafo1`/`parrafo2` → los dos párrafos cortos. `parrafo3`/`imagen`/
// `retratoNombre` quedan SIN EFECTO bajo esta composición.
//
// EL FILETE PUNTEADO ES EL DIVISOR ENTRE LOS DOS PÁRRAFOS, no un marco alrededor — horizontal en
// celular (`divide-y`, los párrafos apilados), vertical en escritorio (`sm:divide-x`), con las
// utilidades `divide-dashed` de Tailwind en vez de un borde dibujado a mano en cada párrafo (así el
// filete nunca aparece dos veces si un párrafo queda vacío — `divide-*` sólo pinta ENTRE hijos).
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { contenedorAnchoClase } from '@/lib/config/themes';
import CampoEditable from '@/components/storefront/CampoEditable';

export default function NosotrosHistoriaPartida() {
  const { nosotrosHistoria, navTratamiento } = useSiteContent();
  const { titulo, parrafo1, parrafo2 } = nosotrosHistoria;
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);
  const dosParrafos = parrafo2.trim() !== '';

  return (
    <section className="bg-[var(--sf-fondo)] py-20">
      <div className={`${contenedorClase} mx-auto`}>
        <p className="mx-auto max-w-3xl text-center font-playfair text-3xl leading-tight text-[var(--sf-tinta)] sm:text-4xl">
          <CampoEditable campo="nosotrosHistoria.titulo">{titulo}</CampoEditable>
        </p>
        {/* SIN `parrafo2`: una sola columna, SIN filete — `divide-*` sólo pinta ENTRE hijos, así que
            un grid de un solo ítem ya no necesita la rama condicional de clases. */}
        <div className={`mx-auto mt-10 grid max-w-4xl grid-cols-1 divide-y divide-dashed divide-[var(--sf-tinta)]/30 ${dosParrafos ? 'sm:grid-cols-2 sm:divide-x sm:divide-y-0' : ''}`}>
          <p className="py-6 text-[17px] text-[var(--sf-tinta)] sm:px-8 sm:py-0">
            <CampoEditable campo="nosotrosHistoria.parrafo1" multilinea>{parrafo1}</CampoEditable>
          </p>
          {dosParrafos && (
            <p className="py-6 text-[17px] text-[var(--sf-tinta)] sm:px-8 sm:py-0">
              <CampoEditable campo="nosotrosHistoria.parrafo2" multilinea>{parrafo2}</CampoEditable>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
