"use client";

import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { REGISTRY, seccionEsVisible } from "@/lib/config/site-content-defaults";
import { creditosVisibles, filasCompletas } from "@/lib/tienda/creditos";
import { CreditosFilas } from "@/components/storefront/tienda/TiendaCreditos";
import { contenedorAnchoClase } from "@/lib/config/themes";
import CampoEditable from "@/components/storefront/CampoEditable";

// LA «FICHA» de /nosotros (§ ONIX-NOSOTROS-ESCENAS-FICHA-1, sobre ONIX-PAGINAS-COMPOSICIONES-
// CENSO-1). El capítulo verde de la maqueta: tres cifras grandes a la izquierda (número + rótulo,
// slots FIJOS) y los créditos de /tienda a la derecha, en colores invertidos.
//
// LOS CRÉDITOS NO SE DUPLICAN: esta sección LEE `tiendaCreditos.items` directo —`SiteContentProvider`
// monta TODO el contenido en TODO el storefront (§ el censo de este slice), así que /nosotros puede
// leer una sección de /tienda sin que el dato viva dos veces, y editar "Créditos: ficha de origen" en
// /tienda actualiza esta banda también—. Se editan en UN solo sitio.
//
// DOS GATES DE VISIBILIDAD, mismo patrón que `tiendaCreditos` consigo misma: el toggle `visible`
// (ocultable) Y el PISO de `tiendaCreditos` (`creditosVisibles`, lib/tienda/creditos.ts — menos de 3
// filas completas, la sección se oculta aunque el interruptor esté encendido). Con Nayoli (ambas
// secciones vacías) el piso ya la mantiene oculta sin que el toggle tenga que ayudar.
//
// LAS TRES CIFRAS son slots FIJOS, no un repeater (§ REGISTRY.nosotrosFicha): cada una se omite si su
// `numero` está vacío — "slot sobrevive al filtro", mismo criterio que los bullets de subscriptionCTA.
// Una sola fila (`flex justify-between`) sirve para los DOS breakpoints — sólo cambia el tamaño del
// número (56px celular / 120px escritorio, § el spec); la maqueta (`s-nos-d-3.png`/`s-nos-m-1.png`)
// muestra la MISMA composición número-izquierda/rótulo-derecha en los dos anchos, no un layout
// distinto.
export default function NosotrosFicha() {
  const { nosotrosFicha, tiendaCreditos, navTratamiento } = useSiteContent();
  if (!seccionEsVisible(REGISTRY.nosotrosFicha, nosotrosFicha)) return null;
  if (!creditosVisibles(tiendaCreditos.items)) return null;

  const cifras = [
    { slot: 1 as const, numero: nosotrosFicha.cifra1Numero, rotulo: nosotrosFicha.cifra1Rotulo },
    { slot: 2 as const, numero: nosotrosFicha.cifra2Numero, rotulo: nosotrosFicha.cifra2Rotulo },
    { slot: 3 as const, numero: nosotrosFicha.cifra3Numero, rotulo: nosotrosFicha.cifra3Rotulo },
  ].filter((c) => c.numero.trim() !== "");

  const filas = filasCompletas(tiendaCreditos.items);
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);

  return (
    <section className="bg-[var(--sf-tinta)] py-20">
      <div className={`${contenedorClase} mx-auto`}>
        {/* ROTULO EN VERDE SALVIA (§ ONIX-PAGINAS-FIDELIDAD-1, el spec item 3): la maqueta pinta el
            eyebrow y el rótulo de cada cifra en `#C9D1C3`, no crema apagada. Generalizado como
            crema al 80% —no al 70% de antes— compuesta DIRECTO sobre la tinta sólida del fondo: es
            la MISMA mecánica que ya usaba este componente (opacidad sobre `--sf-fondo`), sólo que a
            ~80% la mezcla óptica resultante es un verde-grisáceo claro (medido contra las raíces de
            Onix: ≈ `#c9ccc2`, a un paso de distancia perceptual de `#C9D1C3`) en vez del gris-crema
            de `/70` — nunca un hex fijo de Onix, cualquier tenant deriva SU propio salvia de SU
            propia tinta. */}
        {nosotrosFicha.eyebrow.trim() !== "" && (
          <p className="mb-10 text-xs font-medium uppercase tracking-[0.2em] text-[var(--sf-fondo)]/80">
            <CampoEditable campo="nosotrosFicha.eyebrow">{nosotrosFicha.eyebrow}</CampoEditable>
          </p>
        )}
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[5fr_7fr] lg:gap-16">
          {cifras.length > 0 && (
            <div>
              {/* FILETE ABAJO DE CADA UNA (§ ONIX-PAGINAS-FIDELIDAD-1, R3) — la maqueta pone
                  `border-bottom` en LAS TRES, nunca `border-top` con excepción de la primera (lo que
                  había). PESO 300 (§ el spec item 3, "las cifras en peso 300"): la maqueta pinta el
                  número en `font-weight:300`, más fino que el 400 que Playfair/Roboto Serif
                  renderizan por defecto. */}
              {cifras.map((c) => (
                <div
                  key={c.slot}
                  className="flex items-baseline justify-between gap-4 border-b border-[var(--sf-fondo)]/20 py-3"
                >
                  <span className="font-playfair text-[56px] font-light leading-[0.9] tabular-nums text-[var(--sf-fondo)] sm:text-[120px]">
                    <CampoEditable campo={`nosotrosFicha.cifra${c.slot}Numero`}>{c.numero}</CampoEditable>
                  </span>
                  <span className="shrink-0 pb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--sf-fondo)]/80 sm:pb-3">
                    <CampoEditable campo={`nosotrosFicha.cifra${c.slot}Rotulo`}>{c.rotulo}</CampoEditable>
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className={cifras.length > 0 ? "" : "lg:col-start-2"}>
            <CreditosFilas filas={filas} invertido />
          </div>
        </div>
      </div>
    </section>
  );
}
