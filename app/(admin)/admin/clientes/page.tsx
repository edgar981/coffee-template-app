'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Search, Edit2, Trash2, Users, Star, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ConfirmDeleteDialog } from '@/components/admin/ConfirmDeleteDialog';
import { toast } from 'sonner';
import { useAccionGuardada } from '@/hooks/useAccionGuardada';
import { ErrorDialogo, useErrorDialogo } from '@/components/admin/ErrorDialogo';
import { formatCOP } from '@/lib/utils';
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from '@/lib/api/customers';
import type { Customer, CustomerForm } from '@/types/customer';
import type { OrderChannel } from '@/types/order';
import { CANALES, EMPTY_CUSTOMER_FORM } from '@/constants/customer';
import { STAT_CHIP } from '@/constants/stat-chip';
import { statCardLink } from '@/components/admin/StatCard';


// useSearchParams() needs a Suspense boundary (same pattern as Órdenes).
export default function Clientes() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Cargando...</div>}>
      <ClientesInner />
    </Suspense>
  );
}

function ClientesInner() {
  const [clientes, setClientes]   = useState<Customer[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<Customer | null>(null);
  const [form, setForm]           = useState<CustomerForm>(EMPTY_CUSTOMER_FORM);
  // Customer pending deletion (drives the shared confirm dialog). Only customers
  // with zero orders ever reach here — see the row action gate below.
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  // Guardado en curso. Este modal no tenía NINGÚN estado de progreso: el botón
  // seguía habilitado y diciendo "Guardar" durante toda la mutación, así que un
  // segundo clic disparaba una segunda creación.
  const [guardando, setGuardando] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  // `?recurrentes=1` (from the dashboard "Clientes Recurrentes" card) shows only
  // customers with more than one order — the SAME predicate the "Recurrentes"
  // stat counts with, so that stat = the filtered list length.
  const recurrentesOnly = searchParams.get('recurrentes') === '1';

  useEffect(() => {
    getCustomers().then(data => { setClientes(data); setLoading(false); });
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────

  const filtered = clientes.filter(c => {
    if (recurrentesOnly && (c.ordenes ?? 0) <= 1) return false;
    const q = search.toLowerCase();
    return (
      c.nombre?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.telefono?.includes(search)
    );
  });

  const topClientes = [...clientes]
    .sort((a, b) => (b.total_compras ?? 0) - (a.total_compras ?? 0))
    .slice(0, 5);

  const totalVentas  = clientes.reduce((sum, c) => sum + (c.total_compras ?? 0), 0);
  // Recurrente = más de UNA orden no cancelada (misma definición que "N órdenes").
  const recurrentes  = clientes.filter(c => (c.ordenes ?? 0) > 1).length;
  const tasaRecurr   = clientes.length
    ? `${Math.round((recurrentes / clientes.length) * 100)}%`
    : '0%';

  // ── Handlers ───────────────────────────────────────────────────────────────

  const openNew  = () => { setEditing(null); setForm(EMPTY_CUSTOMER_FORM); setShowForm(true); };
  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({
      nombre:    c.nombre,
      email:     c.email     ?? '',
      telefono:  c.telefono  ?? '',
      ciudad:    c.ciudad    ?? '',
      direccion: c.direccion ?? '',
      canal:     c.canal     ?? 'directo',
      notas:     c.notas     ?? '',
      activo:    c.activo,
    });
    setShowForm(true);
  };

  // El `if (guardando) return` de abajo era la mitad de ESTADO — depende de un
  // re-render, así que dos clicks del mismo tick lo leen `false` los dos. La
  // guarda síncrona es la que cierra esa ventana.
  const guarda = useAccionGuardada();
  const error = useErrorDialogo();
  const handleSave = () => guarda.ejecutar(async () => {
    error.limpiar();
    if (guardando) return;                  // clic repetido mientras ya se guarda
    if (!form.nombre) { toast.error('El nombre es requerido'); return; }

    // Cierre SOLO tras confirmación del server; si falla, el modal se queda
    // abierto con lo que el operador escribió. Antes no había try/catch: un
    // fallo rechazaba la promesa en silencio y el formulario quedaba mudo.
    setGuardando(true);
    try {
      if (editing) {
        const updated = await updateCustomer(editing.id, form);
        setClientes(prev => prev.map(c => c.id === editing.id ? updated : c));
        toast.success('Cliente actualizado');
      } else {
        const created = await createCustomer(form);
        setClientes(prev => [created, ...prev]);
        toast.success('Cliente creado');
      }
    } catch (e) {
      error.mostrar(e, 'No se pudo guardar el cliente');
      return;
    } finally {
      setGuardando(false);
    }

    setShowForm(false);
  });

  // The actual delete, run by the confirm dialog. Throws (server message) bubble
  // up to the dialog, which keeps itself open and toasts the error.
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteCustomer(deleteTarget.id);
    setClientes(prev => prev.filter(c => c.id !== deleteTarget.id));
  };

  const field = (key: keyof CustomerForm) => ({
    value:    form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value })),
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  // "Compras totales" = suma del dinero PAGADO (Payments) de todos los clientes —
  // dinero real, la misma fuente que el `$` de cada fila. (Ya no es el campo
  // semilla `total_compras`.)
  // `href`: solo las tarjetas cuyo valor es un CONTEO con una lista que lo
  // explique. Un % o un total en pesos no tienen "la lista de esos N" detrás, así
  // que no se vuelven clickeables — una card que navega a algo que no reconcilia
  // con su número es peor que una que no navega.
  // `activo`: el filtro que abre esa tarjeta YA está aplicado en esta vista, así
  // que se marca. Solo aplica a las que filtran esta misma página — un destino a
  // otra ruta (Pagos) nunca está "activo" acá.
  const stats = [
    // Total Clientes: su lista es esta misma página sin filtro → clic sería no-op.
    { label: 'Total Clientes',   value: clientes.length,       sublabel: undefined as string | undefined, icon: Users, color: STAT_CHIP.blue,    href: undefined as string | undefined, activo: false },
    { label: 'Recurrentes',      value: recurrentes,           sublabel: undefined as string | undefined, icon: Star,  color: STAT_CHIP.amber,   href: '/admin/clientes?recurrentes=1', activo: recurrentesOnly },
    // La tasa DECLARA su fórmula: es recurrentes/total, y sin el sub el 15% se
    // lee como cualquier cosa. Mismo conjunto que la card de al lado → sin href
    // propio (el valor es un %, no un conteo navegable).
    { label: 'Tasa Recurrencia', value: tasaRecurr,            sublabel: `${recurrentes} de ${clientes.length} clientes con más de 1 compra`, icon: Star, color: STAT_CHIP.emerald, href: undefined as string | undefined, activo: false },
    // Suma de Payments de todos los clientes → su "lista" es el ledger de Pagos.
    { label: 'Compras totales',  value: formatCOP(totalVentas),sublabel: 'Pagos recibidos',                icon: Users, color: STAT_CHIP.violet,  href: '/admin/pagos', activo: false },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground">{clientes.length} clientes registrados</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" /> Nuevo Cliente
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => {
          const cuerpo = (
            <>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>
                <s.icon className="w-4 h-4" />
              </div>
              <p className="text-xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              {s.sublabel && (
                <p className="text-[10px] leading-tight text-muted-foreground/70">{s.sublabel}</p>
              )}
            </>
          );
          return s.href ? (
            // Marcada (borde de primario + tinte, sin relleno) cuando el filtro
            // que abre ESTA tarjeta ya está aplicado — patrón compartido con
            // Inventario y Entregas.
            <Link
              key={s.label}
              href={s.href}
              aria-current={s.activo ? 'true' : undefined}
              className={`stat-card ${statCardLink(s.activo)}`}
            >{cuerpo}</Link>
          ) : (
            <div key={s.label} className="stat-card">{cuerpo}</div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client list */}
        <div className="lg:col-span-2 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar clientes..."
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Active recurrentes filter (arrived from the dashboard card). */}
          {recurrentesOnly && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1 text-xs font-medium text-amber-800 dark:text-amber-300">
                <Star className="w-3 h-3" /> Solo recurrentes ({recurrentes})
              </span>
              <Link href="/admin/clientes" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" /> Quitar filtro
              </Link>
            </div>
          )}

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Cargando...</div>
            ) : filtered.length === 0 ? (
              <EmptyState onNew={openNew} />
            ) : (
              <div className="divide-y divide-border">
                {filtered.map(c => (
                  <div
                    key={c.id}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 cursor-pointer transition-colors"
                    onClick={() => router.push(`/admin/clientes/${c.id}`)}
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-primary">
                        {c.nombre?.[0]?.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{c.nombre}</p>
                        {(c.ordenes ?? 0) > 2 && (
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.email ?? c.telefono ?? '—'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">{formatCOP(c.total_compras ?? 0)}</p>
                      <p className="text-xs text-muted-foreground">{c.ordenes ?? 0} {(c.ordenes ?? 0) === 1 ? 'orden' : 'órdenes'}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm" variant="ghost" className="h-7 w-7 p-0"
                        onClick={e => { e.stopPropagation(); openEdit(c); }}
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      {(c.ordenesRef ?? 0) > 0 ? (
                        // Gate on `ordenesRef` (raw FK refs = what the delete guard
                        // counts), NOT the visible `ordenes` (non-cancelled): otherwise
                        // the dialog could open on a "0 órdenes" (only-cancelled) row
                        // and the server would 409. The "(incluye canceladas)" note
                        // shows ONLY when the referential count exceeds the visible one
                        // (i.e. there ARE cancelled orders) — no contradiction when they
                        // match. Real disabled control (no pointer cursor, not focusable
                        // — the row is cursor-pointer, so the span resets it); the span
                        // is the tooltip target since a disabled button swallows hovers.
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              onClick={e => e.stopPropagation()}
                              className="inline-flex cursor-not-allowed"
                            >
                              <Button
                                size="sm" variant="ghost" disabled
                                className="h-7 w-7 p-0 text-muted-foreground/40"
                                aria-label={`No se puede eliminar ${c.nombre}: tiene ${c.ordenesRef} ${c.ordenesRef === 1 ? 'orden asociada' : 'órdenes asociadas'}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            No se puede eliminar: tiene {c.ordenesRef} {c.ordenesRef === 1 ? 'orden asociada' : 'órdenes asociadas'}.
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Button
                          size="sm" variant="destructiveGhost" className="h-7 w-7 p-0"
                          onClick={e => { e.stopPropagation(); setDeleteTarget(c); }}
                          aria-label={`Eliminar ${c.nombre}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Top 5 */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-sm mb-3">Top 5 Clientes</h3>
            <div className="space-y-3">
              {topClientes.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin datos</p>
              ) : topClientes.map((c, i) => (
                // Cada fila navega al detalle del cliente — el mismo destino al
                // que ya linkea el modal de entregas, así que "quién es este
                // cliente" se responde igual desde todo el admin.
                // `hover:bg-muted/20` es EL hover de fila del panel (Órdenes,
                // Pagos, Productos, la lista de al lado…). Era `hover:bg-accent`,
                // que en el tema oscuro del admin rellena de ámbar sólido — el
                // mismo desvío que tenían las stat cards.
                <Link
                  key={c.id}
                  href={`/admin/clientes/${c.id}`}
                  className="flex items-center gap-3 -mx-2 rounded-lg px-2 py-1 transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="text-xs font-bold text-muted-foreground w-4">#{i + 1}</span>
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold text-primary">{c.nombre?.[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{c.nombre}</p>
                    {/* Top 5 rankea por dinero PAGADO (línea de abajo); "N órdenes"
                        cuenta las no canceladas — misma definición que la lista. */}
                    <p className="text-xs text-muted-foreground">{c.ordenes ?? 0} {(c.ordenes ?? 0) === 1 ? 'orden' : 'órdenes'}</p>
                  </div>
                  <p className="text-xs font-bold text-primary">{formatCOP(c.total_compras ?? 0)}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) error.limpiar(); setShowForm(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2">
              <Label>Nombre *</Label>
              <Input {...field('nombre')} className="mt-1" />
            </div>
            <div>
              <Label>Email</Label>
              <Input {...field('email')} className="mt-1" />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input {...field('telefono')} className="mt-1" />
            </div>
            <div>
              <Label>Ciudad</Label>
              <Input {...field('ciudad')} className="mt-1" />
            </div>
            <div>
              <Label>Canal</Label>
              <Select
                value={form.canal}
                onValueChange={v => setForm(f => ({ ...f, canal: v as OrderChannel }))}
              >
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(CANALES) as [OrderChannel, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Dirección</Label>
              <Input {...field('direccion')} className="mt-1" />
            </div>
            <div className="col-span-2">
              <Label>Notas</Label>
              <textarea
                {...field('notas')}
                className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background min-h-16 resize-none"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <ErrorDialogo mensaje={error.mensaje} />
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={guardando || !form.nombre}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation — themed replacement for window.confirm(). Only opens
          for customers with zero orders (the row gate); the server 409 is the real
          backstop if the shown count ever lags reality. */}
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title="Eliminar cliente"
        entityLabel={deleteTarget
          ? [deleteTarget.nombre, deleteTarget.email ?? deleteTarget.telefono].filter(Boolean).join(' · ')
          : ''}
        consequence="Se eliminará permanentemente. Esta acción no se puede deshacer."
        confirmLabel="Eliminar cliente"
        successMessage="Cliente eliminado"
        onConfirm={confirmDelete}
      />
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Users className="w-10 h-10 text-muted-foreground/40 mb-3" />
      <h3 className="font-semibold mb-1">Sin clientes</h3>
      <p className="text-sm text-muted-foreground mb-4">Agrega tu primer cliente al sistema.</p>
      <Button size="sm" onClick={onNew}><Plus className="w-3 h-3 mr-1" /> Agregar Cliente</Button>
    </div>
  );
}