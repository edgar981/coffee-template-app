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
        {nosotrosFicha.eyebrow.trim() !== "" && (
          <p className="mb-10 text-xs font-medium uppercase tracking-[0.2em] text-[var(--sf-fondo)]/70">
            <CampoEditable campo="nosotrosFicha.eyebrow">{nosotrosFicha.eyebrow}</CampoEditable>
          </p>
        )}
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[5fr_7fr] lg:gap-16">
          {cifras.length > 0 && (
            <div>
              {cifras.map((c) => (
                <div
                  key={c.slot}
                  className="flex items-baseline justify-between gap-4 border-t border-[var(--sf-fondo)]/20 py-3 first:border-t-0 first:pt-0"
                >
                  <span className="font-playfair text-[56px] leading-[0.9] tabular-nums text-[var(--sf-fondo)] sm:text-[120px]">
                    <CampoEditable campo={`nosotrosFicha.cifra${c.slot}Numero`}>{c.numero}</CampoEditable>
                  </span>
                  <span className="shrink-0 pb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--sf-fondo)]/70 sm:pb-3">
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
