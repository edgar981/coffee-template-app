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
import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { formatCOP } from '@duna/core/utils';
import { normalizarOpciones } from '@duna/core/moliendas-opciones';
import { whatsappUrl } from '@/lib/config/site';
import { useIsPreview } from '@/components/storefront/PreviewMode';
import CampoEditable from '@/components/storefront/CampoEditable';
import { derivarMatrizTaquilla, celdaDe, nombreBaseProducto } from '@/lib/tienda/taquilla';
import { CreditosFilas } from '@/components/storefront/tienda/TiendaCreditos';
import {
  visibilidadBarraFija,
  altoPublicadoBarraFija,
  DURACION_BARRA_FIJA_S,
  VAR_ALTO_BARRA_FIJA,
} from '@/lib/storefront/barra-fija';
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
  const preview = useIsPreview();
  const matriz = useMemo(() => derivarMatrizTaquilla(catalog), [catalog]);
  const [seleccion, setSeleccion] = useState<{ categoria: string; peso: number } | null>(null);
  const [bolsas, setBolsas] = useState(1);
  const [frecuenciaElegida, setFrecuenciaElegida] = useState<string | null>(null);
  const [moliendaElegida, setMoliendaElegida] = useState<string | null>(null);

  const botonRef = useRef<HTMLDivElement | null>(null);
  // § ONIX-BARRA-FLOTANTE-MOVIL-1 — MISMO fix que `TiendaTaquilla.tsx`: `visibilidadBarraFija`
  // (lib/storefront/barra-fija.ts) reemplaza al `IntersectionObserver`+`!entry.isIntersecting`, que
  // no distinguía "todavía no llegué" de "ya pasé" el botón.
  const [barraFijaVisible, setBarraFijaVisible] = useState(false);
  const finRef = useRef<HTMLDivElement | null>(null);
  const [finVisible, setFinVisible] = useState(false);
  // `montado` — MISMO resguardo que `TiendaTaquilla.tsx` (ver su comentario): sin él,
  // `createPortal(..., document.body)` se alcanzaría en CADA render —incluido el del servidor,
  // donde `document` no existe— porque la barra ya no depende de `botonFueraDeVista` para montarse.
  const [montado, setMontado] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- guarda de montaje estándar, § TopBar.tsx
    setMontado(true);
  }, []);

  useEffect(() => {
    const el = botonRef.current;
    if (!el || typeof window === 'undefined') return;
    const evaluar = () => {
      const rect = el.getBoundingClientRect();
      setBarraFijaVisible((antes) => visibilidadBarraFija(rect, window.innerHeight, antes));
    };
    evaluar();
    window.addEventListener('scroll', evaluar, { passive: true });
    window.addEventListener('resize', evaluar);
    return () => {
      window.removeEventListener('scroll', evaluar);
      window.removeEventListener('resize', evaluar);
    };
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

  // DEFAULT = ÚLTIMA fila × PRIMERA columna × ÚLTIMA frecuencia (§ ONIX-PAGINAS-FIDELIDAD-1, el
  // spec item 4: "la selección inicial es la de la maqueta (molido · 250 · la última frecuencia
  // configurada)"). "ÚLTIMA fila" y no una palabra hardcodeada: la taxonomía la deriva el catálogo
  // y `matriz.filas` ya sale ordenada alfabético es-CO (§ lib/tienda/taquilla.ts), así que para el
  // catálogo real de Onix la última es "Café Molido" — sin suponer su nombre. Un tenant con otra
  // taxonomía simplemente arranca en SU última fila, no en "molido" por nombre.
  const activa = seleccion ?? { categoria: matriz.filas[matriz.filas.length - 1], peso: matriz.columnas[0] };
  const producto = matriz.celdas.get(celdaDe(activa.categoria, activa.peso))!;

  const bolsasOpciones = bolsasDeTaquilla(Number.parseInt(c.maxBolsas, 10) || 3);
  const bolsasActivas = bolsasOpciones.includes(bolsas) ? bolsas : bolsasOpciones[0];

  const frecuencias = frecuenciasDeTaquilla([c.frecuencia1, c.frecuencia2, c.frecuencia3, c.frecuencia4]);
  const frecuenciaActiva =
    frecuenciaElegida && frecuencias.includes(frecuenciaElegida) ? frecuenciaElegida : frecuencias[frecuencias.length - 1];

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
  // LA PRESENTACIÓN ELEGIDA ENTRA AL RESUMEN Y AL MENSAJE (§ ONIX-PAGINAS-FIDELIDAD-1, el spec
  // item 4) — `activa.categoria`, la MISMA categoría que la fila resalta, nunca un segundo dato.
  const resumen = resumenTaquilla({
    bolsas: bolsasActivas, peso: activa.peso, presentacion: activa.categoria, segmentoMolienda: seg, frecuenciaEtiqueta: frecuenciaActiva,
  });
  const referencia = c.taquillaReferenciaTexto.trim() || referenciaPrecioTaquilla(bolsasActivas, producto.precio);
  const mensaje = mensajeTaquilla({
    nombreProducto, bolsas: bolsasActivas, peso: activa.peso, presentacion: activa.categoria, segmentoMolienda: seg, frecuenciaEtiqueta: frecuenciaActiva,
  });
  const creditos = creditosDeTaquilla(c);
  const agotado = !producto.disponible;
  // § ONIX-BARRA-FLOTANTE-MOVIL-1 — la barra se oculta mientras el botón principal se ve O al
  // llegar a las preguntas (`finVisible`, § el sentinel de abajo); las dos razones de ocultarse
  // se combinan ACÁ, una sola vez, en vez de en el JSX.
  const mostrarBarra = barraFijaVisible && !finVisible;

  return (
    <div>
      {/* 5FR/7FR, GAP 72PX (§ ONIX-PAGINAS-FIDELIDAD-1, el spec, punto 6) — la maqueta da la columna
          de compra más espacio que la foto (`5fr/7fr`, `gap:72px`), no la mitad pareja de antes
          (`md:grid-cols-2`, `gap-10`=40px). */}
      <div className="grid grid-cols-1 gap-10 md:grid-cols-[5fr_7fr] md:items-start md:gap-[72px]">
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
          {/* KICKER = ROTULO genérico (§ ONIX-PAGINAS-FIDELIDAD-1, R2): 11.5px/700/ls .16em, gris
              cálido (tinta al 65%) — no `--sf-texto-suave` (oliva para Onix). h2: `mt-[10px]`, no
              `mt-1`(4px) — la maqueta separa el título del rótulo 10px. */}
          <p className="text-[11.5px] font-bold uppercase tracking-[0.16em] text-[var(--sf-tinta)]/65">
            <CampoEditable campo="suscripcionPlanes.taquillaKicker">{c.taquillaKicker}</CampoEditable>
          </p>
          <h2 className="mt-[10px] font-playfair text-3xl text-[var(--sf-tinta)] sm:text-4xl">{nombreProducto}</h2>

          {/* LA TABLA ES AHORA UN ÚNICO GRID (§ ONIX-TAQUILLA-SOLO-TABLA-1, el spec item 3) —
              reemplaza los N grids INDEPENDIENTES de antes (uno por `FilaTaquilla`, cada uno
              recalculando su propia `minmax(110px,1fr) minmax(0,Nfr)`). Las filas comparten AHORA
              el mismo par de columnas vía `grid-cols-subgrid` (§ `FilaTaquilla`, abajo): el límite
              etiqueta|datos es LA MISMA línea de grid para todas, nunca una coincidencia entre
              cálculos independientes. `GRID_TAQUILLA[columnas]` da además el ESTRECHAMIENTO de la
              columna de etiqueta bajo 480px (§ item 3: la celda vacía del encabezado medía ~113px,
              un tercio del ancho a 390px, y angostarla le da a BOLSAS/CADA el aire que les faltaba
              para no envolver tanto texto a dos líneas). */}
          <div className={`grid mt-[22px] border-l border-t border-r ${FILETE_TAQUILLA} ${GRID_TAQUILLA[matriz.columnas.length] ?? GRID_TAQUILLA[2]}`}>
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
                tipo="precio"
                activa={activa.peso}
                elegidaCategoria={activa.categoria === categoria}
                onElegir={(peso) => setSeleccion({ categoria, peso: peso as number })}
              />
            ))}

            <FilaTaquilla
              etiqueta={<CampoEditable campo="suscripcionPlanes.taquillaEtiquetaBolsas">{c.taquillaEtiquetaBolsas}</CampoEditable>}
              celdas={bolsasOpciones.map((n) => ({ valor: n, label: String(n) }))}
              tipo="opcion"
              activa={bolsasActivas}
              onElegir={(n) => setBolsas(n as number)}
            />
            <FilaTaquilla
              etiqueta={<CampoEditable campo="suscripcionPlanes.taquillaEtiquetaFrecuencia">{c.taquillaEtiquetaFrecuencia}</CampoEditable>}
              celdas={frecuencias.map((f) => ({ valor: f, label: f }))}
              tipo="opcion"
              activa={frecuenciaActiva}
              onElegir={(f) => setFrecuenciaElegida(f as string)}
            />
            {decision.modo === 'eleccion' && (
              <FilaTaquilla
                etiqueta={<CampoEditable campo="suscripcionPlanes.taquillaEtiquetaMolienda">{c.taquillaEtiquetaMolienda}</CampoEditable>}
                celdas={opcionesMolienda.map((o) => ({ valor: o.nombre, label: o.nombre, agotada: !o.disponible }))}
                tipo="opcion"
                activa={nombreMoliendaActiva}
                onElegir={(n) => setMoliendaElegida(n as string)}
              />
            )}
          </div>

          {/* EL COMPRADOR VE, POR DEFECTO, SÓLO EL RÓTULO + TÍTULO + TABLA + BOTÓN (§ ONIX-TAQUILLA-
              SOLO-TABLA-1, el spec item 1 — el owner, mirando /suscripciones en el celular: "It's
              showing a lot of things that the customer doesn't have to know about. The customer
              would only need to concern about the table and the button"). El resumen grande, la
              referencia de precio, la línea «Se envía: "…"», el aviso y los créditos pasan a
              INTERRUPTORES (apagados de arranque, § `SuscripcionPlanesContent.taquillaMostrarX`) —
              para la tienda que SÍ los quiera. El mensaje de WhatsApp (`mensaje`) se arma IGUAL con
              la molienda, se muestre o no la línea «Se envía»: el toggle es de VISTA, nunca de lo
              que el botón manda. */}
          {c.taquillaMostrarResumen && (
            // EL RESUMEN, en serif mayúscula (§ el spec, item 2: «2 × 250 G · CAFÉ MOLIDO, MOLIENDA
            // MEDIA · CADA MES»). El texto YA llega en mayúscula de `resumenTaquilla` — la clase
            // sólo aporta la tipografía, no el case. `tracking`/`leading` (§ el spec, punto 6).
            <p className="mt-6 font-playfair text-2xl tracking-[0.02em] leading-[37px] tabular-nums text-[var(--sf-tinta)] sm:text-[24px]">{resumen}</p>
          )}
          {c.taquillaMostrarReferencia && (
            <p className={`${c.taquillaMostrarResumen ? 'mt-1' : 'mt-6'} text-[15px] text-[var(--sf-tinta)]/65`}>
              <CampoEditable campo="suscripcionPlanes.taquillaReferenciaTexto">{referencia}</CampoEditable>
            </p>
          )}

          <div ref={botonRef} className="mt-6">
            <BotonPedir
              agotado={agotado} whatsapp={whatsapp} mensaje={mensaje} nombreProducto={nombreProducto}
              ctaLabel={<CampoEditable campo="suscripcionPlanes.taquillaCtaLabel">{c.taquillaCtaLabel}</CampoEditable>}
              ctaAgotadoLabel={<CampoEditable campo="suscripcionPlanes.taquillaCtaAgotadoLabel">{c.taquillaCtaAgotadoLabel}</CampoEditable>}
            />
          </div>
          {/* «SE ENVÍA: "…"» (§ ONIX-PAGINAS-FIDELIDAD-1, el spec item 4) — el mensaje EXACTO que el
              botón promete, citado tal cual con `<q>` (el navegador le pone las comillas). Y EL
              AVISO, AHORA DOS PÁRRAFOS INDEPENDIENTES (antes uno solo con `<br/>`): cada uno tiene
              su propio interruptor (§ arriba), así que no pueden seguir compartiendo un `<p>`. */}
          {c.taquillaMostrarSeEnvia && (
            <p className="mt-2 text-[13px] leading-normal text-[var(--sf-tinta)]/65">
              Se envía: <q className="text-[var(--sf-tinta)]">{mensaje}</q>
            </p>
          )}
          {c.taquillaMostrarAviso && (
            <p className="mt-2 text-[13px] leading-normal text-[var(--sf-tinta)]/65">
              <CampoEditable campo="suscripcionPlanes.taquillaAviso" multilinea>{c.taquillaAviso}</CampoEditable>
            </p>
          )}

          {c.taquillaMostrarCreditos && creditos.length > 0 && (
            <div className="mt-8">
              <CreditosFilas filas={creditos} />
            </div>
          )}
        </div>
      </div>

      <div ref={finRef} />

      {
        // § ONIX-APERTURA-MOVIL-INTERLUDIO-PARALLAX-1 — MISMO fix y MISMA razón que
        // `TiendaTaquilla.tsx` (ver su comentario): portal a `document.body` fuera de preview, para
        // que no quede incrustada por el `transform` que `EntradaPagina.tsx` deja tras su animación
        // de entrada; en el preview del panel se queda anidada bajo `EscalaDesktop`.
        //
        // § ONIX-BARRA-FLOTANTE-MOVIL-1 — SIEMPRE montada (ya no condicionada a
        // `botonFueraDeVista && !finVisible`): la visibilidad se combina en `mostrarBarra` (arriba)
        // y se pasa como prop, para que `BarraFijaMovil` pueda deslizarse en vez de aparecer de
        // golpe por un remontaje.
        preview ? (
          <BarraFijaMovil
            resumen={resumen} agotado={agotado} whatsapp={whatsapp} mensaje={mensaje} visible={mostrarBarra}
            ctaLabel={<CampoEditable campo="suscripcionPlanes.taquillaBarraCtaLabel">{c.taquillaBarraCtaLabel}</CampoEditable>}
            agotadoLabel={<CampoEditable campo="suscripcionPlanes.taquillaBarraAgotadoLabel">{c.taquillaBarraAgotadoLabel}</CampoEditable>}
          />
        ) : (
          montado &&
          createPortal(
            <BarraFijaMovil
              resumen={resumen} agotado={agotado} whatsapp={whatsapp} mensaje={mensaje} visible={mostrarBarra}
              ctaLabel={<CampoEditable campo="suscripcionPlanes.taquillaBarraCtaLabel">{c.taquillaBarraCtaLabel}</CampoEditable>}
              agotadoLabel={<CampoEditable campo="suscripcionPlanes.taquillaBarraAgotadoLabel">{c.taquillaBarraAgotadoLabel}</CampoEditable>}
            />,
            document.body,
          )
        )
      }
    </div>
  );
}

// EL FILETE compartido por la tabla y cada una de sus filas (§ R1 del informe, abajo).
const FILETE_TAQUILLA = 'border-[var(--sf-tinta)]/15';

// EL GRID COMPARTIDO de la tabla (§ ONIX-TAQUILLA-SOLO-TABLA-1, el spec item 3) — UNA sola
// declaración de columnas para TODA la tabla, indexada por `matriz.columnas.length` (1 a
// `MAX_VALORES_POR_EJE`, § lib/tienda/taquilla.ts). Literal y no interpolado, para que el JIT de
// Tailwind vea las clases (mismo criterio que `gridColsPresentaciones`, § CLAUDE.md). Cada entrada
// trae DOS anchos: el de siempre (`minmax(110px,1fr)` para la etiqueta) y, bajo 480px, uno más
// angosto (`minmax(90px,0.8fr)`) — MEDIDO contra el build real de Onix (§ el asiento de
// DECISIONS.md): a 390px la celda vacía del encabezado medía ~113px (un tercio del ancho) y BOLSAS/
// CADA envolvían texto a dos líneas por falta de aire; angostar la etiqueta a ~97px le da a esas
// filas el espacio que necesitan SIN hacer que "CAFÉ EN GRANO"/"CAFÉ MOLIDO" ganen una tercera
// línea (medido: por debajo de ~0.65fr sí la ganan — 0.8fr deja margen).
const GRID_TAQUILLA: Record<number, string> = {
  1: 'grid-cols-[minmax(110px,1fr)_minmax(0,1fr)] max-[480px]:grid-cols-[minmax(90px,0.8fr)_minmax(0,1fr)]',
  2: 'grid-cols-[minmax(110px,1fr)_minmax(0,2fr)] max-[480px]:grid-cols-[minmax(90px,0.8fr)_minmax(0,2fr)]',
  3: 'grid-cols-[minmax(110px,1fr)_minmax(0,3fr)] max-[480px]:grid-cols-[minmax(90px,0.8fr)_minmax(0,3fr)]',
};

// UNA FILA de la Taquilla (§ el spec, item 2: "dos filas con la misma celda y la misma columna de
// etiqueta que la Taquilla"). `encabezado` pinta la fila de pesos arriba de la tabla (sin etiqueta,
// sin selección); las demás son filas elegibles. El criterio de celda ELEGIDA depende del tipo de
// fila: la fila de precio usa `elegidaCategoria` (la categoría de ESTA fila debe coincidir además
// del peso); las demás comparan directo contra `activa`.
//
// § ONIX-PAGINAS-FIDELIDAD-1 — TRES arreglos de fidelidad, medidos contra la maqueta aprobada
// (`.taquilla`/`.fila`/`.opciones` de `onix-suscripciones-nosotros.html`):
// - **R1 (filete):** tinta al 15% (`--sf-tinta`/15), no `--sf-linea`/20 — ese token deriva casi
//   invisible para Onix (§ el informe, R1).
// - **Alineación — AHORA POR `subgrid`, NO por una razón `1:columnas` recalculada por fila
//   (§ ONIX-TAQUILLA-SOLO-TABLA-1, el spec item 3).** Cada fila era su PROPIO grid de 2 columnas,
//   con la MISMA razón `minmax(110px,1fr) minmax(0,Nfr)` repetida N veces (una por fila) — en
//   teoría idéntica en las N, pero N cálculos independientes, no UNO compartido. La fila ahora es
//   `grid-cols-subgrid` dentro del grid de la tabla (§ `GRID_TAQUILLA`, arriba): hereda LAS MISMAS
//   dos líneas de columna que sus vecinas por construcción del spec de CSS Grid, no por coincidencia
//   aritmética entre grids separados. La columna de DATOS sigue subdividiéndose ADENTRO por un grid
//   anidado propio (celdas.length columnas, nunca subgrid — sus divisores internos son del tamaño de
//   ESA fila, a propósito: BOLSAS con 3 opciones y la fila de precio con 2 no tienen por qué compartir
//   divisores internos, sólo el límite etiqueta|datos).
// - **Tipografía por `tipo`:** las celdas de PRECIO van en serif (`font-playfair`, 20px/400, como
//   la maqueta — `.celda{font-family:f-display;font-size:20px}`); las de OPCIÓN (bolsas,
//   frecuencia, molienda) van en sans mayúscula compacta (13px/700/ls .12em, como
//   `.fila .opciones .celda{font-family:f-ui;font-size:13px;font-weight:700;letter-spacing:.12em;
//   text-transform:uppercase}`) — antes las dos compartían `text-sm font-medium`, sin serif ni
//   mayúscula.
function FilaTaquilla({
  etiqueta, celdas, activa, elegidaCategoria, onElegir, encabezado = false, tipo = 'opcion',
}: {
  etiqueta: ReactNode;
  celdas: { valor: string | number; label: string; agotada?: boolean }[];
  activa?: string | number | null;
  elegidaCategoria?: boolean;
  onElegir?: (valor: string | number) => void;
  encabezado?: boolean;
  tipo?: 'precio' | 'opcion';
}) {
  const filete = FILETE_TAQUILLA;
  const celdaTipografia =
    tipo === 'precio'
      ? 'font-playfair text-xl'
      : 'font-sans text-[13px] font-bold uppercase tracking-[0.12em]';
  // SIN `border-t`/`mt-[22px]` propios — eso es ahora del CONTENEDOR compartido (§ el `<div>` que
  // monta `GRID_TAQUILLA`, en `SuscripcionTaquilla`), una vez para toda la tabla. Antes vivía acá,
  // condicional a `encabezado`, porque cada fila era su PROPIO grid sin padre que lo diera.
  return (
    <div className="col-span-2 grid grid-cols-subgrid">
      <div className={`flex min-h-[54px] items-center border-t ${filete} px-3 py-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-[var(--sf-tinta)]`}>
        {etiqueta}
      </div>
      <div className={`grid border-t ${filete}`} style={{ gridTemplateColumns: `repeat(${celdas.length}, minmax(0,1fr))` }}>
        {celdas.map((celda, i) => {
          const elegida = !encabezado && activa === celda.valor && elegidaCategoria !== false;
          const bordeIzq = i === 0 ? '' : `border-l ${filete}`;
          if (encabezado) {
            return (
              <div
                key={celda.valor}
                className={`flex min-h-[54px] items-center justify-center ${bordeIzq} px-3 py-2 text-center text-[11.5px] font-bold uppercase tracking-[0.14em] text-[var(--sf-tinta)]`}
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
              className={`relative flex min-h-[54px] cursor-pointer flex-col items-center justify-center ${bordeIzq} px-2 py-2 text-center tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sf-acento)] ${celdaTipografia} ${
                celda.agotada
                  ? 'cursor-not-allowed text-[var(--sf-tinta)]/65 line-through opacity-50'
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
    </div>
  );
}

function BotonPedir({
  agotado, whatsapp, mensaje, nombreProducto, ctaLabel, ctaAgotadoLabel,
}: {
  agotado: boolean;
  whatsapp?: string;
  mensaje: string;
  nombreProducto: string;
  ctaLabel: ReactNode;
  ctaAgotadoLabel: ReactNode;
}) {
  if (!whatsapp) return null; // § el spec, item 2: "Si no hay número de WhatsApp, el botón no aparece"
  // 52PX / 700 / .10em / RADIO 2px (§ ONIX-PAGINAS-FIDELIDAD-1, el spec, punto 6) — `rounded-[2px]`
  // en vez de `sf-pildora` (píldora): la maqueta de Onix es de esquina RECTA en todo su chrome de
  // botón, igual que el botón del Cierre (§ `CierreFraseYBoton.tsx`).
  const base =
    'flex min-h-[52px] w-full cursor-pointer items-center justify-center rounded-[2px] px-6 text-center text-sm font-bold uppercase tracking-[0.1em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';
  if (agotado) {
    return (
      <a
        href={whatsappUrl(whatsapp, `Hola, ¿cuándo vuelve a haber ${nombreProducto}?`)}
        target="_blank"
        rel="noreferrer"
        className={`${base} border border-[var(--sf-tinta)] text-[var(--sf-tinta)] transition-colors hover:bg-[var(--sf-tinta)] hover:text-[var(--sf-fondo)] focus-visible:ring-[var(--sf-tinta)]`}
      >
        {ctaAgotadoLabel}
      </a>
    );
  }
  return (
    <a
      href={whatsappUrl(whatsapp, mensaje)}
      target="_blank"
      rel="noreferrer"
      className={`${base} bg-[var(--sf-accion,var(--sf-tostado))] text-[var(--sf-accion-txt,var(--sf-tinta))] transition-opacity hover:opacity-90 focus-visible:ring-[var(--sf-accion,var(--sf-tostado))]`}
    >
      {ctaLabel}
    </a>
  );
}

// LA BARRA FIJA DEL CELULAR (§ el spec, item 5) — resumen + "Pedir". Se oculta mientras el botón
// principal está a la vista y al llegar a las preguntas (§ el padre, `mostrarBarra`). `md:hidden`
// como `BarraFijaMovil` de `TiendaTaquilla.tsx`. FLOTANTE y SIEMPRE MONTADA, con la misma mecánica
// de publicación del alto — ver el docstring de cabecera de esa función en `TiendaTaquilla.tsx`;
// no se repite acá para no mantener DOS copias del mismo porqué.
function BarraFijaMovil({
  resumen, agotado, whatsapp, mensaje, visible, ctaLabel, agotadoLabel,
}: {
  resumen: string;
  agotado: boolean;
  whatsapp?: string;
  mensaje: string;
  visible: boolean;
  ctaLabel: ReactNode;
  agotadoLabel: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof document === 'undefined') return;
    const publicar = () => {
      const alto = visible ? el.offsetHeight + (Number.parseFloat(getComputedStyle(el).bottom) || 0) : 0;
      document.documentElement.style.setProperty(VAR_ALTO_BARRA_FIJA, altoPublicadoBarraFija(visible, alto));
    };
    publicar();
    window.addEventListener('resize', publicar);
    return () => {
      window.removeEventListener('resize', publicar);
      document.documentElement.style.setProperty(VAR_ALTO_BARRA_FIJA, '0px');
    };
  }, [visible]);

  if (!whatsapp) return null; // § el spec, item 2: "Si no hay número de WhatsApp, el botón no aparece"

  const tabProps = visible ? {} : { tabIndex: -1 };

  return (
    <motion.div
      ref={ref}
      aria-hidden={!visible}
      initial={false}
      animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 16 }}
      transition={{ duration: DURACION_BARRA_FIJA_S }}
      className={`fixed inset-x-3 z-30 flex items-center justify-between gap-3 sf-borde border-[var(--sf-linea)]/20 bg-[var(--sf-tinta)] px-4 py-3 shadow-xl md:hidden ${
        visible ? '' : 'pointer-events-none'
      }`}
      style={{
        bottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
        borderRadius: 'var(--radius-2xl, var(--sf-pildora, 9999px))',
      }}
    >
      <span className="truncate text-xs font-semibold uppercase tracking-[0.08em] text-[var(--sf-fondo)]">{resumen}</span>
      {agotado ? (
        <span className="shrink-0 text-xs font-semibold uppercase text-[var(--sf-fondo)]/70">{agotadoLabel}</span>
      ) : (
        <a
          href={whatsappUrl(whatsapp, mensaje)}
          target="_blank"
          rel="noreferrer"
          {...tabProps}
          className="sf-pildora shrink-0 cursor-pointer bg-[var(--sf-accion,var(--sf-tostado))] px-4 py-2 text-xs font-semibold uppercase text-[var(--sf-accion-txt,var(--sf-tinta))] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sf-accion,var(--sf-tostado))]"
        >
          {ctaLabel}
        </a>
      )}
    </motion.div>
  );
}
