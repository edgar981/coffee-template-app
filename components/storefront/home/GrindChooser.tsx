"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { fadeUp } from "@/lib/animation";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { REGISTRY, seccionEsVisible } from "@/lib/config/site-content-defaults";
import { tarjetasDePresentaciones, gridColsPresentaciones } from "@/lib/storefront/presentaciones";

// "¿Cómo tomas tu café?" — las tarjetas de presentación, EDITABLES desde SiteContent (sección
// `presentaciones`). Antes era la única sección de la home hardcodeada; hoy lee del provider como las
// otras cuatro.
//
// CARDINALIDAD VARIABLE 2-4 sobre campos PLANOS (NO un repeater — un repeater no da defaults
// byte-idénticos, § doctrina). Qué tarjetas se muestran (2 requeridas + hasta 2 opcionales, con título
// O imagen) y el grid por conteo salen de `tarjetasDePresentaciones`/`gridColsPresentaciones` (capa 1
// pura), NO del resolver — así 2→4 no toca ni el resolver ni #44. El DESTINO de cada tarjeta es DATO
// editable (`categoriaN`); el href lo construye `hrefCategoria`. Nayoli (2) queda byte-idéntica.
//
// EL `negocio` DEL ALT LLEGA POR PROP, no por `useSiteSettings()` — es IDENTIDAD, no contenido, y se
// queda leyendo el nombre del negocio (no se mueve a SiteContent). Pero llega por prop porque este
// componente se monta también en la VISTA PREVIA del panel (árbol admin, SIN el SiteSettingsProvider
// del storefront → el hook LANZARÍA). La home lo pasa desde el nombre del negocio; el preview va sin
// prop → alt genérico (irrelevante en un preview). Mismo patrón que NosotrosGaleria (§ el {negocio}
// del fallback llega por PROP).
export default function GrindChooser({ negocio }: { negocio?: string }) {
  const { presentaciones } = useSiteContent();
  const preview = useIsPreview();
  if (!seccionEsVisible(REGISTRY.presentaciones, presentaciones)) return null;

  const tarjetas = tarjetasDePresentaciones(presentaciones);
  const gridCols = gridColsPresentaciones(tarjetas.length);

  return (
    <section className="py-20 bg-[var(--sf-fondo)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* En el preview escalado, `whileInView` no dispara (la intersección no llega) → se cambia a
            `animate` con `initial={false}`, asentado desde el primer render. Fuera de preview, idéntico. */}
        <motion.div
          initial={preview ? false : "hidden"}
          animate={preview ? "visible" : undefined}
          whileInView={preview ? undefined : "visible"}
          viewport={preview ? undefined : { once: true }}
          variants={fadeUp}
          className="text-center mb-12"
        >
          {presentaciones.eyebrow && (
            <p className="text-[var(--sf-acento-texto)] text-xs font-medium tracking-[0.2em] uppercase mb-2">{presentaciones.eyebrow}</p>
          )}
          <h2 className="text-3xl sm:text-4xl font-playfair text-[var(--sf-tinta)]">{presentaciones.titulo}</h2>
        </motion.div>
        <div className={`grid grid-cols-1 ${gridCols} gap-6`}>
          {tarjetas.map((op, i) => (
            <motion.div
              key={i}
              initial={preview ? false : "hidden"}
              animate={preview ? "visible" : undefined}
              whileInView={preview ? undefined : "visible"}
              viewport={preview ? undefined : { once: true }}
              variants={fadeUp}
              transition={{ delay: i * 0.08 }}
            >
              {/* `data-sf-tarjeta`: marcador INERTE del slot (1-4) para el puente vista→formulario del
                  editor (§ Backlog #46). Se emite SÓLO en preview (`useIsPreview`) → en la tienda del
                  visitante la propiedad es `undefined` y React OMITE el atributo: markup byte-idéntico,
                  cero efecto visible. No es un import del admin ni una prop de comportamiento: es un
                  atributo de datos que nadie lee salvo el capture-handler del editor. */}
              <Link href={op.href} data-sf-tarjeta={preview ? op.slot : undefined} className="group relative flex flex-col justify-end overflow-hidden rounded-3xl aspect-[4/5] sm:aspect-[3/2] bg-[var(--sf-linea)]">
                {/* Imagen condicional: una tarjeta opcional puede mostrarse SÓLO con título (criterio
                    OR); sin foto se ve el fondo `--sf-linea` de la tarjeta —un hueco VISIBLE que el
                    cliente sabe llenar—, nunca un `<img src="">` roto que pide la URL de la página. */}
                {op.img && (
                  <Image
                    src={op.img}
                    alt={negocio ? `${negocio} ${op.label}` : op.label}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--sf-tinta)]/80 via-[var(--sf-tinta)]/20 to-transparent" />
                <div className="relative p-8">
                  <h3 className="text-2xl sm:text-3xl font-playfair text-white mb-1">{op.label}</h3>
                  <p className="text-white/80 text-sm mb-4 max-w-xs">{op.copy}</p>
                  <span className="inline-flex items-center gap-2 text-[var(--sf-tostado)] font-semibold text-sm group-hover:gap-3 transition-all">
                    Ver café {op.label.toLowerCase()} <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
