'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { ArrowUpDown } from 'lucide-react';
import { DunaTable, type DunaColumn } from '@duna/design-system/components/DunaTable';
import { DateRangePicker } from '@/components/admin/DateRangePicker';
import { formatCOP } from '@duna/core/utils';
import { formatFecha } from '@duna/core/format-fecha';
import { toast } from 'sonner';
import { getProducts, getInventoryLogs } from '@/lib/api/inventory';
import { KARDEX_TOPE } from '@duna/core/metrics/inventory-filters';
import { AdjustStockModal } from '@/components/admin/AdjustStockModal';
import type { Product } from '@/types/product';
import type { InventoryLog, InventoryMovementType } from '@/types/inventory';

// ═══ INVENTARIO · la vista de AUDITORÍA del stock ═════════════════════════════
//
// Responde la pregunta que NINGUNA pantalla de producto puede: "¿qué pasó con el
// stock, y quién ajustó qué?". El detalle de un producto muestra el kardex de UN
// producto; recorrer el catálogo producto por producto no reconstruye la historia
// del inventario. Eso —el kardex COMPLETO con su actor— es lo único que sólo esta
// pantalla puede dar.
//
// ── POR QUÉ SE ENCOGIÓ (decisión del owner) ─────────────────────────────────
//
// Tuvo una cola de reposición con carriles (Por reponer / Agotados) y un
// segmentado. Se quitó: la cola es la MISMA pregunta que el carril "Por reponer"
// de Productos, con la MISMA fuente (`isLowStock`). Verla en dos sitios es lo que
// hacía que la pantalla se sintiera de más. La reposición vive en el carril de
// Productos; Inventario es la vista de auditoría.
//
// DISPARADOR: si con uso real el operador busca reponer EN Inventario y no en el
// carril de Productos, la cola se mueve acá —con su dato—, igual que el punto sol
// pertenece a donde se RESUELVE el hecho, no a donde se lista.
//
// ── UNA AUDITORÍA ES DE LECTURA · sus dos ayudas ────────────────────────────
//
// No se "actúa" sobre un movimiento (el asiento ES un hecho pasado). Las dos cosas
// que la hacen usable son de lectura:
//   · NAVEGAR: clic en el producto de un movimiento → su detalle en Productos, que
//     responde "¿cómo está AHORA?". El detalle ya muestra el kardex de esa ficha.
//   · FILTRAR: por producto, tipo y rango de fechas, SERVER-SIDE — sin ellos, a los
//     tres meses es una lista infinita. Server-side y no en el cliente porque el
//     kardex tiene tope: filtrar la ventana cargada mentiría más allá de la fila
//     200 (ver `logsDeInventario`). Los filtros viven en la URL: una auditoría
//     filtrada se comparte y sobrevive a un refresh.
//
// Vive en `/admin/inventario-v2` mientras convive con la vieja; heredará la ruta
// al retirarse aquélla, con su redirect.

// El TIPO de movimiento va NEUTRO — Amber Minimal: el rojo es alerta, y una salida
// o una venta son operación normal. La DIRECCIÓN la carga el signo de la cantidad.
const TIPO_LABEL: Record<InventoryMovementType, string> = {
  entrada: 'Entrada', salida: 'Salida', ajuste: 'Ajuste', venta: 'Venta', devolucion: 'Devolución',
};
const TIPOS: InventoryMovementType[] = ['entrada', 'salida', 'ajuste', 'venta', 'devolucion'];

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

  const [productos, setProductos]     = useState<Product[]>([]);
  const [logs, setLogs]               = useState<InventoryLog[]>([]);
  const [cargandoProd, setCargandoProd] = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [showAdj, setShowAdj]         = useState(false);
  // Se bumpea al aplicar un ajuste, para RE-PEDIR el kardex respetando los filtros
  // en vez de anteponer una fila que quizá no matchea el filtro puesto.
  const [nonce, setNonce]             = useState(0);

  // Los filtros viven en la URL (linkables, sobreviven a un refresh).
  const fProducto = params.get('producto') ?? '';
  const fTipo     = params.get('tipo') ?? '';
  const desde     = params.get('desde');
  const hasta     = params.get('hasta');
  const hayFiltro = !!(fProducto || fTipo || desde || hasta);

  // `cargando` DERIVADO, no seteado en el effect (§ Analítica, y el lint lo marca):
  // un `setLoading(true)` síncrono dentro del effect dispara renders en cascada.
  // La clave describe el filtro pedido; los logs cargados guardan la suya, y
  // "cargando" es simplemente que todavía no coinciden.
  const filtroKey = `${fProducto}|${fTipo}|${desde ?? ''}|${hasta ?? ''}|${nonce}`;
  const [logsKey, setLogsKey] = useState<string | null>(null);
  const cargandoLogs = logsKey !== filtroKey;

  // Los productos se cargan UNA vez: alimentan el valor total, el selector del
  // modal, el selector de filtro y la existencia del enlace de cada fila.
  useEffect(() => {
    let vivo = true;
    getProducts()
      .then(p => { if (vivo) setProductos(p); })
      .catch(e => { if (vivo) setError(e instanceof Error ? e.message : 'Error al cargar productos'); })
      .finally(() => { if (vivo) setCargandoProd(false); });
    return () => { vivo = false; };
  }, []);

  // El kardex se re-pide cada vez que cambia un filtro — SERVER-SIDE, para que el
  // resultado sea verdad sobre toda la historia y no sólo sobre la ventana cargada.
  // Al resolver (o fallar) sella `logsKey` con el filtro pedido, que es lo que
  // apaga el "cargando" derivado — sin un setState de loading en el cuerpo.
  useEffect(() => {
    let vivo = true;
    getInventoryLogs({
      producto: fProducto || undefined,
      tipo:     fTipo || undefined,
      desde:    desde || undefined,
      hasta:    hasta || undefined,
    })
      .then(l => { if (vivo) { setLogs(l); setError(null); } })
      .catch(e => { if (vivo) setError(e instanceof Error ? e.message : 'Error al cargar los movimientos'); })
      .finally(() => { if (vivo) setLogsKey(filtroKey); });
    return () => { vivo = false; };
  }, [filtroKey, fProducto, fTipo, desde, hasta]);

  const valorTotal = useMemo(
    () => productos.reduce((s, p) => s + ((p.costo ?? 0) * p.stock), 0),
    [productos],
  );
  // Qué producto_id todavía existe — decide si la celda "Producto" es un enlace o
  // texto plano. Un producto borrado dejaría un enlace muerto; no se pinta.
  const idsProducto = useMemo(() => new Set(productos.map(p => p.id)), [productos]);

  const aplicado = useCallback(({ product }: { product: Product; log: InventoryLog }) => {
    setProductos(prev => prev.map(p => p.id === product.id ? product : p));
    setNonce(n => n + 1);   // re-pide el kardex respetando el filtro puesto
    toast.success('Inventario actualizado');
  }, []);

  const navegar = useCallback((cambios: Record<string, string | null>) => {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(cambios)) {
      if (v === null) q.delete(k); else q.set(k, v);
    }
    const s = q.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }, [params, pathname, router]);

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
      // Enlace al detalle del producto SÓLO si el producto todavía existe. La
      // pregunta natural al leer un movimiento raro: "¿cómo está AHORA?".
      idsProducto.has(l.producto_id)
        ? <Link key="p" href={`/admin/productos?producto=${l.producto_id}`} className="duna-link">{l.producto_nombre}</Link>
        : l.producto_nombre,
      <span key="t" className="duna-badge duna-badge--neutral">{TIPO_LABEL[l.tipo] ?? l.tipo}</span>,
      <span key="c" className="duna-num">{signoDelMovimiento(l)}</span>,
      <span key="s" className="duna-num">{l.stock_anterior} → {l.stock_nuevo}</span>,
      // El MOTIVO sigue siendo el texto legible; el enlace sale del DATO
      // (`orden_numero` resuelto por el servidor), no de parsear "CN-…" del texto.
      // Sólo enlaza si la orden todavía existe; si no, texto plano (misma regla que
      // la celda Producto).
      l.orden_numero
        ? <Link key="m" href={`/admin/pedidos?pedido=${l.orden_numero}`} className="duna-link">{l.motivo || '—'}</Link>
        : (l.motivo || '—'),
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
        <div style={{ minWidth: 0 }}>
          <h1 className="duna-display-m">Inventario</h1>
          <p className="duna-sub" style={{ margin: 'var(--duna-space-hairline) 0 0' }}>
            Historial de movimientos de stock — quién ajustó qué, y cuándo.
          </p>
        </div>
        <button
          type="button"
          className="duna-btn duna-btn--primary"
          style={{ marginLeft: 'auto', flexShrink: 0 }}
          onClick={() => setShowAdj(true)}
        >
          <ArrowUpDown /> Ajustar stock
        </button>
      </header>

      {error && <div className="duna-note" role="alert">{error}</div>}

      {/* ── Valor del inventario — estado vigente, con su descargo ──────────── */}
      <div style={{ marginBottom: 'var(--duna-space-6)' }}>
        <div className="duna-stat" style={{ display: 'inline-block' }}>
          <div className="duna-stat__v duna-num">{cargandoProd ? '—' : formatCOP(valorTotal)}</div>
          <div className="duna-stat__l">Valor del inventario</div>
        </div>
        <p className="duna-caption" style={{ margin: 'var(--duna-space-2) 0 0' }}>
          Valuación estimada con el costo actual del catálogo, no contable.
        </p>
      </div>

      {/* ── El kardex completo · la vista de auditoría ─────────────────────── */}
      <div className="duna-eyebrow" style={{ marginBottom: 'var(--duna-space-3)' }}>Movimientos</div>

      {/* Filtros de la auditoría · nativos (selects) + el DateRangePicker del panel. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-2)', alignItems: 'center', marginBottom: 'var(--duna-space-4)' }}>
        {/* No elegir SÍ es válido —"todos"— así que el vacío es opción de verdad,
            sin `disabled hidden`. */}
        <select className="duna-input duna-select duna-input--sm" style={{ width: 'auto' }}
                aria-label="Filtrar por producto" value={fProducto}
                onChange={e => navegar({ producto: e.target.value || null })}>
          <option value="">Todos los productos</option>
          {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <select className="duna-input duna-select duna-input--sm" style={{ width: 'auto' }}
                aria-label="Filtrar por tipo de movimiento" value={fTipo}
                onChange={e => navegar({ tipo: e.target.value || null })}>
          <option value="">Todos los tipos</option>
          {TIPOS.map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
        </select>
        <DateRangePicker desde={desde} hasta={hasta} onChange={(d, h) => navegar({ desde: d, hasta: h })} />
        {hayFiltro && (
          <button type="button" className="duna-btn duna-btn--ghost duna-btn--sm"
                  onClick={() => navegar({ producto: null, tipo: null, desde: null, hasta: null })}>
            Quitar filtros
          </button>
        )}
      </div>

      {cargandoLogs && <p className="duna-sub" style={{ margin: 0 }}>Cargando los movimientos…</p>}
      {!cargandoLogs && logs.length === 0 && (
        <div className="duna-card duna-card__pad">
          {/* Distinguir "no hay nada" de "el filtro no encontró nada" evita que el
              operador crea que perdió el historial. */}
          <p className="duna-sub" style={{ margin: 0 }}>
            {hayFiltro ? 'Ningún movimiento con estos filtros.' : 'Sin movimientos registrados.'}
          </p>
        </div>
      )}
      {!cargandoLogs && logs.length > 0 && (
        <DunaTable columns={columnasKardex} rows={filasKardex} minWidth="48rem" />
      )}
      {/* EL CORTE SE DECLARA, no se calla: cuando la ventana viene LLENA (=tope)
          puede haber más atrás, y una auditoría que muestra 200 sin decirlo miente
          por omisión. Apunta al rango de fechas, que es como se navega una
          auditoría —por tiempo, no por número de página—. (La paginación de fondo
          es decisión aparte; esto es el corte honesto mientras tanto.) */}
      {!cargandoLogs && logs.length === KARDEX_TOPE && (
        <p className="duna-caption" style={{ margin: 'var(--duna-space-3) 0 0' }}>
          Mostrando los {KARDEX_TOPE} movimientos más recientes. Acotá con el rango de fechas para ver otros.
        </p>
      )}

      {/* La puerta de operación de inventario: el modal agnóstico con selector de
          producto (sin pre-llenado — la reposición por producto vive en Productos). */}
      <AdjustStockModal
        open={showAdj}
        productos={productos}
        onOpenChange={setShowAdj}
        onAplicado={aplicado}
      />
    </div>
  );
}
