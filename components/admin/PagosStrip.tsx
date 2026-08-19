'use client';

import { useMemo } from 'react';
import type { Payment, MetodoPago } from '@/types/payment';
import { METODO_PAGO_LABEL, METODO_CATEGORIA } from '@/types/payment';
import { formatCOP } from '@duna/core/utils';
import { bucketear, bucketKey, type Escala } from '@/lib/pagos/bucketeo';
import { tituloEscala, etiquetaEje, etiquetaBucket, type RecorteTiempo } from '@/lib/pagos/etiquetas';
import { DunaTooltip } from '@/components/admin/DunaTooltip';

// EL STRIP DE PAGOS — barras sobre el tiempo, encima del libro, DENTRO de la región
// que scrollea. Todo sale de `pagos` (la misma fuente que la tabla), bucketeado
// client-side. Colores de la serie categórica (`--duna-serie-*`); nunca estado.
//
// DOS EJES INTERCAMBIABLES, y una regla: EL EJE NUNCA SE FILTRA A SÍ MISMO (§ doctrina).
// - modo TIEMPO (4–31 buckets): una barra por bucket; filtra por MÉTODO (el select).
// - modo MÉTODO (el recorte es 1 bucket): una barra por método; filtra por TIEMPO.
//   El select NO recorta estas barras —serían una sola, que no informa—: se muestran
//   las cinco y se resalta la activa; el select filtra la TABLA, y una nota lo declara.
// - <4 buckets que no sean 1 (2–3): no hay forma en ningún eje → se declara.
// - >31 años: no dibuja → se declara.

const METODOS_SERIE: { metodo: MetodoPago; color: string }[] = [
  { metodo: 'EFECTIVO',      color: 'var(--duna-serie-1)' },
  { metodo: 'NEQUI',         color: 'var(--duna-serie-2)' },
  { metodo: 'DAVIPLATA',     color: 'var(--duna-serie-3)' },
  { metodo: 'TRANSFERENCIA', color: 'var(--duna-serie-4)' },
  { metodo: 'OTRO',          color: 'var(--duna-serie-5)' },
];

const ALTO = 96;

export function PagosStrip({
  pagos, desde, hasta, metodoFiltrado, bucketSel, split, excl,
  onBucket, onMetodo, onToggleSplit, onToggleExcl,
}: {
  pagos: Payment[];
  desde: string;
  hasta: string;
  metodoFiltrado: string;                         // 'all' | MetodoPago | `cat:${cat}`
  bucketSel: RecorteTiempo | null;                // el recorte de tiempo (chip)
  split: boolean;
  excl: MetodoPago[];
  onBucket: (r: RecorteTiempo) => void;           // clic en barra de tiempo → escribe el chip
  onMetodo: (m: MetodoPago) => void;              // clic en barra de método → escribe el select
  onToggleSplit: () => void;
  onToggleExcl: (m: MetodoPago) => void;
}) {
  const b = useMemo(() => bucketear(desde, hasta), [desde, hasta]);

  // El modo lo decide si el recorte activo es UN bucket (por chip, o por rango de 1).
  const modo: 'tiempo' | 'metodo' | 'pocas' | 'muchas' =
    b.tipo === 'muchas' ? 'muchas'
    : bucketSel ? 'metodo'
    : b.tipo === 'pocas' ? (b.n === 1 ? 'metodo' : 'pocas')
    : 'tiempo';

  // Datos del modo TIEMPO: barras por bucket, con la regla `metOk` (método + excl).
  const datosT = useMemo(() => {
    if (modo !== 'tiempo' || b.tipo !== 'dibuja') return null;
    const { escala, buckets } = b;
    const metOk = (m: MetodoPago) => {
      if (metodoFiltrado === 'all') return !excl.includes(m);
      if (metodoFiltrado.startsWith('cat:')) return METODO_CATEGORIA[m] === metodoFiltrado.slice(4);
      return m === metodoFiltrado;
    };
    const porBucket = new Map(buckets.map(bk => [bk.key, { total: 0, met: {} as Record<string, number> }]));
    const totalMetodo: Record<string, number> = {};
    let totalRango = 0;
    for (const p of pagos) {
      totalMetodo[p.metodo] = (totalMetodo[p.metodo] ?? 0) + p.monto;
      totalRango += p.monto;
      if (!metOk(p.metodo)) continue;
      const cell = porBucket.get(bucketKey(new Date(p.fecha), escala));
      if (!cell) continue;
      cell.total += p.monto;
      cell.met[p.metodo] = (cell.met[p.metodo] ?? 0) + p.monto;
    }
    const max = Math.max(1, ...[...porBucket.values()].map(c => c.total));
    return { escala, buckets, porBucket, max, totalMetodo, totalRango, hayParcial: buckets.some(bk => bk.parcial) };
  }, [modo, b, pagos, excl, metodoFiltrado]);

  // Datos del modo MÉTODO: suma por método del bucket activo. Las CINCO, ignorando el
  // select (el eje no se filtra a sí mismo) — sólo se resalta la activa.
  const datosM = useMemo(() => {
    if (modo !== 'metodo') return null;
    const enBucket = bucketSel
      ? (p: Payment) => bucketKey(new Date(p.fecha), bucketSel.escala) === bucketSel.key
      : () => true; // rango de 1 bucket: todos los pagos caen en él
    const porMetodo: Record<string, number> = {};
    for (const p of pagos) if (enBucket(p)) porMetodo[p.metodo] = (porMetodo[p.metodo] ?? 0) + p.monto;
    const max = Math.max(1, ...METODOS_SERIE.map(m => porMetodo[m.metodo] ?? 0));
    return { porMetodo, max };
  }, [modo, pagos, bucketSel]);

  // El método resaltado (sólo un método concreto del select; una categoría no resalta uno).
  const metodoSel = metodoFiltrado !== 'all' && !metodoFiltrado.startsWith('cat:')
    ? (metodoFiltrado as MetodoPago) : null;

  if (modo === 'muchas') {
    return <div key={modo} className="admin-strip admin-strip--vacio"><p className="duna-sub" style={{ margin: 0 }}>
      El rango es demasiado amplio para graficarlo (más de 31 años). El libro de abajo sigue completo.
    </p></div>;
  }
  if (modo === 'pocas') {
    return <div key={modo} className="admin-strip admin-strip--vacio"><p className="duna-sub" style={{ margin: 0 }}>
      El rango es muy corto para una tira de barras (dos o tres períodos). El total está en las stats de arriba.
    </p></div>;
  }

  // ── MODO MÉTODO ──────────────────────────────────────────────────────────────
  if (modo === 'metodo' && datosM) {
    return (
      <div key={modo} className="admin-strip">
        <div className="admin-strip__head">
          <span className="duna-eyebrow">Ingresos por método</span>
          {/* Sin toggle: el eje YA es método. Ocultarlo, no deshabilitarlo. */}
        </div>
        <div className="admin-strip__metodos">
          {METODOS_SERIE.map(m => {
            const v = datosM.porMetodo[m.metodo] ?? 0;
            const activo = metodoSel === m.metodo;
            return (
              <DunaTooltip key={m.metodo} content={`${METODO_PAGO_LABEL[m.metodo]} — ${formatCOP(v)}`}>
              <button
                type="button"
                className={`admin-strip__mcol${activo ? ' is-sel' : ''}`}
                onClick={() => onMetodo(m.metodo)}
              >
                <span className="admin-strip__mval duna-num">{formatCOP(v)}</span>
                <span className="admin-strip__mbararea" style={{ height: ALTO }}>
                  <span className="admin-strip__mbar" style={{ height: (v / datosM.max) * ALTO, background: m.color }} />
                </span>
                <span className="admin-strip__mlbl">{METODO_PAGO_LABEL[m.metodo]}</span>
              </button>
              </DunaTooltip>
            );
          })}
        </div>
        {/* Se DECLARA sólo cuando el caso ocurre: cinco barras sobre una fila filtrada
            se leería como fallo si no se dice. Corta, no un descargo permanente. */}
        {metodoSel && (
          <p className="admin-strip__nota">
            El desglose es del período completo; la tabla de abajo está filtrada a {METODO_PAGO_LABEL[metodoSel]}.
          </p>
        )}
      </div>
    );
  }

  // ── MODO TIEMPO ──────────────────────────────────────────────────────────────
  if (!datosT) return null;
  const { escala, buckets, porBucket, max, totalMetodo, totalRango, hayParcial } = datosT;
  const splitReal = split && metodoFiltrado === 'all';
  const toggleBloqueado = metodoFiltrado !== 'all';

  const toggle = (
    <button
      type="button"
      className={`admin-strip__toggle${splitReal ? ' is-on' : ''}`}
      onClick={onToggleSplit}
      disabled={toggleBloqueado}
      aria-pressed={splitReal}
    >
      <span className="admin-strip__sw" /> Por método
    </button>
  );

  return (
    <div key={modo} className="admin-strip">
      <div className="admin-strip__head">
        <span className="duna-eyebrow">{tituloEscala(escala as Escala)}</span>
        {/* Deshabilitado: el span cataliza el hover que el botón disabled se traga. */}
        {toggleBloqueado ? (
          <DunaTooltip content="Ya filtraste por un método">
            <span className="inline-flex cursor-not-allowed">{toggle}</span>
          </DunaTooltip>
        ) : toggle}
      </div>

      <div className="admin-strip__barras" style={{ height: ALTO }}>
        {buckets.map(bk => {
          const cell = porBucket.get(bk.key)!;
          return (
            <DunaTooltip
              key={bk.key}
              content={`${etiquetaBucket(bk.inicio, escala as Escala)}${bk.parcial ? ' · período parcial' : ''} — ${formatCOP(cell.total)}`}
            >
            <button
              type="button"
              className={`admin-strip__col${bk.parcial ? ' is-parcial' : ''}`}
              onClick={() => onBucket({ escala: escala as Escala, key: bk.key, etiqueta: etiquetaBucket(bk.inicio, escala as Escala) })}
            >
              <span className="admin-strip__bar" style={{ height: (cell.total / max) * ALTO }}>
                {splitReal
                  ? METODOS_SERIE.filter(m => !excl.includes(m.metodo)).map(m => {
                      const v = cell.met[m.metodo] ?? 0;
                      return v > 0
                        ? <span key={m.metodo} style={{ display: 'block', height: `${(v / cell.total) * 100}%`, background: m.color }} />
                        : null;
                    })
                  : <span style={{ display: 'block', height: '100%', background: 'var(--duna-ink-2)' }} />}
              </span>
            </button>
            </DunaTooltip>
          );
        })}
      </div>

      <div className="admin-strip__eje">
        {buckets.map(bk => (
          <span key={bk.key} className={bk.parcial ? 'is-parcial' : undefined}>
            {etiquetaEje(bk.inicio, escala as Escala)}{bk.parcial ? ' ·' : ''}
          </span>
        ))}
      </div>
      {hayParcial && (
        <p className="admin-strip__nota">· período parcial (el rango arranca o termina a mitad de {escala === 'semana' ? 'semana' : escala === 'mes' ? 'mes' : escala === 'trimestre' ? 'trimestre' : 'período'})</p>
      )}

      {splitReal && (
        <div className="admin-strip__leyenda">
          {METODOS_SERIE.map(m => {
            const pct = totalRango > 0 ? Math.round((totalMetodo[m.metodo] ?? 0) / totalRango * 100) : 0;
            const fuera = excl.includes(m.metodo);
            return (
              <button key={m.metodo} type="button" className={`admin-strip__leg${fuera ? ' is-fuera' : ''}`} onClick={() => onToggleExcl(m.metodo)} aria-pressed={!fuera}>
                <span className="admin-strip__legsw" style={{ background: m.color }} />
                <span className="admin-strip__leglbl">{METODO_PAGO_LABEL[m.metodo]}</span>
                <span className="admin-strip__legpct">{pct}%</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
