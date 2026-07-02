'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Package, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { getProducts, createProduct, updateProduct, deleteProduct } from '@/lib/api/products';
import type { Product, ProductCategory, ProductForm, RoastLevel } from '@/types/product';
import { CATEGORIAS, EMPTY_PRODUCT_FORM, TOSTADOS } from '@/constants/product';
import { formatCOP } from '@/lib/utils';

// ─── Constants ───────────────────────────────────────────────────────────────

type ViewMode = 'grid' | 'table';

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Productos() {
  const [productos, setProductos] = useState<Product[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [catFilter, setCatFilter] = useState<ProductCategory | 'all'>('all');
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<Product | null>(null);
  const [form, setForm]           = useState<ProductForm>(EMPTY_PRODUCT_FORM);
  const [view, setView]           = useState<ViewMode>('grid');

  const load = async () => {
    setLoading(true);
    const data = await getProducts();
    setProductos(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = productos.filter(p => {
    const matchSearch = p.nombre.toLowerCase().includes(search.toLowerCase())
      || p.sku?.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === 'all' || p.categoria === catFilter;
    return matchSearch && matchCat;
  });

  const openNew  = () => { setEditing(null); setForm(EMPTY_PRODUCT_FORM); setShowForm(true); };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      nombre:      p.nombre,
      descripcion: p.descripcion,
      categoria:   p.categoria,
      precio:      String(p.precio),
      costo:       String(p.costo),
      sku:         p.sku,
      stock:       String(p.stock),
      stock_minimo: String(p.stock_minimo ?? 5),
      activo:      p.activo,
      peso_gramos: String(p.peso_gramos ?? ''),
      variante:    p.variante ?? '',
      origen:      p.origen ?? '',
      tostado:     p.tostado ?? '',
      slug:        p.slug,
      imagen:      p.imagen ?? '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.categoria) { toast.error('Selecciona una categoría'); return; }

    const data = {
      nombre:      form.nombre,
      descripcion: form.descripcion,
      categoria:   form.categoria as ProductCategory,
      precio:      Number(form.precio),
      costo:       Number(form.costo),
      sku:         form.sku,
      stock:       Number(form.stock),
      stock_minimo: Number(form.stock_minimo),
      activo:      form.activo,
      peso_gramos: form.peso_gramos ? Number(form.peso_gramos) : undefined,
      variante:    form.variante   || undefined,
      origen:      form.origen     || undefined,
      tostado:     (form.tostado   || undefined) as RoastLevel | undefined,
      slug:        form.slug,
      imagen:      form.imagen,
      imagenes:    editing?.imagenes ?? [],
    };

    if (editing) {
      const updated = await updateProduct(editing.id, data);
      setProductos(prev => prev.map(p => p.id === editing.id ? updated : p));
      toast.success('Producto actualizado');
    } else {
      const created = await createProduct(data);
      setProductos(prev => [created, ...prev]);
      toast.success('Producto creado');
    }

    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este producto?')) return;
    await deleteProduct(id);
    setProductos(prev => prev.filter(p => p.id !== id));
    toast.success('Producto eliminado');
  };

  const field = <K extends keyof ProductForm>(key: K) => ({
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value })),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Productos</h1>
          <p className="text-sm text-muted-foreground">{productos.length} productos en catálogo</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" /> Nuevo Producto
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o SKU..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={catFilter} onValueChange={v => setCatFilter(v as ProductCategory | 'all')}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Categoría" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {(Object.entries(CATEGORIAS) as [ProductCategory, string][]).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex border border-border rounded-lg overflow-hidden">
          {(['grid', 'table'] as ViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-2 text-xs ${view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            >
              {v === 'grid' ? 'Cuadrícula' : 'Tabla'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando productos...</div>
      ) : filtered.length === 0 ? (
        <EmptyState onNew={openNew} />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(p => (
            <ProductCard key={p.id} product={p} onEdit={openEdit} onDelete={handleDelete} />
          ))}
        </div>
      ) : (
        <ProductTable productos={filtered} onEdit={openEdit} onDelete={handleDelete} />
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2">
              <Label>Nombre *</Label>
              <Input {...field('nombre')} className="mt-1" placeholder="Ej: Café Sierra 250g" />
            </div>
            <div>
              <Label>Categoría *</Label>
              <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v as ProductCategory }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(CATEGORIAS) as [ProductCategory, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>SKU</Label>
              <Input {...field('sku')} className="mt-1" placeholder="SN-001" />
            </div>
            <div>
              <Label>Precio de Venta *</Label>
              <Input type="number" {...field('precio')} className="mt-1" placeholder="85000" />
            </div>
            <div>
              <Label>Costo</Label>
              <Input type="number" {...field('costo')} className="mt-1" placeholder="35000" />
            </div>
            <div>
              <Label>Stock Actual</Label>
              <Input type="number" {...field('stock')} className="mt-1" placeholder="50" />
            </div>
            <div>
              <Label>Stock Mínimo</Label>
              <Input type="number" {...field('stock_minimo')} className="mt-1" placeholder="10" />
            </div>
            <div>
              <Label>Variante</Label>
              <Input {...field('variante')} className="mt-1" placeholder="250g, 500g, etc." />
            </div>
            <div>
              <Label>Origen</Label>
              <Input {...field('origen')} className="mt-1" placeholder="Huila, Nariño..." />
            </div>
            <div>
              <Label>Nivel de Tostado</Label>
              <Select value={form.tostado} onValueChange={v => setForm(f => ({ ...f, tostado: v as RoastLevel }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(TOSTADOS) as [RoastLevel, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Peso (gramos)</Label>
              <Input type="number" {...field('peso_gramos')} className="mt-1" placeholder="250" />
            </div>
            <div className="col-span-2">
              <Label>Descripción</Label>
              <textarea
                {...field('descripcion')}
                className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background min-h-20 resize-none"
                placeholder="Descripción del producto..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.nombre || !form.categoria || !form.precio}>
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ProductCardProps {
  product:  Product;
  onEdit:   (p: Product) => void;
  onDelete: (id: string) => void;
}

function ProductCard({ product: p, onEdit, onDelete }: ProductCardProps) {
  const lowStock = p.stock <= (p.stock_minimo ?? 5);
  const margin   = p.precio && p.costo
    ? Math.round(((p.precio - p.costo) / p.precio) * 100)
    : null;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-all group">
      <div className="h-36 bg-linear-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 flex items-center justify-center relative">
        <Package className="w-12 h-12 text-amber-300" />
        {lowStock && (
          <span className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Stock bajo
          </span>
        )}
        {!p.activo && (
          <span className="absolute top-2 left-2 bg-gray-500 text-white text-xs px-2 py-0.5 rounded-full">
            Inactivo
          </span>
        )}
      </div>
      <div className="p-4">
        <p className="font-semibold text-sm leading-tight">{p.nombre}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{p.sku || 'Sin SKU'} • {p.variante ?? '—'}</p>
        <div className="flex items-center justify-between mt-3">
          <span className="text-lg font-bold text-primary">{formatCOP(p.precio)}</span>
          {margin !== null && (
            <span className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded">
              {margin}% margen
            </span>
          )}
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>Stock: <strong className={lowStock ? 'text-red-500' : 'text-foreground'}>{p.stock}</strong></span>
          <span className="capitalize">{p.categoria.replace('_', ' ')}</span>
        </div>
        <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => onEdit(p)}>
            <Edit2 className="w-3 h-3 mr-1" /> Editar
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => onDelete(p.id)}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ProductTableProps {
  productos: Product[];
  onEdit:    (p: Product) => void;
  onDelete:  (id: string) => void;
}

function ProductTable({ productos, onEdit, onDelete }: ProductTableProps) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {['Producto', 'SKU', 'Categoría', 'Precio', 'Costo', 'Stock', 'Estado', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {productos.map(p => {
              const lowStock = p.stock <= (p.stock_minimo ?? 5);
              return (
                <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <p className="font-medium">{p.nombre}</p>
                    {p.variante && <p className="text-xs text-muted-foreground">{p.variante}</p>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.sku || '—'}</td>
                  <td className="px-4 py-3 text-xs capitalize">{p.categoria.replace('_', ' ')}</td>
                  <td className="px-4 py-3 font-semibold">{formatCOP(p.precio)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatCOP(p.costo)}</td>
                  <td className="px-4 py-3">
                    <span className={lowStock ? 'text-red-500 font-semibold' : ''}>{p.stock}</span>
                    {lowStock && <AlertTriangle className="w-3 h-3 text-red-500 inline ml-1" />}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      p.activo
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onEdit(p)}>
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => onDelete(p.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mb-4">
        <Package className="w-8 h-8 text-amber-400" />
      </div>
      <h3 className="font-semibold text-lg mb-2">Sin productos aún</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        Agrega tu primer producto al catálogo para empezar a gestionar tu inventario.
      </p>
      <Button onClick={onNew} className="gap-2"><Plus className="w-4 h-4" /> Agregar Producto</Button>
    </div>
  );
}