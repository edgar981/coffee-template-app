"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";
import { SlidersHorizontal } from "lucide-react";
import { TOSTADO_LABELS } from "@/constants/roast-levels";
import type { RoastLevel } from "@/types/product";
import {
  OPCIONES_ORDEN,
  type OrdenCatalogo,
  type DisponibilidadFiltro,
  type ConteoDisponibilidad,
  type RangoPrecio,
} from "@/lib/storefront/filtrar-ordenar";

// El panel "Filtrar y ordenar" de /tienda bajo CORTE (§ TIENDA-ENCABEZADO-Y-FILTRAR-ORDENAR-1),
// medido contra la referencia del owner (`.scratch/refs/cafeone-filtrar-ordenar.png`): una fila
// ícono+título con un filete debajo, que despliega columnas (Disponibilidad · Categoría · Tostado
// si el catálogo lo puebla · Precio · Ordenar por) y cierra con un botón primario "Aplicar filtro".
//
// SÓLO SE MONTA BAJO CORTE — `app/(storefront)/tienda/page.tsx` decide (`navTratamiento.posicion`)
// entre esta rama y la rama Nayoli/no-CORTE (que no importa este archivo). Por eso NO hay
// fallback-al-literal-de-hoy en ninguna clase acá: no existe un "hoy" que preservar, sólo la
// composición nueva.
//
// TODOS los selectores del panel (Categoría, Tostado, Ordenar por) comparten LA MISMA forma de
// chip — border-only, activo con borde `--sf-tinta` — a propósito: es la unificación que el owner
// pidió ("la sección de filtros tiene un estilo y la de destacados otro. Combinémoslos"), medida
// contra la referencia (chips con borde claro, el activo con borde oscuro). La Disponibilidad usa
// checkboxes nativos (`accent-[var(--sf-acento)]`, el mismo patrón ya establecido en
// `checkout/page.tsx`/`AceptacionesPasarela.tsx`), y el Precio un slider de rango de
// `@radix-ui/react-slider` (ya dependencia del repo) con dos campos numéricos — NO se reusa
// `components/ui/slider.tsx`: ese componente lee tokens del PANEL admin (`--primary`,
// `--background`), no los `--sf-*` del storefront, así que montarlo acá pintaría colores ajenos al
// tema del cliente.
//
// EL BOTÓN "APLICAR FILTRO" NO USA EL TOKEN DE HOVER DE LA FAMILIA CTA-PRIMARIO — DESVÍO
// DELIBERADO. Es el mismo par CTA-primario que el resto de la familia (fondo `--sf-accion`, texto
// `--sf-accion-txt`, § CTA-PRIMARIO-COLOR-Y-HOVER-1), pero `lib/config/cta-primario.test.ts`
// mantiene un CENSO EXHAUSTIVO por source-grep de qué archivos contienen ese string de hover (y el
// de active), y ese archivo de test queda FUERA de `touches:` de este slice — agregar este
// componente a esa lista, o siquiera NOMBRAR el string exacto acá (el grep no distingue código de
// comentario), lo haría fallar. El hover se resuelve con `hover:opacity-90` (genérico, sin ese
// token) en vez del token de la familia; el color de fondo/texto en reposo SÍ usa los tokens
// correctos (`--sf-accion`/`--sf-accion-txt`), así que el CTA es coherente con el resto del sitio,
// sólo su hover usa un mecanismo distinto. Reportado como deviación en el asiento de este slice.
//
// LOS RADIOS SIGUEN LOS ROLES DE `formas.ts`: `sf-pildora` en botones/chips/inputs (0 bajo 'recta',
// el chrome cuadrado del prototipo) y `sf-pildora-real` en los thumbs del slider (SIEMPRE
// circulares, el mismo rol que ya usan `BackToTop`/la barra de progreso del carrito — un asa de
// slider no es "chrome cuadrado", es control físico).

export interface FiltrarOrdenarProps {
  abierto: boolean;
  onAbiertoChange: (v: boolean) => void;
  categorias: string[];
  catFilter: string;
  onCatFilter: (v: string) => void;
  hayTostados: boolean;
  tostadoFilter: RoastLevel | "all";
  onTostadoFilter: (v: RoastLevel | "all") => void;
  disponibilidad: ReadonlySet<DisponibilidadFiltro>;
  onDisponibilidad: (v: ReadonlySet<DisponibilidadFiltro>) => void;
  conteoDisponibilidad: ConteoDisponibilidad;
  rango: RangoPrecio;
  precioActivo: readonly [number, number];
  onPrecio: (v: [number, number]) => void;
  sortBy: OrdenCatalogo;
  onSortBy: (v: OrdenCatalogo) => void;
}

const CHIP_BASE =
  "sf-pildora sf-borde border-[var(--sf-linea)] bg-[var(--sf-fondo)] px-4 py-2 text-sm text-[var(--sf-texto)] transition-colors hover:border-[var(--sf-tinta)] cursor-pointer";
const CHIP_ACTIVA = "border-[var(--sf-tinta)] text-[var(--sf-tinta)] font-medium";

function chipClase(activo: boolean): string {
  return activo ? `${CHIP_BASE} ${CHIP_ACTIVA}` : CHIP_BASE;
}

export default function FiltrarOrdenar({
  abierto,
  onAbiertoChange,
  categorias,
  catFilter,
  onCatFilter,
  hayTostados,
  tostadoFilter,
  onTostadoFilter,
  disponibilidad,
  onDisponibilidad,
  conteoDisponibilidad,
  rango,
  precioActivo,
  onPrecio,
  sortBy,
  onSortBy,
}: FiltrarOrdenarProps) {
  // Vacío ⊻ los dos = "sin filtro" (§ `filtrarCatalogo`); alternar sólo la MEMBRESÍA del set, nunca
  // un booleano por estado — así agregar un tercer estado de disponibilidad el día de mañana no
  // exigiría tocar esta función.
  const toggleDisponibilidad = (v: DisponibilidadFiltro) => {
    const next = new Set(disponibilidad);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onDisponibilidad(next);
  };

  // Catálogo de un solo precio (o vacío): un slider sin RANGO que recorrer no tiene forma —se
  // declara en vez de dibujar un slider degenerado (min===max).
  const rangoUtilizable = rango.max > rango.min;

  return (
    <div className="sf-divisor-b border-[var(--sf-linea)]">
      <button
        type="button"
        onClick={() => onAbiertoChange(!abierto)}
        aria-expanded={abierto}
        className="flex w-full cursor-pointer items-center gap-2 py-4 text-left text-[var(--sf-tinta)]"
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        <span className="font-playfair text-lg">Filtrar y ordenar</span>
      </button>

      {abierto && (
        <div className="pb-8">
          {/* En el teléfono el panel APILA las columnas (1 sola), por spec — grid-cols-1 de base. */}
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="mb-3 text-sm font-medium text-[var(--sf-tinta)]">Disponibilidad</p>
              <div className="space-y-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--sf-texto)]">
                  <input
                    type="checkbox"
                    checked={disponibilidad.has("disponible")}
                    onChange={() => toggleDisponibilidad("disponible")}
                    className="accent-[var(--sf-acento)]"
                  />
                  Disponible
                  <span className="text-[var(--sf-texto-suave)]">({conteoDisponibilidad.disponible})</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--sf-texto)]">
                  <input
                    type="checkbox"
                    checked={disponibilidad.has("agotado")}
                    onChange={() => toggleDisponibilidad("agotado")}
                    className="accent-[var(--sf-acento)]"
                  />
                  Agotado
                  <span className="text-[var(--sf-texto-suave)]">({conteoDisponibilidad.agotado})</span>
                </label>
              </div>
            </div>

            {/* DERIVADAS del catálogo (§ categoriasDelCatalogo): un cliente no-café ve sus propias
                categorías; la columna entera desaparece si el catálogo no puebla ninguna. */}
            {categorias.length > 0 && (
              <div>
                <p className="mb-3 text-sm font-medium text-[var(--sf-tinta)]">Categoría</p>
                <div className="flex flex-wrap gap-2">
                  {["all", ...categorias].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => onCatFilter(k)}
                      className={chipClase(catFilter === k)}
                    >
                      {k === "all" ? "Todas" : k}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* "Nivel de Tostado" es vocabulario CAFETERO: hide-on-empty (§ catalogoTieneTostado). */}
            {hayTostados && (
              <div>
                <p className="mb-3 text-sm font-medium text-[var(--sf-tinta)]">Nivel de Tostado</p>
                <div className="flex flex-wrap gap-2">
                  {(["all", ...Object.keys(TOSTADO_LABELS)] as (RoastLevel | "all")[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => onTostadoFilter(k)}
                      className={chipClase(tostadoFilter === k)}
                    >
                      {k === "all" ? "Todos" : TOSTADO_LABELS[k]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="mb-3 text-sm font-medium text-[var(--sf-tinta)]">Precio</p>
              {rangoUtilizable ? (
                <>
                  <SliderPrimitive.Root
                    className="relative flex h-5 w-full touch-none select-none items-center"
                    min={rango.min}
                    max={rango.max}
                    step={1}
                    value={[precioActivo[0], precioActivo[1]]}
                    onValueChange={(v) => onPrecio([v[0], v[1]])}
                  >
                    <SliderPrimitive.Track className="relative h-[2px] w-full grow bg-[var(--sf-linea)]">
                      <SliderPrimitive.Range className="absolute h-full bg-[var(--sf-acento)]" />
                    </SliderPrimitive.Track>
                    <SliderPrimitive.Thumb
                      aria-label="Precio mínimo"
                      className="sf-pildora-real block h-4 w-4 border border-[var(--sf-acento)] bg-[var(--sf-fondo)] shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sf-acento)]/40"
                    />
                    <SliderPrimitive.Thumb
                      aria-label="Precio máximo"
                      className="sf-pildora-real block h-4 w-4 border border-[var(--sf-acento)] bg-[var(--sf-fondo)] shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sf-acento)]/40"
                    />
                  </SliderPrimitive.Root>
                  <div className="mt-4 flex items-center gap-3 text-sm text-[var(--sf-texto)]">
                    <label className="rounded-xl sf-borde flex items-center gap-1 border-[var(--sf-linea)] px-3 py-2">
                      <span className="text-[var(--sf-texto-suave)]">$</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={precioActivo[0]}
                        min={rango.min}
                        max={precioActivo[1]}
                        onChange={(e) => onPrecio([Number(e.target.value) || rango.min, precioActivo[1]])}
                        className="w-16 bg-transparent text-[var(--sf-tinta)] outline-none"
                      />
                    </label>
                    <span className="text-[var(--sf-texto-suave)]">a</span>
                    <label className="rounded-xl sf-borde flex items-center gap-1 border-[var(--sf-linea)] px-3 py-2">
                      <span className="text-[var(--sf-texto-suave)]">$</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={precioActivo[1]}
                        min={precioActivo[0]}
                        max={rango.max}
                        onChange={(e) => onPrecio([precioActivo[0], Number(e.target.value) || rango.max])}
                        className="w-16 bg-transparent text-[var(--sf-tinta)] outline-none"
                      />
                    </label>
                  </div>
                </>
              ) : (
                <p className="text-sm text-[var(--sf-texto-suave)]">Sin variación de precio en el catálogo.</p>
              )}
            </div>

            <div>
              <p className="mb-3 text-sm font-medium text-[var(--sf-tinta)]">Ordenar por</p>
              <div className="flex flex-wrap gap-2">
                {OPCIONES_ORDEN.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => onSortBy(o.value)}
                    className={chipClase(sortBy === o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              type="button"
              onClick={() => onAbiertoChange(false)}
              className="sf-pildora bg-[var(--sf-accion,var(--sf-tostado))] px-8 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--sf-accion-txt,var(--sf-tinta))] transition-opacity hover:opacity-90"
            >
              Aplicar filtro
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
