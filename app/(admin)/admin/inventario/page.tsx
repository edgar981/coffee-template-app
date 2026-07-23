'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, TrendingDown, TrendingUp, Warehouse, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { getProducts, getInventoryLogs, adjustInventory } from '@/lib/api/inventory';
import type { InventoryLog, InventoryAdjustmentForm, InventoryMovementType } from '@/types/inventory';
import { Product } from '@/types/product';
import { formatCOP } from '@/lib/utils';

type Tab = 'stock' | 'movimientos';

const tipoConfig: Record<InventoryMovementType, { label: string; color: string; bg: string }> = {
  entrada:    { label: 'Entrada',    color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  salida:     { label: 'Salida',     color: 'text-red-600',     bg: 'bg-red-50 dark:bg-red-900/20' },
  ajuste:     { label: 'Ajuste',     color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-900/20' },
  venta:      { label: 'Venta',      color: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-900/20' },
  devolucion: { label: 'Devolución', color: 'text-violet-600',  bg: 'bg-violet-50 dark:bg-violet-900/20' },
};

const EMPTY_FORM: InventoryAdjustmentForm = {
  producto_id: '',
  tipo: 'ajuste',
  cantidad: '',
  motivo: '',
};

export default function Inventario() {
  const [productos, setProductos] = useState<Product[]>([]);
  const [logs, setLogs]           = useState<InventoryLog[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showAdj, setShowAdj]     = useState(false);
  const [adjForm, setAdjForm]     = useState<InventoryAdjustmentForm>(EMPTY_FORM);
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
  const lowStock       = activeProducts.filter(p => p.stock <= (p.stock_minimo ?? 5));
  const outOfStock     = activeProducts.filter(p => p.stock === 0);
  const totalValue     = productos.reduce((sum, p) => sum + ((p.costo ?? 0) * p.stock), 0);

  const handleAdjust = async () => {
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
  };

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
        <div className="stat-card">
          <AlertTriangle className="w-5 h-5 text-amber-500 mb-3" />
          <p className="text-xl font-bold text-amber-600">{lowStock.length}</p>
          <p className="text-xs text-muted-foreground">Stock bajo mínimo</p>
        </div>
        <div className="stat-card">
          <TrendingDown className="w-5 h-5 text-red-500 mb-3" />
          <p className="text-xl font-bold text-red-600">{outOfStock.length}</p>
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
                  {activeProducts.map(p => {
                    const out = p.stock === 0;
                    const low = p.stock <= (p.stock_minimo ?? 5);
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
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Sin stock</span>
                          ) : low ? (
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit">
                              <AlertTriangle className="w-2.5 h-2.5" /> Stock bajo
                            </span>
                          ) : (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">OK</span>
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
                          {new Date(l.createdAt).toLocaleDateString('es-CO')}
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
      <Dialog open={showAdj} onOpenChange={setShowAdj}>
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
            <Button variant="outline" onClick={() => setShowAdj(false)}>Cancelar</Button>
            <Button onClick={handleAdjust} disabled={!adjForm.producto_id || !adjForm.cantidad}>
              Aplicar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}