'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Package, ArrowUpDown } from 'lucide-react';
import { OrderCard } from '@duna/design-system/components/OrderCard';
import { DunaTable, type DunaColumn } from '@duna/design-system/components/DunaTable';
import { SkeletonOrderCards } from '@duna/design-system/components/SkeletonOrderCard';
import { formatCOP } from '@duna/core/utils';
import { formatFecha } from '@duna/core/format-fecha';
import { toast } from 'sonner';
import { getProducts, getInventoryLogs } from '@/lib/api/inventory';
import { AdjustStockModal } from '@/components/admin/AdjustStockModal';
import { nivelStock, etiquetaStock, claseStock } from '@/lib/productos/stock';
import {
  CARRILES_INVENTARIO, aplicarCarril, carrilPorKey, conteosInventario,
  CARRIL_INVENTARIO_DEFAULT, type CarrilKey,
} from '@/lib/inventario/filtros';
import type { Product } from '@/types/product';
import type { InventoryLog, InventoryMovementType } from '@/types/inventory';

// ═══ INVENTARIO · la cuarta vertical del rediseño Duna OS ═════════════════════
//
// Responde UNA pregunta que ninguna pantalla de producto puede: "¿qué tengo que
// reponer?" y "¿qué pasó con el stock?". La frontera con Productos ya está fijada
// (§ CLAUDE.md): Productos es "¿cómo está ESTE producto?" —un producto, todas sus
// facetas—; Inventario es "todos los productos, UNA faceta" —la reposición— más el
// kardex COMPLETO como vista de auditoría.
//
// Por eso lo que era la tabla "Stock Actual" de la pantalla vieja NO vive acá: era
// vista de producto (stock, mínimo, valor por fila, estado), y todo eso está en
// Productos. Lo que queda es la COLA de reposición (un carril, no una tabla) y el
// KARDEX.
//
// ── SEGMENTADO, NO APILADO (decisión del owner) ─────────────────────────────
//
// Son dos preguntas con dos TEMPOS: "¿qué repongo hoy?" es operación diaria;
// "¿qué pasó con el stock?" es auditoría que se consulta cuando algo no cuadra.
// Apiladas obligarían a scrollear la cola todos los días para llegar a la
// auditoría. La COLA es la vista por defecto (la pregunta operativa); la auditoría
// se elige.
//
// Se construye en `/admin/inventario-v2` mientras convive con la pantalla vieja;
// heredará `/admin/inventario` al retirarse aquélla, con su redirect — mismo
// procedimiento que Pedidos, Clientes y Productos.

type Vista = 'cola' | 'auditoria';

/** Lo que la fila de reposición pone en la ranura de estado. */
function badgeStock(p: Product): { label: string; tone: 'attention' | 'problem' } | undefined {
  const etiqueta = etiquetaStock(p);
  if (!etiqueta) return undefined;
  return { label: etiqueta, tone: nivelStock(p) === 'agotado' ? 'problem' : 'attention' };
}

// El TIPO de movimiento va NEUTRO — Amber Minimal: el rojo es alerta, y una salida
// o una venta son operación normal, no una alerta. La DIRECCIÓN la carga el signo
// de la cantidad (+entrada, −salida), no un color. (Decisión de acabado; si el
// owner prefiere semáforo verde-entra/rojo-sale en la auditoría, se cambia acá.)
const TIPO_LABEL: Record<InventoryMovementType, string> = {
  entrada: 'Entrada', salida: 'Salida', ajuste: 'Ajuste', venta: 'Venta', devolucion: 'Devolución',
};

/** El signo del movimiento. `ajuste` FIJA un valor absoluto: no es delta, así que
 *  se muestra el resultado, no un `+N` que no ocurrió. */
function signoDelMovimiento(l: InventoryLog): string {
  if (l.tipo === 'ajuste') return String(l.stock_nuevo);
  const suma = l.tipo === 'entrada' || l.tipo === 'devolucion';
  return `${suma ? '+' : '−'}${l.cantidad}`;
}

export default function InventarioV2Page() {
  return <Suspense fallback={null}><Inventario /></Suspense>;
}

function Inventario() {
  const router   = useRouter();
  const pathname = usePathname();
  const params   = useSearchParams();

  const [productos, setProductos] = useState<Product[]>([]);
  const [logs, setLogs]           = useState<InventoryLog[]>([]);
  const [cargando, setCargando]   = useState(true);
  const [error, setError]         = useState<string | null>(null);

  // El segmentado es preferencia local, no de la URL: es cómo mira quien mira, no
  // QUÉ se mira. Misma línea que el modo de vista de Productos. Arranca en la cola,
  // que es la pregunta operativa.
  const [vista, setVista] = useState<Vista>('cola');

  // El carril de la cola vive en la URL: enlazable (la card del dashboard puede
  // apuntar a "Por reponer"). Default = la pregunta operativa.
  const carril = (carrilPorKey(params.get('f') ?? '')?.key ?? CARRIL_INVENTARIO_DEFAULT) as CarrilKey;

  // AdjustStockModal, UNO solo: `producto` pre-llena (viene de una fila de la
  // cola), `null` muestra el selector (botón "Ajustar Stock" del encabezado).
  const [ajuste, setAjuste] = useState<{ producto: Product | null } | null>(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([getProducts(), getInventoryLogs()])
      .then(([p, l]) => { if (vivo) { setProductos(p); setLogs(l); setError(null); } })
      .catch(e => { if (vivo) setError(e instanceof Error ? e.message : 'Error al cargar el inventario'); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, []);

  // La cola: sólo productos ACTIVOS (un despublicado no es reposición pendiente,
  // y `isLowStock` ya lo excluye), filtrados por el carril.
  const activos    = useMemo(() => productos.filter(p => p.activo !== false), [productos]);
  const enCola     = useMemo(() => aplicarCarril(activos, carril), [activos, carril]);
  const cuentas    = useMemo(() => conteosInventario(activos), [activos]);

  // Valor del inventario: valuación de ESTADO VIGENTE (cuánto capital está parado
  // en stock ahora), por eso vive en la vista operativa. Usa el costo ACTUAL del
  // catálogo, así que es estimada, no contable — se declara en pantalla, como el
  // margen de Analítica.
  const valorTotal = useMemo(
    () => productos.reduce((s, p) => s + ((p.costo ?? 0) * p.stock), 0),
    [productos],
  );

  const aplicado = useCallback(({ product, log }: { product: Product; log: InventoryLog }) => {
    setProductos(prev => prev.map(p => p.id === product.id ? product : p));
    setLogs(prev => [log, ...prev]);
    toast.success('Inventario actualizado');
  }, []);

  const navegar = useCallback((f: string | null) => {
    const q = new URLSearchParams(params.toString());
    if (f === null) q.delete('f'); else q.set('f', f);
    const s = q.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  // ── El kardex como filas de la tabla de auditoría ──────────────────────────
  const columnasKardex: DunaColumn[] = [
    { key: 'producto', header: 'Producto' },
    { key: 'tipo',     header: 'Tipo' },
    { key: 'cantidad', header: 'Cantidad', align: 'right' },
    { key: 'saldo',    header: 'Antes → Después', align: 'right' },
    { key: 'motivo',   header: 'Motivo' },
    { key: 'quien',    header: 'Quién' },
    { key: 'fecha',    header: 'Fecha' },
  ];
  const filasKardex = logs.map(l => ({
    key: l.id,
    cells: [
      l.producto_nombre,
      <span key="t" className="duna-badge duna-badge--neutral">{TIPO_LABEL[l.tipo] ?? l.tipo}</span>,
      <span key="c" className="duna-num">{signoDelMovimiento(l)}</span>,
      <span key="s" className="duna-num">{l.stock_anterior} → {l.stock_nuevo}</span>,
      l.motivo || '—',
      // El actor. `—` es honesto: filas viejas y asientos del sistema no tienen
      // humano — es la razón por la que la columna existe.
      l.ajustado_por_nombre || '—',
      <span key="f" className="duna-caption">{formatFecha(l.createdAt)}</span>,
    ],
  }));

  return (
    <div className="duna">
      {/* ── Encabezado ─────────────────────────────────────────────────────── */}
      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--duna-space-4)', marginBottom: 'var(--duna-space-5)' }}>
        <h1 className="duna-display-m" style={{ minWidth: 0 }}>Inventario</h1>
        <button
          type="button"
          className="duna-btn duna-btn--primary"
          style={{ marginLeft: 'auto', flexShrink: 0 }}
          onClick={() => setAjuste({ producto: null })}
        >
          <ArrowUpDown /> Ajustar stock
        </button>
      </header>

      {/* ── Segmentado: la cola (operativa) o la auditoría ─────────────────── */}
      <div className="duna-seg" role="group" aria-label="Vista de inventario" style={{ marginBottom: 'var(--duna-space-5)' }}>
        <button type="button" aria-pressed={vista === 'cola'}
                className={`duna-seg__item${vista === 'cola' ? ' is-on' : ''}`}
                onClick={() => setVista('cola')}>
          Reposición
        </button>
        <button type="button" aria-pressed={vista === 'auditoria'}
                className={`duna-seg__item${vista === 'auditoria' ? ' is-on' : ''}`}
                onClick={() => setVista('auditoria')}>
          Auditoría
        </button>
      </div>

      {error && <div className="duna-note" role="alert">{error}</div>}

      {/* ═══ COLA DE REPOSICIÓN ══════════════════════════════════════════════ */}
      {vista === 'cola' && (
        <>
          {/* Valor del inventario — estado vigente, con su descargo. */}
          <div style={{ marginBottom: 'var(--duna-space-5)' }}>
            <div className="duna-stat" style={{ display: 'inline-block' }}>
              <div className="duna-stat__v duna-num">{cargando ? '—' : formatCOP(valorTotal)}</div>
              <div className="duna-stat__l">Valor del inventario</div>
            </div>
            <p className="duna-caption" style={{ margin: 'var(--duna-space-2) 0 0' }}>
              Valuación estimada con el costo actual del catálogo, no contable.
            </p>
          </div>

          {/* Carriles · las dos son COLA, las dos llevan número (§ lib/carriles). */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-2)', marginBottom: 'var(--duna-space-5)' }}>
            {CARRILES_INVENTARIO.map(c => (
              <button
                key={c.key}
                type="button"
                className={`duna-pill${carril === c.key ? ' is-on' : ''}`}
                aria-pressed={carril === c.key}
                onClick={() => navegar(c.key === CARRIL_INVENTARIO_DEFAULT ? null : c.key)}
              >
                {c.label}
                {cuentas[c.key] !== undefined && (
                  <span className="duna-mono" style={{ marginLeft: 'var(--duna-space-inline)' }}>{cuentas[c.key]}</span>
                )}
              </button>
            ))}
          </div>

          {cargando && <SkeletonOrderCards label="Cargando el inventario…" />}

          {!cargando && enCola.length === 0 && (
            <div className="duna-card duna-card__pad">
              {/* Cola vacía = buena noticia, y se dice: es la respuesta a "¿qué
                  repongo hoy?" — nada. */}
              <p className="duna-sub" style={{ margin: 0 }}>
                {carril === 'agotados' ? 'Ningún producto agotado.' : 'Nada por reponer — el stock está sobre el mínimo.'}
              </p>
            </div>
          )}

          {!cargando && enCola.length > 0 && (
            <div className="duna-split__list">
              {enCola.map(p => (
                <OrderCard
                  key={p.id}
                  title={p.nombre}
                  id={p.sku ?? undefined}
                  // El stock es el número prominente de la fila; el mínimo, su
                  // contexto. Es la pregunta de reposición, no el precio.
                  amount={String(p.stock)}
                  media={<Miniatura producto={p} />}
                  channel={<span className={`${claseStock(p)} duna-caption`}>mín. {p.stock_minimo ?? 5}</span>}
                  status={badgeStock(p)}
                  steps={undefined}
                  // Click = reponer ESTE: abre Ajustar Stock pre-llenado. La acción
                  // vive en el producto (§ frontera), y el modal es la puerta de
                  // inventario, agnóstico y pre-llenable.
                  onClick={() => setAjuste({ producto: p })}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══ AUDITORÍA · el kardex completo ══════════════════════════════════ */}
      {vista === 'auditoria' && (
        <>
          {cargando && <p className="duna-sub">Cargando los movimientos…</p>}
          {!cargando && logs.length === 0 && (
            <div className="duna-card duna-card__pad">
              <p className="duna-sub" style={{ margin: 0 }}>Sin movimientos registrados.</p>
            </div>
          )}
          {!cargando && logs.length > 0 && (
            <DunaTable columns={columnasKardex} rows={filasKardex} minWidth="48rem" />
          )}
        </>
      )}

      {/* EL MISMO modal agnóstico: con `producto` pre-llena, sin él muestra el
          selector. Reusado tal cual (precedente ScheduleDeliveryModal). */}
      <AdjustStockModal
        open={!!ajuste}
        producto={ajuste?.producto ?? null}
        productos={productos}
        onOpenChange={(o) => { if (!o) setAjuste(null); }}
        onAplicado={aplicado}
      />
    </div>
  );
}

/** La miniatura de una fila: el marco del sistema, con el reemplazo del consumidor. */
function Miniatura({ producto }: { producto: Product }) {
  return (
    <div className="duna-tile duna-tile--sm">
      {producto.imagen
        ? <Image src={producto.imagen} alt="" fill sizes="44px" style={{ objectFit: 'cover' }} />
        : <Package aria-hidden="true" width={17} height={17} />}
    </div>
  );
}
