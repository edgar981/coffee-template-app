"use client";

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getCatalog } from '@/lib/api/products';
import type { Product } from '@/types/product';
import { useSiteContent } from '@/components/storefront/SiteContentProvider';

// EL ENCABEZADO de /tienda (§ TIENDA-PAGINA-REGISTRO-1): título + conteo de productos + leyenda.
// Antes vivía inline en `ShopLegacy`/`ShopCorte` (app/(storefront)/tienda/page.tsx); se extrae para
// que /tienda entre al editor como página, con UNA composición «Actual» que reproduce byte a byte lo
// de hoy — las dos ramas de SIEMPRE (`navTratamiento.posicion`) se conservan, este componente no las
// unifica ni re-estiliza.
//
// HEADLESS a propósito: no monta ningún div wrapper propio. `page.tsx` sigue siendo dueño de TODOS
// los divs de layout de cada rama (el panel `--sf-superficie` de legacy, el contenedor compartido de
// corte con el catálogo) — moverlos acá habría exigido partir el `py-16` que corte comparte con
// `TiendaCatalogo` en un solo div, arriesgando el byte-idéntico por un cálculo de padding que sólo
// se puede confirmar MIDIENDO (§ verificar:nayoli). Sin `bandaId` (como /nosotros y /suscripciones,
// § el censo `TIENDA-COMPOSICIONES-CENSO-1`): /tienda nunca llama a `esquemaStyle`, así que no hay
// esquema real que aplicarle y no necesita `style` (§ VistaTiendaEnVivo.tsx, "las seis de /nosotros
// y /suscripciones lo ignoran").
//
// El CONTEO de productos sigue siendo DATO VIVO (`getCatalog`, la MISMA fuente que `TiendaCatalogo`
// — independiente a propósito, § el patrón ya establecido: Marquesina/Spotlight/FeaturedProducts*
// ya fetchean el catálogo cada uno por su cuenta), nunca contenido editable — sólo `titulo`/
// `leyenda` lo son.
export default function TiendaEncabezado() {
  const { tiendaEncabezado, navTratamiento } = useSiteContent();
  const [catalog, setCatalog] = useState<Product[] | null>(null);
  useEffect(() => {
    getCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);
  const conteo = catalog === null ? 'Cargando' : `${catalog.length} productos`;

  // DOS hijos, no uno (`{conteo}{' · ' + leyenda}`) — MEDIDO contra `verificar:nayoli`: el JSX de
  // hoy era `{ternario} · Origen colombiano` (expresión + texto estático, DOS hijos), y React 19
  // inserta un comentario `<!-- -->` de frontera de hidratación ENTRE hijos de texto adyacentes.
  // Un solo template-literal (`${conteo} · ${leyenda}`, UN hijo) lo habría hecho desaparecer —
  // byte distinto, visto fallar en el diff real antes de este fix.
  if (navTratamiento.posicion) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-playfair text-4xl text-[var(--sf-tinta)] mb-2">{tiendaEncabezado.titulo}</h1>
        <p className="text-sm text-[var(--sf-texto)]">{conteo}{` · ${tiendaEncabezado.leyenda}`}</p>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="text-4xl font-playfair text-[var(--sf-sobre-superficie,var(--sf-tinta))] mb-2">{tiendaEncabezado.titulo}</h1>
      <p className="text-[var(--sf-sobre-superficie,var(--sf-texto))] text-sm">{conteo}{` · ${tiendaEncabezado.leyenda}`}</p>
    </motion.div>
  );
}
