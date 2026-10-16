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
// § CHAMISAS-NOSOTROS-FIDELIDAD-1 — EL LAYOUT ERA "título centrado sobre dos columnas con el filete
// ENTRE los párrafos"; la maqueta (`.sin`/`.sin-g`/`.big`/`.rule`/`.paras`,
// `.scratch/chamisas-paginas/nosotros-suscripciones.html`) es otra composición: la frase grande a la
// IZQUIERDA, un filete punteado (horizontal en celular, VERTICAL en escritorio) entre la frase y el
// bloque de párrafos, y los párrafos APILADOS a la DERECHA — nunca un divisor ENTRE los dos
// párrafos entre sí. Medido contra captura real (`.capturas/chamisas-baseline-1440/app-0.png`
// antes de este fix): el título salía centrado arriba de las dos columnas, exactamente el layout
// viejo.
//
// REUSA LOS MISMOS TRES CAMPOS, sin tocar el modelo: `titulo` → la frase grande (`.big`);
// `parrafo1`/`parrafo2` → el bloque `.paras`, apilados con un simple `gap` (nunca un `divide-*`
// entre ellos — la maqueta no lo tiene). `parrafo3`/`imagen`/`retratoNombre` siguen SIN EFECTO bajo
// esta composición (sin cambio).
//
// MEDIDAS DE LA MAQUETA: `.sin-g{grid-template-columns:minmax(0,7fr) auto minmax(0,5fr);gap:48px}`
// en escritorio (celular: una columna, `gap:22px`, el filete pasa de `border-left` a `border-top`);
// `.big{font-size:27px/36px;line-height:1.25}`; `.paras p{font-size:16px;line-height:1.65;
// max-width:52ch}`, con `gap:14px` entre los párrafos del bloque.
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
      <div className={`${contenedorClase} mx-auto grid grid-cols-1 gap-[22px] lg:grid-cols-[7fr_auto_5fr] lg:items-start lg:gap-12`}>
        <p className="font-playfair text-[27px] leading-[1.25] text-balance text-[var(--sf-tinta)] lg:text-[36px]">
          <CampoEditable campo="nosotrosHistoria.titulo">{titulo}</CampoEditable>
        </p>
        {/* EL FILETE — horizontal en celular (border-top), vertical en escritorio (border-left,
            `lg:self-stretch` para que llegue al alto de la fila). GROSOR 2px (§ CHAMISAS-NOSOTROS-
            MAQUETA-1 — medido: `.sin .rule{border-top:2px dashed}`/`border-left:2px dashed}`; el
            `border-t`/`border-l` sin número de Tailwind son 1px, la mitad del grosor de la maqueta). */}
        <span aria-hidden="true" className="block border-t-2 border-dashed border-[var(--sf-tinta)]/30 lg:h-full lg:self-stretch lg:border-t-0 lg:border-l-2" />
        <div className="grid grid-cols-1 gap-[14px]">
          <p className="max-w-[52ch] text-base leading-[1.65] text-[var(--sf-tinta)]">
            <CampoEditable campo="nosotrosHistoria.parrafo1" multilinea>{parrafo1}</CampoEditable>
          </p>
          {dosParrafos && (
            <p className="max-w-[52ch] text-base leading-[1.65] text-[var(--sf-tinta)]">
              <CampoEditable campo="nosotrosHistoria.parrafo2" multilinea>{parrafo2}</CampoEditable>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
