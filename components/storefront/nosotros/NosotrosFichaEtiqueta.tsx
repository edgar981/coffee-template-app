"use client";

// LA FICHA «ETIQUETA DE BOLSA» (§ CHAMISAS-NOSOTROS-ALBUM-1, refero-chamisas.md §3 punto 4: "Ficha
// de origen como etiqueta de la bolsa. Retícula de dos columnas con iconos de línea, igual que el
// panel de la bolsa, con borde punteado y el sello de una tinta como estampilla"). Segunda
// composición de `nosotrosFicha`, hermana de la canónica («tinta», el capítulo verde con cifras)
// bajo el mismo dispatcher (`NosotrosFicha.tsx`).
//
// LEE `tiendaCreditos.items`, igual que «tinta» — CERO duplicación nueva: la ÚNICA diferencia es el
// LAYOUT (retícula de dos columnas con borde punteado, en vez de columna invertida sobre fondo
// tinta). Las TRES cifras quedan SIN EFECTO bajo esta composición (§ el docstring de
// `NosotrosFichaContent`).
//
// EL ÍCONO ES UNO SOLO, decorativo, repetido en cada fila — no hay un dato de "ícono por etiqueta"
// en el modelo (serían N campos nuevos por una fila de la que no hay garantía de cardinalidad fija),
// así que una marca de línea NEUTRA (no un ícono de café) cumple "iconos de línea" sin inventar una
// capacidad de selección que nadie pidió.
//
// § CHAMISAS-APERTURA-ALBUM-AJUSTES-1 — CUATRO AJUSTES medidos contra la maqueta
// (`.scratch/chamisas-paginas/nosotros-suscripciones.html`, `.fic`/`.fic-g`/`.fic-tx`/`.fic-card`):
//
// 1. COLUMNA DE TEXTO a la izquierda (`titulo`/`bajada`, § `NosotrosFichaContent`) — ESTE era el
//    hueco que el defecto medía: sin estos dos campos el dueño escribió la bajada DENTRO de `sello`,
//    porque no había otro campo libre bajo esta composición. `eyebrow` se REUSA (mismo campo que
//    «tinta»); `titulo`/`bajada` son NUEVOS, sólo con efecto acá.
// 2. LA TARJETA gana `tituloTarjeta` (el h3 "Café {negocio} · origen" de la maqueta — texto LIBRE del
//    dueño, nunca derivado de `SiteSetting.nombre`: este componente no tiene el `negocio` por prop,
//    § CLAUDE.md "El {negocio} del fallback llega por PROP" — y `notaPie` (la frase de cierre bajo la
//    retícula). Los DOS opcionales, § el invariante #44 — ningún claim de origen/país se fabrica.
// 3. EL SELLO se reposiciona (`top:-30px`/`right:12px`, rotado -12°, como `.fic-seal` de la maqueta —
//    ANTES vivía a `-top-4 right-6 rotate-[-6deg]`, ni la posición ni el ángulo correctos) y la grilla
//    de créditos pasa a DOS COLUMNAS CON FILETE PUNTEADO superior (`border-t border-dashed`, como
//    `.fc{border-top:1px dashed var(--field)}`), no `border-b` sólido — el filete PUNTEADO es el
//    lenguaje visual de toda la pieza (el borde de la tarjeta, el lomo del álbum vecino).
// 4. SIN FILAS COMPLETAS, LA TARJETA SIGUE RENDERIZANDO — con una grilla vacía, nunca un bloque en
//    blanco: el gate real (`creditosVisibles`) vive en `NosotrosFicha.tsx`, ANTES de llegar acá
//    (§ ese dispatcher); si esta pieza se alcanza a renderizar, SIEMPRE hay ≥3 filas.
//
// § CHAMISAS-NOSOTROS-ARCO-Y-FICHA-1 — CADA FILA LLEVA SU PROPIO ÍCONO, no el mismo `Minus`
// repetido (refero-chamisas.md §3 punto 4: "retícula... con iconos de línea"). `fichaIcono`
// (`lib/storefront/ficha-iconos.ts`, puro, capa 1) deriva la clave de la ETIQUETA de la fila —no un
// campo nuevo del modelo (§ el párrafo de arriba, "no hay un dato de ícono por etiqueta... una
// capacidad de selección que nadie pidió" sigue en pie: esto no la contradice, sólo reemplaza el
// ícono NEUTRO único por un ícono NEUTRO-POR-DATO, derivado, nunca elegido a mano)—; `ICONOS_FICHA`
// es el ÚNICO lugar que traduce esa clave a un componente de lucide-react.
// § CHAMISAS-NOSOTROS-FIDELIDAD-1 — TRES AJUSTES medidos contra la maqueta (`.fic-card`/`.fic-seal`,
// `.scratch/chamisas-paginas/nosotros-suscripciones.html`) y contra captura real
// (`.capturas/chamisas-baseline-*`, antes de este fix):
//
// 1. EL SELLO ERA UNA PÍLDORA DE TEXTO (`nosotrosFicha.sello`, borde + fondo + texto) — la maqueta
//    usa una IMAGEN (`.fic-seal{width:96/124px;rotate:-12deg;mix-blend-mode:multiply;opacity:.92}`,
//    sin fondo ni borde propios: el sello es arte, no texto compuesto en vivo). Con texto largo la
//    píldora (`whitespace-nowrap`) se salía de la pantalla en celular — el ancho FIJO de una imagen
//    no tiene ese riesgo.
//
//    Se reemplaza por `LogoMark` (`@/components/storefront/Logo`), el MISMO mark de marca del
//    storefront que ya cumple este rol en otra pieza de fidelidad de Las Chamisas —
//    `EstadoPedido.tsx` lo monta como "un SELLO (`LogoMark`, el mark de marca del storefront — el
//    punto de swap por-despliegue, nunca un logo fabricado para esta captura)"—, puesto en la MISMA
//    posición/rotación/tamaño que `.fic-seal`. Es el punto de SWAP por-despliegue (§ CLAUDE.md, "El
//    WORDMARK carga la identidad; el MARK es asset por-despliegue"): el despliegue real de Las
//    Chamisas reemplaza el SVG de la flor por SU sello ilustrado, sin tocar este componente.
//
//    CONSECUENCIA DECLARADA: `nosotrosFicha.sello` queda SIN NINGÚN consumidor en todo el registro
//    (era el único). No se retira del modelo —`site-content-defaults.ts`/`site-content-schema.ts`
//    son Tier 1, fuera de `touches:` de este slice—; queda como open follow-up.
// 2. EL COLOR DE LA TARJETA ERA `--sf-superficie` — la maqueta usa `--paper` (`.fic-card{background:
//    var(--paper)}`), un crema más CLARO que `--surface`. `--sf-papel` (`app/globals.css`) es su
//    equivalente ya tokenizado en este repo (el mismo matiz, "levemente distinto de `--sf-fondo`").
// 3. LA SECCIÓN NO TENÍA AIRE ANTES DEL INTERLUDIO — medido en captura real: el fondo (entonces
//    oscuro, § la corrección de abajo) de `NosotrosInterludioStickers` arrancaba en el mismo punto
//    donde terminaba la tarjeta de la ficha, sin un solo píxel de crema entre medio. La causa no es
//    esta pieza (que, como la maqueta, sólo lleva padding-TOP, nunca inferior — el `.fic{padding:72px
//    0 0}` de la maqueta tampoco lo tiene): era que `NosotrosInterludioStickers` pintaba su fondo con
//    `py-*` (padding, que el propio color de fondo rellena) donde la maqueta usa `margin`
//    (`.inter{margin:80px 0 0}`, que SÍ deja ver el fondo del padre antes). El fix vive en ese
//    archivo, no en éste.
//
//    CORRECCIÓN (§ CHAMISAS-NOSOTROS-MAQUETA-1): "el fondo OSCURO de `NosotrosInterludioStickers`"
//    (arriba) describía el estado de § CHAMISAS-NOSOTROS-ARCO-E-INTERLUDIO-1, sin re-verificar contra
//    la maqueta vigente — medido de nuevo (tres fuentes: el HTML, la captura del owner y
//    `v-d-nosotros.jpg`), esa sección es CREMA, no oscura; sólo la franja de tejido (delgada, a
//    sangre) cruza detrás de las tarjetas. El punto 3 de arriba (margen vs. padding) sigue siendo
//    correcto y no se tocó; sólo el color del fondo que describía estaba mal.
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { MapPin, Mountain, Sprout, Droplet, Calendar, Users, Coffee, Package, Minus, type LucideIcon } from 'lucide-react';
import { filasCompletas } from '@/lib/tienda/creditos';
import { fichaIcono } from '@/lib/storefront/ficha-iconos';
import { contenedorAnchoClase } from '@/lib/config/themes';
import CampoEditable from '@/components/storefront/CampoEditable';
import { LogoMark } from '@/components/storefront/Logo';

const ICONOS_FICHA: Record<ReturnType<typeof fichaIcono>, LucideIcon> = {
  origen: MapPin,
  altitud: Mountain,
  variedades: Sprout,
  proceso: Droplet,
  cosecha: Calendar,
  familias: Users,
  tostion: Coffee,
  presentacion: Package,
  neutro: Minus,
};

export default function NosotrosFichaEtiqueta() {
  const { nosotrosFicha, tiendaCreditos, navTratamiento } = useSiteContent();
  const filas = filasCompletas(tiendaCreditos.items);
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);
  const { eyebrow, titulo, bajada, tituloTarjeta, notaPie } = nosotrosFicha;

  return (
    <section className="bg-[var(--sf-fondo)] pt-[72px] lg:pt-[104px]">
      <div className={`${contenedorClase} mx-auto grid gap-[22px] lg:grid-cols-[4fr_7fr] lg:items-start lg:gap-16`}>
        {/* LA COLUMNA DE TEXTO (§ el ajuste 1, arriba). */}
        <div>
          {eyebrow.trim() !== '' && (
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--sf-tinta)]">
              <CampoEditable campo="nosotrosFicha.eyebrow">{eyebrow}</CampoEditable>
            </p>
          )}
          {titulo.trim() !== '' && (
            <h2 className="mt-1.5 font-playfair text-[28px] leading-[1.15] text-[var(--sf-tinta)] lg:text-[32px]">
              <CampoEditable campo="nosotrosFicha.titulo">{titulo}</CampoEditable>
            </h2>
          )}
          {bajada.trim() !== '' && (
            <p className="mt-2.5 max-w-[40ch] text-[16px] text-[var(--sf-tinta)]">
              <CampoEditable campo="nosotrosFicha.bajada" multilinea>{bajada}</CampoEditable>
            </p>
          )}
        </div>

        {/* LA TARJETA PUNTEADA. SIN `overflow-hidden` a propósito (§ el mismo defecto que la Apertura
            «Álbum», § CHAMISAS-APERTURA-ALBUM-AJUSTES-1 — el sello cuelga de un borde NEGATIVO
            (`-top-[30px]`): recortarlo lo habría cortado contra la propia tarjeta, igual que el
            sticker se cortaba contra el arco. No hace falta para redondear: no hay una imagen a
            sangre adentro que necesite máscara, sólo texto con relleno. */}
        <div
          className="relative rounded-[24px] border-2 border-dashed border-[var(--sf-tinta)] p-5 pt-5 pb-[14px] lg:p-7 lg:pb-[18px]"
          style={{ backgroundColor: 'var(--sf-papel)' }}
        >
          {tituloTarjeta.trim() !== '' && (
            <h3 className="pr-24 font-playfair text-xl text-[var(--sf-tinta)] lg:text-2xl">
              <CampoEditable campo="nosotrosFicha.tituloTarjeta">{tituloTarjeta}</CampoEditable>
            </h3>
          )}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2">
            {filas.map((fila, i) => {
              const Icono = ICONOS_FICHA[fichaIcono(fila.etiqueta)];
              return (
              <div
                key={`${fila.etiqueta}-${i}`}
                className="flex items-start gap-2.5 border-t border-dashed border-[var(--sf-tinta)]/25 py-3 sm:[&:nth-child(odd)]:border-r sm:[&:nth-child(odd)]:pr-5 sm:[&:nth-child(even)]:pl-5"
              >
                <Icono aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[var(--sf-tinta)]" />
                <div>
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--sf-tinta)]/70">{fila.etiqueta}</p>
                  <p className="font-playfair text-[15px] text-[var(--sf-tinta)] lg:text-[17px]">{fila.valor}</p>
                </div>
              </div>
              );
            })}
          </div>
          {notaPie.trim() !== '' && (
            <p className="mt-2.5 text-[13px] text-[var(--sf-tinta)]/60">
              <CampoEditable campo="nosotrosFicha.notaPie">{notaPie}</CampoEditable>
            </p>
          )}
          {/* EL SELLO — IMAGEN, no texto (§ el ajuste 1, arriba). SIEMPRE visible, sin gate de
              contenido: es el mark de marca (punto de swap por-despliegue), no un dato que el
              dueño pueda vaciar — mismo criterio que `EstadoPedido.tsx` ya aplica a este rol. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-[30px] right-3 z-10 h-24 w-24 -rotate-12 opacity-[0.92] mix-blend-multiply lg:-top-10 lg:right-6 lg:h-[124px] lg:w-[124px]"
          >
            <LogoMark className="h-full w-full" stroke="var(--sf-acento)" cherry="var(--sf-tinta)" />
          </div>
        </div>
      </div>
    </section>
  );
}
