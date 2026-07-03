'use client';

import { useState, useEffect } from 'react';
import { UserPlus, Search, MoreVertical, Mail, Shield, Check, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import RoleBadge from '@/components/admin/RoleBadge';
import InviteUserModal from '@/components/admin/InviteUserModal';
import { normalize } from '@/lib/utils';
import { AdminUser, Role } from '@/types/admin';
import { ROLES } from '@/constants/roles';
import { authClient } from '@/lib/auth-client';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const initials = (name: string) =>
  (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConfiguracionUsuarios() {
  const { data: session }           = authClient.useSession();
  const isOwner                     = session?.user?.role === 'OWNER';
  const [users, setUsers]           = useState<AdminUser[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/users');
      const data = await res.json() as AdminUser[];
      setUsers(data);
    } catch {
      toast.error('Error al cargar los usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleRoleChange = async (userId: string, newRole: Role) => {
    try {
      const res = await fetch(`/api/users/${userId}/role`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error();
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast.success('Rol actualizado');
    } catch {
      toast.error('Error al actualizar el rol');
    } finally {
      setActiveMenu(null);
    }
  };

  const handleInvited = () => {
    setShowInvite(false);
    toast.success('Usuario creado correctamente');
    loadUsers();
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const filtered = users.filter(u =>
    normalize(u.name).includes(normalize(search)) ||
    normalize(u.email).includes(normalize(search))
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Equipo</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestiona quién tiene acceso al panel de administración
          </p>
        </div>
        {isOwner && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            Agregar usuario
          </button>
        )}
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {([
          { role: 'OWNER',   desc: 'Acceso total al sistema, configuración y datos críticos.' },
          { role: 'MANAGER', desc: 'Gestión operativa: órdenes, inventario, clientes y reportes.' },
          { role: 'STAFF',   desc: 'Solo puede ver y gestionar órdenes del día a día.' },
        ] as { role: Role; desc: string }[]).map(({ role, desc }) => (
          <div key={role} className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <RoleBadge role={role} />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      {/* Search + Table */}
      <div className="bg-card border border-border rounded-2xl shadow-sm">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre o correo..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors"
            />
          </div>
          <button
            onClick={loadUsers}
            className="p-2 rounded-xl border border-border hover:bg-muted transition-colors text-muted-foreground"
            title="Recargar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-2 border-border border-t-primary rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mb-4">
              <Shield className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground mb-1">Sin usuarios</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              {search
                ? `No hay resultados para "${search}"`
                : 'Agrega a tu equipo para que puedan acceder al panel.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(u => (
              <div
                key={u.id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors group"
              >
                {/* Avatar */}
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary">{initials(u.name)}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{u.name || '—'}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Mail className="w-3 h-3 text-muted-foreground shrink-0" />
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                </div>

                {/* Role badge */}
                <div className="hidden sm:block shrink-0">
                  <RoleBadge role={u.role} />
                </div>

                {/* Role menu */}
                <div className="relative shrink-0">
                  <button
                    onClick={() => setActiveMenu(activeMenu === u.id ? null : u.id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {activeMenu === u.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)} />
                      <div className="absolute right-0 top-10 z-20 w-52 bg-card border border-border rounded-xl shadow-lg overflow-hidden py-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-3 py-2">
                          Cambiar rol
                        </p>
                        {ROLES.map(r => (
                          <button
                            key={r}
                            onClick={() => handleRoleChange(u.id, r)}
                            className="flex items-center justify-between w-full px-3 py-2 text-sm hover:bg-muted transition-colors"
                          >
                            <RoleBadge role={r} />
                            {u.role === r && <Check className="w-3.5 h-3.5 text-primary" />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-border bg-muted/20">
            <p className="text-xs text-muted-foreground">
              {filtered.length} usuario{filtered.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      {isOwner && showInvite && (
        <InviteUserModal
          onClose={() => setShowInvite(false)}
          onSuccess={handleInvited}
        />
      )}
    </div>
  );
}