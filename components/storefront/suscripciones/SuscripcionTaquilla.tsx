"use client";

// LA TAQUILLA DE SUSCRIPCIÓN (§ ONIX-SUSCRIPCION-TAQUILLA-1). Montada por `SuscripcionPlanes.tsx`
// SÓLO con `suscripcionPlanes.variante === 'taquilla'` Y una matriz VÁLIDA (`derivarMatrizTaquilla`,
// § lib/tienda/taquilla.ts) — sin ella cae sola a «Tarjetas», mismo patrón que «Taquilla»/«Láminas»
// caen a «Actual» en `TiendaCatalogo.tsx`.
//
// EL PRODUCTO ES EL MISMO QUE /tienda: la tabla 2×2 categoría×peso se deriva del catálogo REAL con
// la MISMA función — nunca un segundo modelo de producto para suscripciones.
//
// NO PASA POR CARRITO NI CHECKOUT (§ el censo): el pedido se arma en un MENSAJE de WhatsApp. El
// riesgo de dinero de /tienda (`moliendaAceptada` en el checkout) no aplica acá — no hay escritura
// de orden — así que la molienda se resuelve sólo para el TEXTO (resumen, mensaje), vía
// `decidirMolienda`, la MISMA regla que /tienda.
//
// «AGOTADO → TACHADO, NO ELEGIBLE» (§ el spec, item 2) — a diferencia de la celda de precio de
// `TiendaTaquilla.tsx` (clickeable igual, sólo rotulada "Agotado"): acá el spec pide explícitamente
// que una opción agotada no se pueda elegir, así que las celdas y las opciones de molienda agotadas
// van `disabled` + tachadas. Es una diferencia DELIBERADA entre las dos composiciones, no una
// regresión del patrón de /tienda.
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatCOP } from '@duna/core/utils';
import { normalizarOpciones } from '@duna/core/moliendas-opciones';
import { whatsappUrl } from '@/lib/config/site';
import { derivarMatrizTaquilla, celdaDe, nombreBaseProducto } from '@/lib/tienda/taquilla';
import { CreditosFilas } from '@/components/storefront/tienda/TiendaCreditos';
import {
  bolsasDeTaquilla,
  frecuenciasDeTaquilla,
  segmentoMolienda,
  resumenTaquilla,
  referenciaPrecioTaquilla,
  mensajeTaquilla,
  creditosDeTaquilla,
  decidirMolienda,
} from '@/lib/storefront/suscripcion-taquilla';
import type { Product } from '@/types/product';
import type { SuscripcionPlanesContent } from '@/lib/config/site-content-defaults';

interface SuscripcionTaquillaProps {
  catalog: Product[];
  whatsapp?: string;
  suscripcionPlanes: SuscripcionPlanesContent;
}

export default function SuscripcionTaquilla({ catalog, whatsapp, suscripcionPlanes: c }: SuscripcionTaquillaProps) {
  const matriz = useMemo(() => derivarMatrizTaquilla(catalog), [catalog]);
  const [seleccion, setSeleccion] = useState<{ categoria: string; peso: number } | null>(null);
  const [bolsas, setBolsas] = useState(1);
  const [frecuenciaElegida, setFrecuenciaElegida] = useState<string | null>(null);
  const [moliendaElegida, setMoliendaElegida] = useState<string | null>(null);

  const botonRef = useRef<HTMLDivElement | null>(null);
  const [botonFueraDeVista, setBotonFueraDeVista] = useState(false);
  const finRef = useRef<HTMLDivElement | null>(null);
  const [finVisible, setFinVisible] = useState(false);

  useEffect(() => {
    const el = botonRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(([entry]) => setBotonFueraDeVista(!entry.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [matriz]);

  // LA BARRA FIJA SE OCULTA «AL LLEGAR A LAS PREGUNTAS» (§ el spec, item 5): este sentinel marca el
  // FIN de la composición (tras los créditos), justo antes de que `Contenido.tsx` monte el resto de
  // la página (pasos/FAQ). Entrar en vista = ya se llegó ahí = se oculta la barra.
  useEffect(() => {
    const el = finRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(([entry]) => setFinVisible(entry.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [matriz]);

  if (!matriz) return null;

  const activa = seleccion ?? { categoria: matriz.filas[0], peso: matriz.columnas[0] };
  const producto = matriz.celdas.get(celdaDe(activa.categoria, activa.peso))!;

  const bolsasOpciones = bolsasDeTaquilla(Number.parseInt(c.maxBolsas, 10) || 3);
  const bolsasActivas = bolsasOpciones.includes(bolsas) ? bolsas : bolsasOpciones[0];

  const frecuencias = frecuenciasDeTaquilla([c.frecuencia1, c.frecuencia2, c.frecuencia3, c.frecuencia4]);
  const frecuenciaActiva = frecuenciaElegida && frecuencias.includes(frecuenciaElegida) ? frecuenciaElegida : frecuencias[0];

  const decision = decidirMolienda(producto.moliendasOpciones);
  const opcionesMolienda = normalizarOpciones(producto.moliendasOpciones);
  const nombreMoliendaActiva =
    decision.modo === 'eleccion'
      ? (moliendaElegida && opcionesMolienda.some((o) => o.nombre === moliendaElegida && o.disponible))
        ? moliendaElegida
        : (opcionesMolienda.find((o) => o.disponible)?.nombre ?? null)
      : null;

  const seg = segmentoMolienda(decision, nombreMoliendaActiva);
  const nombreProducto = nombreBaseProducto(producto.nombre);
  const resumen = resumenTaquilla({ bolsas: bolsasActivas, peso: activa.peso, segmentoMolienda: seg, frecuenciaEtiqueta: frecuenciaActiva });
  const referencia = c.taquillaReferenciaTexto.trim() || referenciaPrecioTaquilla(bolsasActivas, producto.precio);
  const mensaje = mensajeTaquilla({ nombreProducto, bolsas: bolsasActivas, peso: activa.peso, segmentoMolienda: seg, frecuenciaEtiqueta: frecuenciaActiva });
  const creditos = creditosDeTaquilla(c);
  const agotado = !producto.disponible;

  return (
    <div>
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:items-start">
        {/* LA BOLSA, IGUAL QUE EN /tienda (§ el spec, item 2) — mismo tratamiento de foto que
            `TiendaTaquilla.tsx`: `object-cover` para que el fondo propio de la foto cubra el cuadro
            entero. En celular, 4:5 al 70% del ancho (§ refero-onix-paginas.md, "Celular"). */}
        <div className="relative mx-auto aspect-[4/5] w-[70%] max-w-md overflow-hidden bg-[var(--sf-superficie)] md:aspect-square md:w-full">
          {producto.imagen ? (
            <Image
              key={producto.id}
              src={producto.imagen}
              alt={producto.nombre}
              fill
              sizes="(max-width: 768px) calc(70vw - 32px), 448px"
              quality={90}
              className="object-cover transition-opacity duration-200"
            />
          ) : null}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sf-texto-suave)]">
            Suscripción · Sin cobro automático
          </p>
          <h2 className="mt-1 font-playfair text-3xl text-[var(--sf-tinta)] sm:text-4xl">{nombreProducto}</h2>

          <FilaTaquilla
            etiqueta={null}
            celdas={matriz.columnas.map((peso) => ({ valor: peso, label: `${peso} g` }))}
            encabezado
          />
          {matriz.filas.map((categoria) => (
            <FilaTaquilla
              key={categoria}
              etiqueta={categoria}
              celdas={matriz.columnas.map((peso) => {
                const p = matriz.celdas.get(celdaDe(categoria, peso))!;
                return { valor: peso, label: formatCOP(p.precio), agotada: !p.disponible };
              })}
              activa={activa.peso}
              elegidaCategoria={activa.categoria === categoria}
              onElegir={(peso) => setSeleccion({ categoria, peso: peso as number })}
            />
          ))}

          <FilaTaquilla
            etiqueta="Bolsas"
            celdas={bolsasOpciones.map((n) => ({ valor: n, label: String(n) }))}
            activa={bolsasActivas}
            onElegir={(n) => setBolsas(n as number)}
          />
          <FilaTaquilla
            etiqueta="Cada"
            celdas={frecuencias.map((f) => ({ valor: f, label: f }))}
            activa={frecuenciaActiva}
            onElegir={(f) => setFrecuenciaElegida(f as string)}
          />
          {decision.modo === 'eleccion' && (
            <FilaTaquilla
              etiqueta="Molienda"
              celdas={opcionesMolienda.map((o) => ({ valor: o.nombre, label: o.nombre, agotada: !o.disponible }))}
              activa={nombreMoliendaActiva}
              onElegir={(n) => setMoliendaElegida(n as string)}
            />
          )}

          {/* EL RESUMEN, en serif mayúscula (§ el spec, item 2: «2 × 250 G · MOLIDO MEDIO · CADA
              MES»). El texto YA llega en mayúscula de `resumenTaquilla` — la clase sólo aporta la
              tipografía, no el case. */}
          <p className="mt-6 font-playfair text-2xl tabular-nums text-[var(--sf-tinta)] sm:text-[24px]">{resumen}</p>
          <p className="mt-1 text-sm text-[var(--sf-texto-suave)]">{referencia}</p>

          <div ref={botonRef} className="mt-6">
            <BotonPedir agotado={agotado} whatsapp={whatsapp} mensaje={mensaje} nombreProducto={nombreProducto} />
          </div>
          <p className="mt-2 text-[13px] text-[var(--sf-texto-suave)]">
            No se cobra nada aquí. Pago y envío se acuerdan por chat.
          </p>

          {creditos.length > 0 && (
            <div className="mt-8">
              <CreditosFilas filas={creditos} />
            </div>
          )}
        </div>
      </div>

      <div ref={finRef} />

      {botonFueraDeVista && !finVisible && (
        <BarraFijaMovil resumen={resumen} agotado={agotado} whatsapp={whatsapp} mensaje={mensaje} />
      )}
    </div>
  );
}

// UNA FILA de la Taquilla (§ el spec, item 2: "dos filas con la misma celda y la misma columna de
// etiqueta que la Taquilla"). `encabezado` pinta la fila de pesos arriba de la tabla (sin etiqueta,
// sin selección); las demás son filas elegibles. El criterio de celda ELEGIDA depende del tipo de
// fila: la fila de precio usa `elegidaCategoria` (la categoría de ESTA fila debe coincidir además
// del peso); las demás comparan directo contra `activa`.
function FilaTaquilla({
  etiqueta, celdas, activa, elegidaCategoria, onElegir, encabezado = false,
}: {
  etiqueta: string | null;
  celdas: { valor: string | number; label: string; agotada?: boolean }[];
  activa?: string | number | null;
  elegidaCategoria?: boolean;
  onElegir?: (valor: string | number) => void;
  encabezado?: boolean;
}) {
  return (
    <div
      className={`grid overflow-hidden border-l border-r border-[var(--sf-linea)]/20 ${encabezado ? 'mt-8 border-t' : 'border-t-0'}`}
      style={{ gridTemplateColumns: `minmax(0,1fr) repeat(${celdas.length}, minmax(0,1fr))` }}
    >
      <div className="flex items-center border-t border-[var(--sf-linea)]/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--sf-texto-suave)]">
        {etiqueta}
      </div>
      {celdas.map((celda) => {
        const elegida = !encabezado && activa === celda.valor && elegidaCategoria !== false;
        if (encabezado) {
          return (
            <div
              key={celda.valor}
              className="border-l border-t border-[var(--sf-linea)]/20 px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.1em] text-[var(--sf-texto-suave)]"
            >
              {celda.label}
            </div>
          );
        }
        return (
          <button
            key={celda.valor}
            type="button"
            disabled={celda.agotada}
            onClick={() => onElegir?.(celda.valor)}
            aria-pressed={elegida}
            className={`relative flex min-h-[48px] cursor-pointer flex-col items-center justify-center border-l border-t border-[var(--sf-linea)]/20 px-2 py-2 text-center text-sm font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sf-acento)] ${
              celda.agotada
                ? 'cursor-not-allowed text-[var(--sf-texto-suave)] line-through opacity-50'
                : elegida
                  ? 'bg-[var(--sf-tinta)] text-[var(--sf-fondo)]'
                  : 'text-[var(--sf-tinta)] hover:bg-[var(--sf-superficie)]'
            }`}
          >
            {celda.label}
          </button>
        );
      })}
    </div>
  );
}

function BotonPedir({
  agotado, whatsapp, mensaje, nombreProducto,
}: {
  agotado: boolean;
  whatsapp?: string;
  mensaje: string;
  nombreProducto: string;
}) {
  if (!whatsapp) return null; // § el spec, item 2: "Si no hay número de WhatsApp, el botón no aparece"
  if (agotado) {
    return (
      <a
        href={whatsappUrl(whatsapp, `Hola, ¿cuándo vuelve a haber ${nombreProducto}?`)}
        target="_blank"
        rel="noreferrer"
        className="sf-pildora block w-full cursor-pointer border border-[var(--sf-tinta)] px-6 py-3 text-center text-sm font-semibold uppercase tracking-[0.08em] text-[var(--sf-tinta)] transition-colors hover:bg-[var(--sf-tinta)] hover:text-[var(--sf-fondo)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sf-tinta)]"
      >
        Avísame por WhatsApp
      </a>
    );
  }
  return (
    <a
      href={whatsappUrl(whatsapp, mensaje)}
      target="_blank"
      rel="noreferrer"
      className="sf-pildora block w-full cursor-pointer bg-[var(--sf-accion,var(--sf-tostado))] px-6 py-3 text-center text-sm font-semibold uppercase tracking-[0.08em] text-[var(--sf-accion-txt,var(--sf-tinta))] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sf-accion,var(--sf-tostado))]"
    >
      Pedir por WhatsApp
    </a>
  );
}

// LA BARRA FIJA DEL CELULAR (§ el spec, item 5) — resumen + "Pedir". Se oculta mientras el botón
// principal está a la vista y al llegar a las preguntas (§ el padre, `finVisible`). `md:hidden`
// como `BarraFijaMovil` de `TiendaTaquilla.tsx`.
function BarraFijaMovil({
  resumen, agotado, whatsapp, mensaje,
}: {
  resumen: string;
  agotado: boolean;
  whatsapp?: string;
  mensaje: string;
}) {
  if (!whatsapp) return null;
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-[var(--sf-linea)]/20 bg-[var(--sf-tinta)] px-4 py-3 md:hidden"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <span className="truncate text-xs font-semibold uppercase tracking-[0.08em] text-[var(--sf-fondo)]">{resumen}</span>
      {agotado ? (
        <span className="shrink-0 text-xs font-semibold uppercase text-[var(--sf-fondo)]/70">Agotado</span>
      ) : (
        <a
          href={whatsappUrl(whatsapp, mensaje)}
          target="_blank"
          rel="noreferrer"
          className="sf-pildora shrink-0 cursor-pointer bg-[var(--sf-accion,var(--sf-tostado))] px-4 py-2 text-xs font-semibold uppercase text-[var(--sf-accion-txt,var(--sf-tinta))] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sf-accion,var(--sf-tostado))]"
        >
          Pedir
        </a>
      )}
    </div>
  );
}
