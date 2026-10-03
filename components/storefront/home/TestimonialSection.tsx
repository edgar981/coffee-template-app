"use client";

import { Star } from "lucide-react";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { REGISTRY, seccionEsVisible } from "@/lib/config/site-content-defaults";
import { fontSizeDisplay } from "@/lib/config/escala-display";
import { contenedorAnchoClase } from "@/lib/config/themes";
import RevelarBloque from "@/components/storefront/RevelarBloque";
import CampoEditable from "@/components/storefront/CampoEditable";

// "Lo que dicen nuestros clientes" — la 1ª sección REPEATER: encabezado (eyebrow/titulo) + una LISTA
// de testimonios leída de SiteContent. Cada ítem: name/text (requeridos, vienen resueltos), city y
// product (opcionales → se OMITEN vacíos), y `stars`. OCULTABLE + hide-on-empty: con `items` vacío,
// self-gate → null (la home la rinde como hermano plano, sin hueco ni separador).
//
// Los tres testimonios que vivían acá eran FABRICADOS (citaban productos que Nayoli no vende); se
// retiraron del CÓDIGO (§ SiteContent — el repeater). La sección sigue existiendo — vuelve con testimonios REALES cuando
// el owner los cargue como dato por el editor.
//
// LA ENTRADA (§ SECCIONES-ENTRAN-VIVAS-1): antetítulo y título entran por separado (`RevelarBloque`),
// y cada testimonio entra escalonado por índice — mismo mecanismo que antes (un paso por tarjeta),
// ahora con las cifras/curva/disparo tardío/repetición de la primitiva compartida.
export default function TestimonialSection({ style }: { style?: React.CSSProperties } = {}) {
  const { testimonials, tema, navTratamiento } = useSiteContent();
  const preview = useIsPreview();
  if (!seccionEsVisible(REGISTRY.testimonials, testimonials)) return null;

  const { eyebrow, titulo, items } = testimonials;
  // ESCALA DE DISPLAY (§ TEMAS-ESCALA-DISPLAY-1): `undefined` sin escala declarada → NO se toca el
  // `style` del h2, que sigue rindiendo exactamente `text-3xl` (1.875rem, fijo, medido) —
  // byte-idéntico.
  const displayL = fontSizeDisplay(tema.escalaDisplay, 'l');
  // EL CONTENEDOR (§ PARIDAD-ANCHO-CONTENIDO-1) — ver el docstring de `contenedorAnchoClase`
  // (`lib/config/themes.ts`) para el porqué de reusar `navTratamiento.posicion` acá. `false`
  // (todo tenant salvo CORTE) = el literal de HOY, byte a byte.
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);

  return (
    <section className="py-20 bg-[var(--sf-banda,var(--sf-fondo))]" style={style}>
        <div className={`${contenedorClase} mx-auto`}>
          <div className="text-center mb-12">
            {/* Eyebrow/título SOBRE EL FONDO de la banda: `--sf-sobre-banda` con el literal de hoy
                como fallback (§ eje 5b, home-2). Las tarjetas de testimonio de abajo NO se tocan:
                su texto va sobre `--sf-tarjeta`. */}
            {eyebrow && <RevelarBloque as="p" indice={0} preview={preview} className="text-[var(--sf-sobre-banda,var(--sf-acento-texto))] text-xs font-medium tracking-[0.2em] uppercase mb-2"><CampoEditable campo="testimonials.eyebrow">{eyebrow}</CampoEditable></RevelarBloque>}
            <RevelarBloque as="h2" indice={1} preview={preview} className="text-3xl font-playfair text-[var(--sf-sobre-banda,var(--sf-tinta))]" style={displayL ? { fontSize: displayL } : undefined}><CampoEditable campo="testimonials.titulo">{titulo}</CampoEditable></RevelarBloque>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {items.map((t, i) => {
              // CINCO estrellas (llenas/vacías), no sólo las llenas: un 3 se lee "3 de 5", no tres sueltas.
              const estrellas = Math.max(0, Math.min(5, Math.round(Number(t.stars) || 0)));
              // `city`/`product` se muestran COMBINADOS (§ abajo) pero cada uno sigue siendo SU
              // PROPIO campo de SiteContent — no hay un tercer campo "atribución" que editar.
              const tieneAtribucion = Boolean(t.city) || Boolean(t.product);
              return (
                <RevelarBloque
                  key={i}
                  indice={i}
                  preview={preview}
                  className="bg-[var(--sf-tarjeta)] rounded-2xl p-6 shadow-sm sf-borde border-[var(--sf-linea)]"
                >
                  <div className="flex gap-1 mb-4">
                    {[1, 2, 3, 4, 5].map(n => (
                      <Star key={n} className="w-4 h-4" style={{ fill: n <= estrellas ? "var(--sf-tostado)" : "transparent", color: n <= estrellas ? "var(--sf-tostado)" : "var(--sf-tostado-7)" }} />
                    ))}
                  </div>
                  {/* El texto del testimonio va SUAVE (no principal): es cuerpo, no un encabezado —el
                      nombre de abajo ya es principal—, y `acento-2` es de la familia `acento` (mismo
                      linaje que `acento-texto`, la fuente de `sobre-tarjeta-suave`), no de `tinta` (§
                      TEMAS-P6-FAMILIAS-CIERRE-1). Fallback a `--sf-acento-2`, su propio token de
                      siempre → Nayoli byte-idéntico. */}
                  <p className="text-[var(--sf-sobre-tarjeta-suave,var(--sf-acento-2))] text-sm leading-relaxed mb-4">&quot;<CampoEditable campo={`testimonials.items.${i}.text`} multilinea>{t.text}</CampoEditable>&quot;</p>
                  {/* La tarjeta entera vive sobre bg-[var(--sf-tarjeta)] (arriba); los CUATRO roles
                      (texto, avatar, nombre, atribución) pasan al PAR de la familia `tarjeta`
                      (§ TEMAS-P6-FAMILIAS-1/CIERRE-1), floreado contra ELLA — no contra
                      `--sf-tinta`/`--sf-acento-texto`/`--sf-acento-2` (de otras familias), que
                      medían hasta 1.067:1 con NAYOLI en un esquema asignado (§ el cuadro del commit).
                      Fallback al texto de hoy: sin esquema (el caso real), cero cambio visual. */}
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[var(--sf-linea)] flex items-center justify-center">
                      <span className="text-xs font-semibold text-[var(--sf-sobre-tarjeta-suave,var(--sf-acento-texto))]">{(t.name || "?")[0]}</span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[var(--sf-sobre-tarjeta,var(--sf-tinta))]"><CampoEditable campo={`testimonials.items.${i}.name`}>{t.name}</CampoEditable></p>
                      {/* `city`/`product` son DOS campos de SiteContent que se muestran COMBINADOS en
                          UNA línea (§ arriba, "no hay un tercer campo atribución") — cada uno lleva
                          su PROPIO marcador, con el " · " literal entre los dos sólo cuando AMBOS
                          tienen valor. Fuera de modo editor, `CampoEditable` no agrega nodos, así
                          que el texto plano sigue siendo "Ciudad · Producto" / "Ciudad" / "Producto",
                          byte a byte lo que `atribucion` ya rendía antes de este slice. */}
                      {tieneAtribucion && (
                        <p className="text-xs text-[var(--sf-sobre-tarjeta-suave,var(--sf-acento-texto))]">
                          {t.city && <CampoEditable campo={`testimonials.items.${i}.city`}>{t.city}</CampoEditable>}
                          {t.city && t.product && " · "}
                          {t.product && <CampoEditable campo={`testimonials.items.${i}.product`}>{t.product}</CampoEditable>}
                        </p>
                      )}
                    </div>
                  </div>
                </RevelarBloque>
              );
            })}
          </div>
        </div>
      </section>
  )
}
