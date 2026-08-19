'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Download, FilterX, Paperclip, X } from 'lucide-react';
import { DateRangePicker } from '@/components/admin/DateRangePicker';
import { PresetsPeriodo } from '@/components/admin/PresetsPeriodo';
import { useAccionGuardada } from '@/hooks/useAccionGuardada';
import { toast } from 'sonner';
import { PagosCurva, PagosCurvaEsqueleto } from '@/components/admin/PagosCurva';
import { getPayments } from '@/lib/api/payments';
import type { Payment, MetodoPago } from '@/types/payment';
import { METODO_PAGO_LABEL, METODO_CATEGORIA, PAYMENT_CATEGORIA_LABEL, type PaymentCategoria } from '@/types/payment';
import { formatCOP } from '@duna/core/utils';
import { formatFecha } from '@duna/core/format-fecha';
import { BUSINESS_TZ, zonedDayKey, startOfZonedDay } from '@duna/core/timezone';
import { rangoDeDiasDelPeriodo, opcionesPreset } from '@/lib/metrics/periodo';
import { bucketKey, bucketear } from '@/lib/pagos/bucketeo';
import { fraseDePagos, mejorDiaDe } from '@/lib/pagos/frase';
import { modeloInforme } from '@/lib/pagos/informe';
import { siteConfig } from '@/lib/config/site';
import { etiquetaBucket, type RecorteTiempo } from '@/lib/pagos/etiquetas';

// Columnas del libro (grid-list). Flexibles: caben en la región sin scroll horizontal
// en escritorio, y refluyen a 2 columnas en móvil (§ duna.css, `.duna-lista`).
const COLS = '84px 104px minmax(70px,1.1fr) 96px 108px minmax(70px,1.3fr) 104px 22px';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Pagos() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Cargando...</div>}>
      <PagosInner />
    </Suspense>
  );
}

function PagosInner() {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  // La pantalla SIEMPRE abre con un rango: MES EN CURSO por defecto, o el `?desde/?hasta`
  // del deep-link del dashboard. El reloj se fija al montar.
  const ahora    = useMemo(() => new Date(), []);
  const hoy      = zonedDayKey(ahora, BUSINESS_TZ);
  const rangoMes = useMemo(() => rangoDeDiasDelPeriodo('mes', ahora), [ahora]);
  const presetsPagos = useMemo(
    () => [{ label: 'Hoy', desde: hoy, hasta: hoy }, ...opcionesPreset(['mes', 'mes_anterior', 'ultimos_3_meses'], ahora)],
    [hoy, ahora],
  );
  const [pagos, setPagos]     = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [metodo, setMetodo]   = useState<string>('all');      // 'all' | MetodoPago | `cat:${cat}`
  const [from, setFrom]       = useState(() => searchParams.get('desde') ?? rangoMes.desde);
  const [to, setTo]           = useState(() => searchParams.get('hasta') ?? rangoMes.hasta);
  // El recorte de tiempo (el chip), client-side y de una fuente con el libro. El
  // toggle "Por método" y las exclusiones murieron con el strip: una CURVA no se
  // apila, y el desglose por método vive en el modo método y en el select.
  const [bucketSel, setBucketSel] = useState<RecorteTiempo | null>(null);

  // El rango se filtra en SQL → un cambio de rango RE-CONSULTA. `active` evita que una
  // respuesta lenta pise a una más nueva.
  useEffect(() => {
    let active = true;
    setLoading(true);
    getPayments(from, to)
      .then(data => { if (active) setPagos(data); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [from, to]);

  // ── Derived ────────────────────────────────────────────────────────────────

  // Los métodos que el filtro incluye — VARIOS si es un grupo ("Cualquier digital").
  // El informe los necesita para marcar las filas que su detalle desarrolla.
  const metodosDelFiltro = useMemo<MetodoPago[] | null>(() => {
    if (metodo === 'all') return null;
    const todos = Object.keys(METODO_PAGO_LABEL) as MetodoPago[];
    if (metodo.startsWith('cat:')) return todos.filter(m => METODO_CATEGORIA[m] === metodo.slice(4));
    return todos.filter(m => m === metodo);
  }, [metodo]);

  // UNA fuente para la frase, el gráfico y el libro. El filtro son DOS pasos, y se
  // dejan explícitos porque el informe consume el intermedio: `enBucket` es el recorte
  // de TIEMPO (rango + bucket) sin el filtro de método, y de él sale el desglose por
  // método del PDF —que muestra el período completo aunque el select filtre—. La
  // relación `filtered ⊆ enBucket` es la garantía de que las dos cifras del documento
  // salen del mismo array y no de dos consultas.
  const enBucket = useMemo(
    () => pagos.filter(p => !bucketSel || bucketKey(new Date(p.fecha), bucketSel.escala) === bucketSel.key),
    [pagos, bucketSel],
  );
  const filtered = useMemo(
    () => (metodosDelFiltro === null ? enBucket : enBucket.filter(p => metodosDelFiltro.includes(p.metodo))),
    [enBucket, metodosDelFiltro],
  );

  const totalPeriodo = filtered.reduce((sum, p) => sum + p.monto, 0);

  // La etiqueta del método para la frase y el eyebrow. La opción de GRUPO ("Cualquier
  // digital") se dice como se lee en una oración —"por medios digitales"—, no con el
  // nombre técnico de la categoría.
  const metodoLabel = useMemo(() => {
    if (metodo === 'all') return null;
    if (metodo.startsWith('cat:')) {
      const cat = metodo.slice(4) as PaymentCategoria;
      return cat === 'TRANSFERENCIA' ? 'medios digitales' : PAYMENT_CATEGORIA_LABEL[cat];
    }
    return METODO_PAGO_LABEL[metodo as MetodoPago];
  }, [metodo]);

  // El "mejor día" sólo cuando la curva DIBUJA y no hay un bucket recortado: dentro de
  // un solo día no hay días que comparar, y sin curva no hay de dónde leer ese pico.
  const mejorDia = useMemo(
    () => (!bucketSel && bucketear(from, to).tipo === 'dibuja' ? mejorDiaDe(filtered) : null),
    [bucketSel, from, to, filtered],
  );

  const frase = useMemo(() => fraseDePagos({
    desde: from, hasta: to, bucket: bucketSel, metodoLabel,
    total: totalPeriodo, conteo: filtered.length, mejorDia, ahora,
  }), [from, to, bucketSel, metodoLabel, totalPeriodo, filtered.length, mejorDia, ahora]);

  const hasFilters = metodo !== 'all' || bucketSel !== null
    || from !== rangoMes.desde || to !== rangoMes.hasta;

  // ── Handlers ─────────────────────────────────────────────────────────────────

  // Un cambio de RANGO limpia el recorte de tiempo (es específico del rango). El
  // método sobrevive: es de otro eje.
  const setRango = (d: string | null, h: string | null) => {
    setFrom(d ?? ''); setTo(h ?? ''); setBucketSel(null);
  };

  // EL EJE NUNCA SE FILTRA A SÍ MISMO (§ doctrina): el clic en método escribe el SELECT;
  // el clic en tiempo (barra o fecha) escribe el CHIP. Cada uno en su control, y cada uno
  // reemplaza al anterior de su tipo (toggle: clic en el activo lo quita).
  const onMetodo = (m: MetodoPago) => setMetodo(prev => (prev === m ? 'all' : m));
  const onFecha = (fechaISO: string) => {
    const d = new Date(fechaISO);
    const key = zonedDayKey(d, BUSINESS_TZ);
    setBucketSel(prev =>
      prev && prev.escala === 'dia' && prev.key === key
        ? null
        : { escala: 'dia', key, etiqueta: etiquetaBucket(startOfZonedDay(d, BUSINESS_TZ, 0), 'dia') },
    );
  };

  // ── El INFORME (PDF) ───────────────────────────────────────────────────────
  // La PRIMERA acción de esta pantalla, que es un libro de sólo lectura. Descargar no
  // escribe, así que no rompe esa definición — y por eso el botón va SECUNDARIO, nunca
  // primario: Pagos no tiene una acción principal que ofrecer.
  //
  // Lleva la guarda de doble-submit porque generar mil filas TARDA: un botón mudo
  // mientras trabaja es exactamente lo que invita al segundo click (§ la frontera del
  // patrón). El error va por TOAST y no por `ErrorDialogo`: no hay diálogo donde vivir.
  const informe = useAccionGuardada();
  const descargarInforme = () => informe.ejecutar(async () => {
    try {
      // El modelo sale de lo que la pantalla YA tiene —`filtered` y la misma frase—,
      // no de una segunda consulta: el informe no puede contener un conjunto que el
      // libro no muestre.
      const modelo = modeloInforme({
        negocio: siteConfig.brand.nombre,
        ahora: new Date(),
        pagos: filtered, enBucket,
        desde: from, hasta: to,
        metodoLabel, metodosDelFiltro, mejorDia,
      });
      // La librería viaja en su propio chunk: se descarga al pedir el informe, no al
      // abrir Pagos.
      const { generarInformePdf, descargar } = await import('@/lib/pagos/informe-pdf');
      descargar(await generarInformePdf(modelo), modelo.nombreArchivo);
    } catch {
      toast.error('No se pudo generar el informe. Volvé a intentarlo.');
    }
  });

  const clearFilters = () => {
    setMetodo('all'); setFrom(rangoMes.desde); setTo(rangoMes.hasta);
    setBucketSel(null);
    const next = new URLSearchParams(searchParams.toString());
    next.delete('desde'); next.delete('hasta');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="duna duna-sin-split">
      {/* CABECERA fija: eyebrow + LA FRASE + filtros (y, con la curva, el gráfico).
          El chip de bucket vive acá, con etiqueta que se entiende sola. */}
      <div className="duna-cabecera space-y-4 pb-4">
        {/* LA FRASE reemplaza al título, al descargo del ledger y al stat: la pantalla
            abre diciendo la RESPUESTA, no un rótulo y una cifra que el lector junta.
            El h1 ES la frase —el nombre de la sección ya lo dan el rail y la pestaña—.
            Peso 500 con la cifra y el conteo en semibold: los tramos vienen partidos de
            `fraseDePagos` para que la tipografía no se desincronice de la gramática. */}
        <div aria-busy={loading || undefined}>
          {/* SIN eyebrow de rango: el rango ya se lee en el date picker de abajo, y
              repetirlo acá costaba una línea de la zona fija —que no scrollea— por un
              dato que ya está en pantalla. `frase.eyebrow` sigue existiendo para cuando
              el rango suba al topbar.

              LA FRASE TIENE TRES ESTADOS, NO DOS: cargando · vacío · con datos. Sin el
              primero, `pagos` en `[]` mientras viaja el fetch cae en la rama del VACÍO y
              la pantalla AFIRMA "no entró ningún pago… simplemente no hubo" sobre un dato
              que todavía no llegó. Es peor que un loader feo: ese subtítulo está escrito
              para convencer de que el dato es cierto.

              El esqueleto va SIEMPRE que carga, no sólo en el arranque: al cambiar de
              rango la frase vieja se quedaría afirmando el rango anterior ("Este mes
              entraron $ 315.000" mientras llega julio), que es la misma mentira, más
              sutil y más creíble.

              Usa los MISMOS elementos que la frase cargada (`duna-display-m`, `duna-sub`)
              con barras grises adentro, así el alto sale de la misma tipografía. */}
          {loading ? (
            <>
              <h1 className="duna-display-m" aria-hidden="true"
                  style={{ fontWeight: 'var(--duna-w-medium)', margin: 0 }}>
                <span style={{ display: 'inline-block', width: '62%', maxWidth: '32rem', height: '0.85em',
                               borderRadius: 4, background: 'var(--duna-skel)', verticalAlign: 'middle' }} />
              </h1>
              <p className="duna-sub" aria-hidden="true" style={{ margin: 'var(--duna-space-hairline) 0 0' }}>
                <span style={{ display: 'inline-block', width: '40%', maxWidth: '22rem', height: '0.85em',
                               borderRadius: 3, background: 'var(--duna-skel)', verticalAlign: 'middle' }} />
              </p>
            </>
          ) : (
            <>
              <h1 className="duna-display-m"
                  style={{ fontWeight: 'var(--duna-w-medium)', margin: 0 }}>
                {frase.tramos.map((tr, i) => tr.fuerte
                  ? <strong key={i} style={{ fontWeight: 'var(--duna-w-semi)' }}>{tr.t}</strong>
                  : <span key={i}>{tr.t}</span>)}
              </h1>
              <p className="duna-sub" style={{ margin: 'var(--duna-space-hairline) 0 0' }}>{frase.subtitulo}</p>
            </>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-2)', alignItems: 'center' }}>
          <select
            className="duna-input duna-select duna-input--sm"
            style={{ width: 'auto' }}
            aria-label="Filtrar por método de pago"
            value={metodo}
            onChange={e => setMetodo(e.target.value)}
          >
            {/* Agrupado por CÓMO LLEGA LA PLATA (lo que el operador distingue), no por la
                mecánica del filtro. "Cualquier digital" (value cat:*) conserva la
                capacidad de grupo —filtrar los tres digitales de un golpe— como primera
                opción del grupo, separada de los métodos por un divisor inerte (lo más
                cerca de "visualmente separada" que da un <select> nativo). */}
            <option value="all">Método · todos</option>
            <optgroup label="Digitales">
              <option value="cat:TRANSFERENCIA">Cualquier digital</option>
              <option value="" disabled>──────────</option>
              <option value="NEQUI">{METODO_PAGO_LABEL.NEQUI}</option>
              <option value="DAVIPLATA">{METODO_PAGO_LABEL.DAVIPLATA}</option>
              <option value="TRANSFERENCIA">{METODO_PAGO_LABEL.TRANSFERENCIA}</option>
            </optgroup>
            <optgroup label="Físicos">
              <option value="EFECTIVO">{METODO_PAGO_LABEL.EFECTIVO}</option>
            </optgroup>
            <optgroup label="Otros">
              <option value="OTRO">{METODO_PAGO_LABEL.OTRO}</option>
            </optgroup>
          </select>
          <PresetsPeriodo opciones={presetsPagos} desde={from} hasta={to} onSelect={setRango} />
          <DateRangePicker desde={from || null} hasta={to || null} onChange={setRango} />
          {/* Chip del recorte de tiempo — etiqueta auto-explicativa, nunca "1 seleccionado". */}
          {bucketSel && (
            <span className="duna-badge duna-badge--neutral" style={{ gap: 'var(--duna-space-inline)' }}>
              {bucketSel.etiqueta}
              <button type="button" onClick={() => setBucketSel(null)} aria-label="Quitar el período seleccionado"
                      style={{ display: 'inline-flex', border: 0, background: 'transparent', cursor: 'pointer', color: 'inherit', padding: 0 }}>
                <X style={{ width: 12, height: 12 }} />
              </button>
            </span>
          )}
          {hasFilters && (
            <button type="button" className="duna-btn duna-btn--ghost duna-btn--sm" onClick={clearFilters}>
              <FilterX /> Limpiar filtros
            </button>
          )}
          {/* El informe cierra la fila, empujado a la derecha: es una ACCIÓN, no un
              filtro, y mezclarlo con los controles del recorte lo haría parecer uno.
              Secundario a propósito — esta pantalla no tiene acción primaria. */}
          <button
            type="button"
            className="duna-btn duna-btn--secondary duna-btn--sm"
            style={{ marginLeft: 'auto' }}
            onClick={descargarInforme}
            disabled={informe.enVuelo || loading || filtered.length === 0}
          >
            <Download /> {informe.enVuelo ? 'Generando…' : 'Descargar informe'}
          </button>
        </div>

        {/* EL GRÁFICO va en la ZONA FIJA: no scrollea. Decisión del owner — un gráfico
            que se va al scrollear obliga a volver arriba para leer el contexto de la
            fila que se está mirando. Lo que cuesta es alto de cabecera, y por eso la
            frase reemplazó al bloque título+stat. */}
        {loading ? (
          /* El MISMO `loading` gobierna los tres bloques (frase, gráfico, libro), así que
             los tres esqueletos entran y salen en el mismo render: si uno volviera antes,
             la zona fija parpadearía en dos tiempos. Y el hueco mide lo MISMO que el
             bloque cargado —comparte `ALTO` y las clases—, así que no hay salto de layout
             en la zona que justamente no se mueve. */
          <PagosCurvaEsqueleto />
        ) : pagos.length > 0 ? (
          <PagosCurva
            pagos={pagos} desde={from} hasta={to}
            metodoFiltrado={metodo} bucketSel={bucketSel}
            onBucket={setBucketSel} onMetodo={onMetodo}
          />
        ) : null}
      </div>{/* /duna-cabecera */}

      {/* REGIÓN — el libro y NADA MÁS, así que es el hijo ÚNICO: `.duna-region > *` lo
          hace scroller y su `__head` pega contra él (el caso sticky canónico). */}
      <div className="duna-region">
          {loading ? (
            /* El hueco de la carga tiene la FORMA de lo que llega: filas del grid-list,
               no un spinner ni un esqueleto de tarjeta (eso sugeriría que va a llegar
               otra cosa). Sin pieza nueva —el marcado es `.duna-lista` con celdas grises—.
               El día que Inventario migre a `.duna-lista` (§ backlog #28) los dos
               comparten esta forma y se extrae. */
            <div className="duna-lista" aria-hidden="true">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="duna-lista__fila" style={{ gridTemplateColumns: COLS }}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <span key={j} style={{
                      height: 11, borderRadius: 3, background: 'var(--duna-skel)',
                      width: j === 7 ? 14 : j % 3 === 0 ? '55%' : '82%',
                    }} />
                  ))}
                </div>
              ))}
            </div>
          ) : pagos.length === 0 ? (
            <div className="duna-card duna-card__pad"><p className="duna-sub" style={{ margin: 0 }}>No hay pagos en el rango seleccionado.</p></div>
          ) : filtered.length === 0 ? (
            <div className="duna-card duna-card__pad"><p className="duna-sub" style={{ margin: 0 }}>No hay pagos que coincidan con el filtro.</p></div>
          ) : (
            <div className="duna-lista">
              <div className="duna-lista__fila duna-lista__head" style={{ gridTemplateColumns: COLS }}>
                <span>Fecha</span><span>Orden</span><span>Cliente</span>
                <span className="duna-lista__r">Monto</span><span>Método</span>
                <span>Referencia</span><span>Registrado por</span><span aria-hidden="true" />
              </div>
              {filtered.map(p => (
                <div key={p.id} className="duna-lista__fila" style={{ gridTemplateColumns: COLS }}>
                  {/* Fecha y Método son CELDAS NAVEGABLES: caminos a filtros que ya existen
                      (el chip de tiempo y el select), sin estado nuevo. Afordancia `.duna-link`,
                      sin color nuevo; reemplazan, no acumulan (toggle en el activo).
                      `data-label` es el encabezado que el reflujo móvil (<960) pierde; el
                      clip no lo lleva (es un indicador, no un dato con columna). */}
                  <span data-label="Fecha">
                    <button type="button" className="duna-link" onClick={() => onFecha(p.fecha)}
                            style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>
                      {formatFecha(p.fecha)}
                    </button>
                  </span>
                  <span data-label="Orden">
                    {p.order?.numero_orden
                      ? <Link href={`/admin/pedidos?pedido=${encodeURIComponent(p.order.numero_orden)}`} className="duna-link">{p.order.numero_orden}</Link>
                      : <span className="duna-sub">—</span>}
                  </span>
                  <span data-label="Cliente" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.order?.cliente_nombre ?? '—'}</span>
                  <span data-label="Monto" className="duna-lista__r duna-num">{formatCOP(p.monto)}</span>
                  <span data-label="Método">
                    <button type="button" className="duna-link" onClick={() => onMetodo(p.metodo)}
                            style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>
                      {METODO_PAGO_LABEL[p.metodo]}
                    </button>
                  </span>
                  <span data-label="Referencia" className="duna-mono" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.referencia || '—'}</span>
                  <span data-label="Registrado" className="duna-sub" style={{ margin: 0 }}>{p.registrado_por_nombre ?? '—'}</span>
                  <span><SoporteClip comprobantes={p.order?.comprobantes ?? []} /></span>
                </div>
              ))}
            </div>
          )}
      </div>{/* /duna-region */}
    </div>
  );
}

// ─── SoporteClip ──────────────────────────────────────────────────────────────
// Bajo el modelo de cobro, un Payment sólo coexiste con comprobantes VERIFICADOS
// (§ Pagos al lenguaje Duna). Clip neutro cuando lo hay; el punto de atención vive
// en el carril "Por verificar" de Pedidos, no en este libro.
function SoporteClip({ comprobantes }: { comprobantes: { estado: string }[] }) {
  if (!comprobantes.some(c => c.estado === 'VERIFICADO')) return null;
  return (
    <span title="Comprobante verificado en archivo" style={{ display: 'inline-flex', color: 'var(--duna-muted)' }}>
      <Paperclip style={{ width: 14, height: 14 }} />
    </span>
  );
}
