'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, TrendingDown, TrendingUp, Warehouse, ArrowUpDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useAccionGuardada } from '@/hooks/useAccionGuardada';
import { getProducts, getInventoryLogs, adjustInventory } from '@/lib/api/inventory';
import type { InventoryLog, InventoryAdjustmentForm, InventoryMovementType } from '@/types/inventory';
import { Product } from '@/types/product';
import { formatCOP } from '@/lib/utils';
import { formatFecha } from '@/lib/format-fecha';
import { isLowStock, LOW_STOCK_VALUE } from '@/lib/metrics/inventory-filters';
import { statCardLink } from '@/components/admin/StatCard';

type Tab = 'stock' | 'movimientos';

// Movement type collapses to the ONE piece of information it carries: direction
// of stock. Green = stock in (entrada/devolución), red = stock out (salida/venta),
// neutral = ajuste. No per-type decorative hues.
const tipoConfig: Record<InventoryMovementType, { label: string; color: string; bg: string }> = {
  entrada:    { label: 'Entrada',    color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
  salida:     { label: 'Salida',     color: 'text-red-600 dark:text-red-400',     bg: 'bg-red-50 dark:bg-red-900/20' },
  ajuste:     { label: 'Ajuste',     color: 'text-muted-foreground',              bg: 'bg-muted' },
  venta:      { label: 'Venta',      color: 'text-red-600 dark:text-red-400',     bg: 'bg-red-50 dark:bg-red-900/20' },
  devolucion: { label: 'Devolución', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
};

const EMPTY_FORM: InventoryAdjustmentForm = {
  producto_id: '',
  tipo: 'ajuste',
  cantidad: '',
  motivo: '',
};

// useSearchParams() needs a Suspense boundary (same pattern as Órdenes).
export default function Inventario() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Cargando...</div>}>
      <InventarioInner />
    </Suspense>
  );
}

function InventarioInner() {
  const searchParams = useSearchParams();
  // `?stock=bajo-minimo` (from the dashboard "Alertas de Stock" card) filters the
  // stock table to exactly the low-stock rows, via the SAME `isLowStock` the card
  // counts with — so card number = filtered row count.
  const lowStockOnly = searchParams.get('stock') === LOW_STOCK_VALUE;

  const [productos, setProductos] = useState<Product[]>([]);
  const [logs, setLogs]           = useState<InventoryLog[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showAdj, setShowAdj]     = useState(false);
  const [adjForm, setAdjForm]     = useState<InventoryAdjustmentForm>(EMPTY_FORM);
  // Las dos mitades de la guarda, en una primitiva (ver CLAUDE.md § Doble-submit).
  const ajuste = useAccionGuardada();
  const aplicando = ajuste.enVuelo;
  const [tab, setTab]             = useState<Tab>('stock');

  const load = async () => {
    setLoading(true);
    const [p, l] = await Promise.all([getProducts(), getInventoryLogs()]);
    setProductos(p);
    setLogs(l);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const activeProducts = productos.filter(p => p.activo !== false);
  const lowStock       = activeProducts.filter(isLowStock);
  const outOfStock     = activeProducts.filter(p => p.stock === 0);
  const totalValue     = productos.reduce((sum, p) => sum + ((p.costo ?? 0) * p.stock), 0);
  // Rows shown in the stock table — narrowed to low-stock when the URL asks.
  const stockRows      = lowStockOnly ? lowStock : activeProducts;
  // El filtro solo recorta lo que se ve en la pestaña de stock: la tarjeta se
  // marca y el chip aparece bajo la MISMA condición, para que "marcada" siempre
  // signifique "esto es lo que estás viendo".
  const filtroActivo   = lowStockOnly && tab === 'stock';

  const handleAdjust = () => ajuste.ejecutar(async () => {
    const prod = productos.find(p => p.id === adjForm.producto_id);
    if (!prod || !adjForm.cantidad) return;

    try {
      const { product: updatedProduct, log } = await adjustInventory(adjForm);

      // Update both products and logs with real data from DB
      setProductos(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
      setLogs(prev => [log, ...prev]);

      toast.success('Inventario actualizado');
      setShowAdj(false);
      setAdjForm(EMPTY_FORM);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al ajustar el inventario');
    }
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventario</h1>
          <p className="text-sm text-muted-foreground">Control de stock en tiempo real</p>
        </div>
        <Button onClick={() => setShowAdj(true)} className="gap-2">
          <ArrowUpDown className="w-4 h-4" /> Ajustar Stock
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <Warehouse className="w-5 h-5 text-primary mb-3" />
          <p className="text-xl font-bold">{productos.length}</p>
          <p className="text-xs text-muted-foreground">Productos en sistema</p>
        </div>
        {/* Navega a la MISMA lista filtrada que la card del dashboard, con el
            mismo `?stock=bajo-minimo` y contando con el mismo `isLowStock`
            compartido — card y lista no pueden divergir. Cuando el filtro ya
            está aplicado la tarjeta se marca (borde de primario + tinte), misma
            condición que el chip "Filtrado" de abajo. */}
        <Link
          href={`/admin/inventario?stock=${LOW_STOCK_VALUE}`}
          aria-current={filtroActivo ? 'true' : undefined}
          className={`stat-card ${statCardLink(filtroActivo)}`}
        >
          {/* El color es alerta, y una alerta de cero no existe: con 0 productos
              bajo mínimo la tarjeta va neutra y solo se tiñe cuando hay algo que
              atender. Mismo criterio que "Sin stock" al lado. */}
          <AlertTriangle className={`w-5 h-5 mb-3 ${lowStock.length > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
          <p className={`text-xl font-bold ${lowStock.length > 0 ? 'text-amber-600' : ''}`}>{lowStock.length}</p>
          <p className="text-xs text-muted-foreground">Stock bajo mínimo</p>
        </Link>
        <div className="stat-card">
          {/* Rojo = alerta REAL. "Sin stock: 0" es el estado bueno de la tienda;
              pintarlo de rojo entrena al operador a ignorar el rojo. */}
          <TrendingDown className={`w-5 h-5 mb-3 ${outOfStock.length > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
          <p className={`text-xl font-bold ${outOfStock.length > 0 ? 'text-red-600' : ''}`}>{outOfStock.length}</p>
          <p className="text-xs text-muted-foreground">Sin stock</p>
        </div>
        <div className="stat-card">
          <TrendingUp className="w-5 h-5 text-emerald-500 mb-3" />
          <p className="text-xl font-bold">{formatCOP(totalValue)}</p>
          <p className="text-xs text-muted-foreground">Valor del inventario</p>
        </div>
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
              {lowStock.length} productos con stock bajo
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStock.map(p => (
              <div key={p.id} className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-xs px-2.5 py-1 rounded-full">
                {p.nombre} — <strong>{p.stock}</strong> / mín. {p.stock_minimo ?? 5}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active low-stock filter (arrived from the dashboard card) — a clear chip
          so it's obvious the table is narrowed, with one click back to all rows. */}
      {filtroActivo && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1 text-xs font-medium text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-3 h-3" /> Filtrado: stock bajo mínimo ({lowStock.length})
          </span>
          <Link href="/admin/inventario" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <X className="w-3 h-3" /> Quitar filtro
          </Link>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border gap-4">
        {(['stock', 'movimientos'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'stock' ? 'Stock Actual' : 'Movimientos'}
          </button>
        ))}
      </div>

      {/* Stock table */}
      {tab === 'stock' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Cargando...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {['Producto', 'SKU', 'Categoría', 'Stock Actual', 'Stock Mínimo', 'Valor Stock', 'Estado'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stockRows.map(p => {
                    const out = p.stock === 0;
                    const low = isLowStock(p);
                    return (
                      <tr key={p.id} className={`border-b border-border/50 hover:bg-muted/20 ${out ? 'opacity-60' : ''}`}>
                        <td className="px-4 py-3 font-medium">{p.nombre}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.sku ?? '—'}</td>
                        <td className="px-4 py-3 text-xs capitalize">{p.categoria?.replace('_', ' ')}</td>
                        <td className="px-4 py-3">
                          <span className={`font-bold ${out ? 'text-red-500' : low ? 'text-amber-600' : 'text-foreground'}`}>
                            {p.stock}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{p.stock_minimo ?? 5}</td>
                        <td className="px-4 py-3">{formatCOP((p.costo ?? 0) * p.stock)}</td>
                        <td className="px-4 py-3">
                          {out ? (
                            <span className="text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 px-2 py-0.5 rounded-full">Sin stock</span>
                          ) : low ? (
                            <span className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit">
                              <AlertTriangle className="w-2.5 h-2.5" /> Stock bajo
                            </span>
                          ) : (
                            <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 px-2 py-0.5 rounded-full">OK</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Logs table */}
      {tab === 'movimientos' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Sin movimientos registrados.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {['Producto', 'Tipo', 'Cantidad', 'Stock Anterior', 'Stock Nuevo', 'Motivo', 'Fecha'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map(l => {
                    const tc = tipoConfig[l.tipo];
                    return (
                      <tr key={l.id} className="border-b border-border/50 hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">{l.producto_nombre}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tc.bg} ${tc.color}`}>
                            {tc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold">{l.cantidad}</td>
                        <td className="px-4 py-3 text-muted-foreground">{l.stock_anterior}</td>
                        <td className="px-4 py-3">{l.stock_nuevo}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{l.motivo ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {formatFecha(l.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Adjust Dialog */}
      {/* En vuelo el modal no se cierra por click-fuera ni por Esc: son las otras
          dos formas de "salir" mientras la mutación viaja, y dejan al operador
          sin saber si se aplicó. Mismo criterio que ConfirmDeleteDialog. */}
      <Dialog open={showAdj} onOpenChange={(o) => { if (!aplicando) setShowAdj(o); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajustar Inventario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Producto</Label>
              <Select
                value={adjForm.producto_id}
                onValueChange={v => setAdjForm(f => ({ ...f, producto_id: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Seleccionar producto" />
                </SelectTrigger>
                <SelectContent>
                  {productos.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre} (stock: {p.stock})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de Movimiento</Label>
              <Select
                value={adjForm.tipo}
                onValueChange={v => setAdjForm(f => ({ ...f, tipo: v as InventoryMovementType }))}
              >
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada (sumar)</SelectItem>
                  <SelectItem value="salida">Salida (restar)</SelectItem>
                  <SelectItem value="ajuste">Ajuste (fijar cantidad)</SelectItem>
                  <SelectItem value="devolucion">Devolución</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cantidad</Label>
              <Input
                type="number"
                value={adjForm.cantidad}
                onChange={e => setAdjForm(f => ({ ...f, cantidad: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Motivo</Label>
              <Input
                value={adjForm.motivo}
                onChange={e => setAdjForm(f => ({ ...f, motivo: e.target.value }))}
                className="mt-1"
                placeholder="Ej: Compra a proveedor"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            {/* Cancelar también se bloquea en vuelo: cerrar el modal a mitad del
                ajuste no cancela nada en el server y deja al operador sin saber
                si se aplicó. */}
            <Button variant="outline" onClick={() => setShowAdj(false)} disabled={aplicando}>
              Cancelar
            </Button>
            <Button
              onClick={handleAdjust}
              disabled={aplicando || !adjForm.producto_id || !adjForm.cantidad}
            >
              {aplicando ? 'Aplicando…' : 'Aplicar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}