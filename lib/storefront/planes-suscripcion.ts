import type { SuscripcionPlanesContent, SuscripcionPasosContent } from '../config/site-content-defaults';

// Los PLANES de suscripción como DATO (§ Backlog #49, opción 1). QUÉ planes se muestran, con qué grid,
// y cuál va destacado se decide ACÁ —capa 1 pura— y NO en el resolver de SiteContent: así la
// cardinalidad 1-4 no toca el resolver ni #44 (como Presentaciones). Este módulo es la FUENTE ÚNICA que
// leen las DOS superficies —la página /suscripciones Y el teaser de la home—, así que no pueden
// divergir (era el temor de #49; el dato compartido lo resuelve).

export interface PlanSuscripcion {
  /** El SLOT (1-4) del que salió el plan. PRESERVADO a través del filtro (un plan opcional lleno fuera
   *  de orden mueve su posición visible, no su slot). Lo usa el destaque y el recorte del teaser. */
  slot: number;
  nombre: string;
  descripcion: string;
  /** Precio como TEXTO (vacío = no se muestra). La moneda/el formato son del cliente; un número
   *  inventado sería dato falso en la ruta del dinero (§ site-content-defaults). */
  precio: string;
  /** Los beneficios PRESENTES (los `benN_*` no vacíos, en orden). El storefront filtra vacíos; la
   *  COMPACTACIÓN del dato es del editor (§ lista-plana). */
  beneficios: string[];
  /** ¿Es el plan destacado? (`slot === destacadoSlot`). Un solo plan puede serlo — el índice lo
   *  garantiza. Unifica el `plan.popular` de /suscripciones y el `i===1` del teaser. */
  destacado: boolean;
}

/**
 * Los planes PRESENTES de una config de suscripción.
 *
 * Plan 1 SIEMPRE (nombre/descripcion requeridos → mínimo 1, con los defaults de Nayoli). Planes 2-4
 * sólo si tienen NOMBRE (el nombre es el ancla del plan; sin él no es un plan). Es el mismo criterio de
 * cardinalidad-variable-sobre-campos-planos que Presentaciones: el componente filtra, el resolver no.
 */
export function planesDeSuscripcion(p: SuscripcionPlanesContent): PlanSuscripcion[] {
  const destacadoSlot = Number.parseInt(p.destacadoSlot, 10); // NaN si '' (ninguno) → nunca matchea
  const slots = [
    { slot: 1, nombre: p.nombre1, descripcion: p.descripcion1, precio: p.precio1, bens: [p.ben1_1, p.ben1_2, p.ben1_3, p.ben1_4], req: true },
    { slot: 2, nombre: p.nombre2, descripcion: p.descripcion2, precio: p.precio2, bens: [p.ben2_1, p.ben2_2, p.ben2_3, p.ben2_4], req: false },
    { slot: 3, nombre: p.nombre3, descripcion: p.descripcion3, precio: p.precio3, bens: [p.ben3_1, p.ben3_2, p.ben3_3, p.ben3_4], req: false },
    { slot: 4, nombre: p.nombre4, descripcion: p.descripcion4, precio: p.precio4, bens: [p.ben4_1, p.ben4_2, p.ben4_3, p.ben4_4], req: false },
  ];
  return slots
    .filter(s => s.req || s.nombre.trim() !== '')
    .map(s => ({
      slot: s.slot,
      nombre: s.nombre,
      descripcion: s.descripcion,
      precio: s.precio,
      beneficios: s.bens.filter(b => b.trim() !== ''),
      destacado: s.slot === destacadoSlot,
    }));
}

// Las OPCIONES del select de "plan destacado" del editor (§ Backlog #49, FIX 2). Se DERIVAN de los
// planes que EXISTEN —los que la tienda muestra—, no del tope: "Ninguno" + un plan por cada uno con
// nombre. Al agregar un plan aparece; al vaciarlo, desaparece de la lista. Y si el destacado apunta a un
// plan que se VACIÓ (el índice queda colgando), NO se pierde en silencio: se muestra como una opción
// marcada "vacío" para que el operador la vea y la corrija —la tienda no destaca ninguna tarjeta porque
// ningún plan visible tiene ese slot, así que no destaca una que no está—.
export function opcionesDestaque(sec: SuscripcionPlanesContent): { value: string; label: string }[] {
  const existentes = planesDeSuscripcion(sec);
  const opts: { value: string; label: string }[] = [{ value: '', label: 'Ninguno' }];
  for (const p of existentes) opts.push({ value: String(p.slot), label: p.nombre.trim() || `Plan ${p.slot}` });
  const actual = (sec.destacadoSlot ?? '').trim();
  if (actual !== '' && !existentes.some(p => String(p.slot) === actual)) {
    opts.push({ value: actual, label: `Plan ${actual} · vacío (no se muestra)` });
  }
  return opts;
}

export interface PasoSuscripcion {
  label: string;
  descripcion: string;
}

/** Los 4 pasos "¿Cómo funciona?" (cardinalidad FIJA). El componente pone el número "0N" y el ícono por
 *  índice (estructura, no dato). */
export function pasosDeSuscripcion(p: SuscripcionPasosContent): PasoSuscripcion[] {
  return [
    { label: p.paso1Label, descripcion: p.paso1Desc },
    { label: p.paso2Label, descripcion: p.paso2Desc },
    { label: p.paso3Label, descripcion: p.paso3Desc },
    { label: p.paso4Label, descripcion: p.paso4Desc },
  ];
}

// EL TEASER de la home LIMITA los planes (owner, § d): es un ANZUELO que enlaza a /suscripciones, no
// el grid completo. `TEASER_MAX_PLANES` se midió en la pantalla REAL (la columna derecha del
// `lg:grid-cols-2` de la home, no el ancho de /suscripciones): a más de 3 tarjetas en esa media
// columna cada una queda ilegible (nombre + descripción). Nayoli tiene 3 → el teaser las muestra
// todas → byte-idéntico; sólo un cliente con 4 planes ve el recorte, y el CTA "Ver los planes" ya
// dice que hay más (sin copy nuevo).
export const TEASER_MAX_PLANES = 3;

/**
 * El recorte de planes del teaser. Con `planes.length <= cap` devuelve TODOS en orden natural
 * (byte-idéntico). Si sobran planes Y el destacado quedaría FUERA del recorte, el destacado REEMPLAZA
 * al último visible —así el anzuelo nunca esconde el plan que el cliente quiere empujar (owner)—,
 * conservando el orden natural en los primeros. Un anzuelo que oculta el destacado está roto.
 */
export function planesDelTeaser(planes: PlanSuscripcion[], cap: number = TEASER_MAX_PLANES): PlanSuscripcion[] {
  if (planes.length <= cap) return planes;
  const recorte = planes.slice(0, cap);
  const destacado = planes.find(p => p.destacado);
  if (destacado && !recorte.some(p => p.destacado)) {
    recorte[recorte.length - 1] = destacado;
  }
  return recorte;
}

/**
 * La clase de columnas del grid de /suscripciones (`max-w-5xl`) según el conteo de planes: 1 → 1 col,
 * 2 → 2, 3 → 3 (Nayoli, byte-idéntico), 4 → **2×2** (a 4-en-fila las tarjetas de plan —nombre +
 * descripción + lista de beneficios + destaque— quedan más apretadas que las de presentación).
 * Clases LITERALES para el JIT de Tailwind.
 */
export function gridColsPlanes(n: number): string {
  const mapa: Record<number, string> = {
    1: 'md:grid-cols-1',
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-2',
  };
  return mapa[n] ?? 'md:grid-cols-3';
}

/**
 * La clase de columnas del grid del TEASER (la media columna de la home, más angosta). Recortado a
 * `TEASER_MAX_PLANES` (3), así que n es 1-3: 3 → `sm:grid-cols-3` (byte-idéntico a hoy). Clases
 * LITERALES para el JIT.
 */
export function gridColsTeaser(n: number): string {
  const mapa: Record<number, string> = {
    1: 'sm:grid-cols-1',
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-3',
  };
  return mapa[n] ?? 'sm:grid-cols-3';
}
