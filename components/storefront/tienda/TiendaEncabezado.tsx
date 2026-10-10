"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { getCatalog } from '@/lib/api/products';
import type { Product } from '@/types/product';
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { useIsPreview } from '@/components/storefront/PreviewMode';
import { mostrarSelectorAntojo, pildorasAntojo } from '@/lib/tienda/antojo';
import { lavadoLamina } from '@/lib/tienda/laminas';
import Movimiento from '@/components/storefront/movimiento/Movimiento';
import type { TiendaEncabezadoContent } from '@/lib/config/site-content-defaults';

// EL FALLBACK DEL TÍTULO (§ TIENDA-ONIX-CARTELERA-1): `titulo` es OPCIONAL desde este slice (ver el
// docstring de `TiendaEncabezadoContent`, site-content-defaults.ts) — el resolver ya NO lo rellena
// con 'Nuestra Tienda' cuando una fila lo guarda vacío. «Actual»/«Carta» aplican EXACTAMENTE ese
// mismo texto acá, a nivel de componente, para quedar byte-idénticas; «Apertura» cae al nombre del
// negocio en su lugar (§ abajo).
const TITULO_POR_DEFECTO = 'Nuestra Tienda';

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
export default function TiendaEncabezado({ negocio }: { negocio?: string } = {}) {
  const { tiendaEncabezado, tiendaCatalogo, navTratamiento } = useSiteContent();
  const [catalog, setCatalog] = useState<Product[] | null>(null);
  useEffect(() => {
    getCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);
  const conteo = catalog === null ? 'Cargando' : `${catalog.length} productos`;
  const titulo = tiendaEncabezado.titulo || TITULO_POR_DEFECTO;

  // LA COMPOSICIÓN «APERTURA» (§ TIENDA-ONIX-CARTELERA-1, la forma C aprobada) — foto a pantalla
  // completa con el H1 gigante encima; sin ella, una superficie de color tinta con el mismo título.
  // Es, como «Carta», INDEPENDIENTE de `navTratamiento.posicion` y rompe el contenedor de ancho
  // máximo (§ `page.tsx`, `ShopApertura` monta esta sección FUERA de `contenedorClase`).
  if (tiendaEncabezado.variante === 'apertura') {
    return <TiendaApertura tiendaEncabezado={tiendaEncabezado} negocio={negocio} />;
  }

  // LA COMPOSICIÓN «CARTA» (§ TIENDA-CHAMISAS-ALBUM-1) — la línea «cálida, hecha por mujeres»:
  // H1 en serif minúscula, un sticker girado opcional, una intro opcional en primera persona, y el
  // selector «¿Qué te provoca?» (sólo con 6 productos o menos, § `mostrarSelectorAntojo`; con más,
  // NO se dibuja nada acá — quedan los filtros de «Actual», que vive en `TiendaCatalogo`). Es
  // INDEPENDIENTE de `navTratamiento.posicion`: el álbum tiene su propio tratamiento visual, no las
  // dos ramas Legacy/Corte.
  if (tiendaEncabezado.variante === 'carta') {
    return <TiendaCarta tiendaEncabezado={{ ...tiendaEncabezado, titulo }} catalog={catalog} coloresPorProducto={tiendaCatalogo.coloresPorProducto} />;
  }

  // DOS hijos, no uno (`{conteo}{' · ' + leyenda}`) — MEDIDO contra `verificar:nayoli`: el JSX de
  // hoy era `{ternario} · Origen colombiano` (expresión + texto estático, DOS hijos), y React 19
  // inserta un comentario `<!-- -->` de frontera de hidratación ENTRE hijos de texto adyacentes.
  // Un solo template-literal (`${conteo} · ${leyenda}`, UN hijo) lo habría hecho desaparecer —
  // byte distinto, visto fallar en el diff real antes de este fix.
  if (navTratamiento.posicion) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-playfair text-4xl text-[var(--sf-tinta)] mb-2">{titulo}</h1>
        <p className="text-sm text-[var(--sf-texto)]">{conteo}{` · ${tiendaEncabezado.leyenda}`}</p>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="text-4xl font-playfair text-[var(--sf-sobre-superficie,var(--sf-tinta))] mb-2">{titulo}</h1>
      <p className="text-[var(--sf-sobre-superficie,var(--sf-texto))] text-sm">{conteo}{` · ${tiendaEncabezado.leyenda}`}</p>
    </motion.div>
  );
}

// LA COMPOSICIÓN «CARTA» (§ TIENDA-CHAMISAS-ALBUM-1). `catalog === null` (cargando): se muestra el
// H1/sticker/intro igual —son contenido editado, no dato vivo— y el selector espera al catálogo
// (igual que "Cargando" en el conteo de arriba). Headless, como el resto de este archivo: sin
// wrapper propio más allá del necesario para el layout interno de esta composición.
function TiendaCarta({
  tiendaEncabezado, catalog, coloresPorProducto,
}: {
  tiendaEncabezado: TiendaEncabezadoContent;
  catalog: Product[] | null;
  coloresPorProducto: Record<string, string>;
}) {
  const preview = useIsPreview();
  const mostrarSelector = catalog !== null && mostrarSelectorAntojo(catalog);
  const pildoras = mostrarSelector ? pildorasAntojo(catalog!, coloresPorProducto) : [];

  return (
    <motion.div initial={preview ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-start gap-3 flex-wrap">
        <h1 className="font-playfair text-4xl lowercase text-[var(--sf-tinta)]">{tiendaEncabezado.titulo}</h1>
        {tiendaEncabezado.sticker && (
          <span
            className="sf-pildora bg-[var(--sf-tostado)] text-[var(--sf-tinta)] text-xs font-semibold px-3 py-1 rotate-[-8deg] mt-1"
            aria-hidden="true"
          >
            {tiendaEncabezado.sticker}
          </span>
        )}
      </div>
      {tiendaEncabezado.intro && (
        <p className="mt-3 max-w-xl text-[var(--sf-texto)]">{tiendaEncabezado.intro}</p>
      )}

      {mostrarSelector && pildoras.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-medium text-[var(--sf-texto)] mb-3">{tiendaEncabezado.antojoTitulo}</p>
          <div className="flex flex-wrap gap-2">
            {pildoras.map((p) => (
              <a
                key={p.productId}
                href={`#cafe-${p.slug}`}
                className="sf-pildora px-4 py-2 text-sm font-medium text-[var(--sf-tinta)] transition-opacity hover:opacity-80"
                style={{ backgroundColor: lavadoLamina(p.color) }}
              >
                {p.nombre}
                {p.notas.length > 0 && <span className="opacity-70"> · {p.notas.join(' · ')}</span>}
              </a>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// LA COMPOSICIÓN «APERTURA» (§ TIENDA-ONIX-CARTELERA-1, la forma C que el owner eligió sobre la
// maqueta interactiva: ".scratch/tienda-composiciones/onix-forma-c-aprobada.png"). Foto a pantalla
// completa con el H1 gigante encima; sin ella, una superficie de color tinta con el mismo título
// (§ el spec, "Sin foto, la apertura es una superficie de color tinta"). El H1 se recorta por los
// bordes (`overflow-hidden` + `whitespace-nowrap`) y se desplaza en horizontal al hacer scroll por
// el MARCO de movimiento (T06 "Tipografía gigante que cruza", § lib/movimiento/catalogo.ts) — el
// MISMO mecanismo que ya usa Banner.tsx/ImagenTexto.tsx para el mismo efecto, no uno reinventado
// acá. Es UNA animación INCORPORADA de esta composición (como S02 en "proceso", CTA01 en "cierre"),
// no un eje `animacion` elegible — el spec no pide que se pueda apagar por separado, y
// `useMovimiento` ya respeta `prefers-reduced-motion`/el editor/la vista previa sin que este
// componente repita ninguno de los tres gates.
function TiendaApertura({
  tiendaEncabezado, negocio,
}: {
  tiendaEncabezado: TiendaEncabezadoContent;
  negocio?: string;
}) {
  // «vacío → el nombre del negocio» (§ el spec, item 1) — `titulo` es OPCIONAL (ver el docstring de
  // `TiendaEncabezadoContent`): sin fila o con la fila vacía, el resolver ya devuelve `''`, así que
  // el fallback es tan simple como un `||`. Sin negocio TAMPOCO (p. ej. la vista previa del panel,
  // que no pasa esta prop), el título por defecto de «Actual» es la última red.
  const titulo = tiendaEncabezado.titulo || negocio || TITULO_POR_DEFECTO;

  return (
    <section className="relative flex h-[85vh] min-h-[480px] w-full flex-col overflow-hidden bg-[var(--sf-tinta)]">
      {tiendaEncabezado.imagen && (
        <>
          <Image
            src={tiendaEncabezado.imagen}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[var(--sf-tinta)]/40 via-transparent to-[var(--sf-tinta)]/80" />
        </>
      )}

      {(tiendaEncabezado.rotuloIzquierda || tiendaEncabezado.rotuloDerecha) && (
        <div className="relative z-10 flex items-start justify-between px-6 pt-8 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sf-fondo)]/60 sm:px-10">
          <span>{tiendaEncabezado.rotuloIzquierda}</span>
          <span>{tiendaEncabezado.rotuloDerecha}</span>
        </div>
      )}

      <div className="relative z-10 mt-auto overflow-hidden pb-6 sm:pb-10">
        <Movimiento id="T06" as="div">
          <h1 className="sf-movimiento-gigante select-none whitespace-nowrap font-playfair text-[clamp(60px,14vw,220px)] uppercase leading-[0.82] text-[var(--sf-fondo)]">
            {titulo}
          </h1>
        </Movimiento>
      </div>
    </section>
  );
}
