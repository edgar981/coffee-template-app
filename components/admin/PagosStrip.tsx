'use client';

import { useMemo } from 'react';
import type { Payment, MetodoPago } from '@/types/payment';
import { METODO_PAGO_LABEL, METODO_CATEGORIA } from '@/types/payment';
import { formatCOP } from '@duna/core/utils';
import { bucketear, bucketKey, type Escala } from '@/lib/pagos/bucketeo';
import { tituloEscala, etiquetaEje, etiquetaBucket } from '@/lib/pagos/etiquetas';

// EL STRIP DE PAGOS — la tira de barras sobre el tiempo, encima del libro y DENTRO
// de la región que scrollea. Es bespoke admin (divs + `--duna-serie-*`), no una
// primitiva del DS. Todo lo que pinta sale de `pagos` (la misma fuente que la tabla),
// bucketeado client-side; el filtro (método + exclusiones + bucket) es de la página.
//
// Las barras se ordenan por MÉTODO con la serie categórica. serie-5 es el neutro
// (OTRO), por diseño. El orden de apilado es fijo para que la lectura no cambie.
const METODOS_SERIE: { metodo: MetodoPago; color: string }[] = [
  { metodo: 'EFECTIVO',      color: 'var(--duna-serie-1)' },
  { metodo: 'NEQUI',         color: 'var(--duna-serie-2)' },
  { metodo: 'DAVIPLATA',     color: 'var(--duna-serie-3)' },
  { metodo: 'TRANSFERENCIA', color: 'var(--duna-serie-4)' },
  { metodo: 'OTRO',          color: 'var(--duna-serie-5)' },
];

const ALTO = 96; // px de la barra más alta

export function PagosStrip({
  pagos, desde, hasta, metodoFiltrado, bucketSel, split, excl,
  onBucket, onToggleSplit, onToggleExcl,
}: {
  pagos: Payment[];
  desde: string;
  hasta: string;
  /** El método del select: 'all' | MetodoPago | `cat:${cat}`. Sólo se usa para
   *  DESHABILITAR el split (si el select acotó a un método, partir es redundante). */
  metodoFiltrado: string;
  bucketSel: string | null;
  split: boolean;
  /** Métodos excluidos desde la leyenda (una sola fuente con la página). */
  excl: MetodoPago[];
  onBucket: (key: string | null) => void;
  onToggleSplit: () => void;
  onToggleExcl: (m: MetodoPago) => void;
}) {
  const b = useMemo(() => bucketear(desde, hasta), [desde, hasta]);

  // Sumas por bucket y por método, sobre TODO `pagos` del rango (el strip muestra la
  // distribución completa; el bucket seleccionado se resalta, no se recorta). Las
  // exclusiones sí se aplican a las barras —son una fuente con la tabla—.
  const datos = useMemo(() => {
    if (b.tipo !== 'dibuja') return null;
    const { escala, buckets } = b;
    // La MISMA regla que la tabla: método (select) + exclusiones (leyenda). El bucket
    // NO se aplica acá —el strip muestra el rango entero y resalta el seleccionado—.
    const metOk = (m: MetodoPago) => {
      if (metodoFiltrado === 'all') return !excl.includes(m);
      if (metodoFiltrado.startsWith('cat:')) return METODO_CATEGORIA[m] === metodoFiltrado.slice(4);
      return m === metodoFiltrado;
    };
    const porBucket = new Map(buckets.map(bk => [bk.key, { total: 0, met: {} as Record<string, number>, bucket: bk }]));
    // Total del rango por método SIN filtrar (para la leyenda que NO re-basea).
    const totalMetodo: Record<string, number> = {};
    let totalRango = 0;
    for (const p of pagos) {
      totalMetodo[p.metodo] = (totalMetodo[p.metodo] ?? 0) + p.monto;
      totalRango += p.monto;
      if (!metOk(p.metodo)) continue;                   // fuera del filtro: no entra a las barras
      const cell = porBucket.get(bucketKey(new Date(p.fecha), escala));
      if (!cell) continue;
      cell.total += p.monto;
      cell.met[p.metodo] = (cell.met[p.metodo] ?? 0) + p.monto;
    }
    const max = Math.max(1, ...[...porBucket.values()].map(c => c.total));
    const hayParcial = buckets.some(bk => bk.parcial);
    return { escala, buckets, porBucket, max, totalMetodo, totalRango, hayParcial };
  }, [b, pagos, excl, metodoFiltrado]);

  // Los DOS extremos DECLARAN en vez de dibujar algo que no informa (§ bucketeo). La
  // tabla sigue completa (la página la muestra debajo).
  if (b.tipo === 'muchas') {
    return (
      <div className="admin-strip admin-strip--vacio">
        <p className="duna-sub" style={{ margin: 0 }}>
          El rango es demasiado amplio para graficarlo (más de 31 años). El libro de abajo sigue completo.
        </p>
      </div>
    );
  }
  if (b.tipo === 'pocas' || !datos) {
    return (
      <div className="admin-strip admin-strip--vacio">
        <p className="duna-sub" style={{ margin: 0 }}>
          El rango es muy corto para una tira de barras (menos de 4 períodos). El total está en las stats de arriba.
        </p>
      </div>
    );
  }

  const { escala, buckets, porBucket, max, totalMetodo, totalRango, hayParcial } = datos;
  const splitReal = split && metodoFiltrado === 'all';

  return (
    <div className="admin-strip">
      <div className="admin-strip__head">
        <span className="duna-eyebrow">{tituloEscala(escala as Escala)}</span>
        {/* El toggle se deshabilita si el select acotó a un método (partir sobra). */}
        <button
          type="button"
          className={`admin-strip__toggle${splitReal ? ' is-on' : ''}`}
          onClick={onToggleSplit}
          disabled={metodoFiltrado !== 'all'}
          aria-pressed={splitReal}
          title={metodoFiltrado !== 'all' ? 'Ya filtraste por un método' : undefined}
        >
          <span className="admin-strip__sw" /> Por método
        </button>
      </div>

      {/* Las barras. Cada columna es clickeable: filtra a ese bucket (chip en la
          cabecera fija). El bucket seleccionado se resalta; un segundo clic lo limpia. */}
      <div className="admin-strip__barras" style={{ height: ALTO }}>
        {buckets.map(bk => {
          const cell = porBucket.get(bk.key)!;
          const sel = bucketSel === bk.key;
          return (
            <button
              key={bk.key}
              type="button"
              className={`admin-strip__col${sel ? ' is-sel' : ''}${bk.parcial ? ' is-parcial' : ''}`}
              onClick={() => onBucket(sel ? null : bk.key)}
              title={`${etiquetaBucket(bk.inicio, escala as Escala)}${bk.parcial ? ' · período parcial' : ''} — ${formatCOP(cell.total)}`}
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
          );
        })}
      </div>

      {/* El eje. Los buckets PARCIALES (primero/último por corte de rango) se marcan
          con `·` para que una barra corta no se lea como caída de ventas. */}
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

      {/* La leyenda — sólo con split. NO re-basea: cada % es sobre el total del rango.
          Clic excluye/incluye (tachado, con su % visible). Es una fuente con la tabla. */}
      {splitReal && (
        <div className="admin-strip__leyenda">
          {METODOS_SERIE.map(m => {
            const pct = totalRango > 0 ? Math.round((totalMetodo[m.metodo] ?? 0) / totalRango * 100) : 0;
            const fuera = excl.includes(m.metodo);
            return (
              <button
                key={m.metodo}
                type="button"
                className={`admin-strip__leg${fuera ? ' is-fuera' : ''}`}
                onClick={() => onToggleExcl(m.metodo)}
                aria-pressed={!fuera}
              >
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
