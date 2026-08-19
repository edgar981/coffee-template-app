'use client';

import { useState, useEffect } from 'react';
import { UserPlus, Search, MoreVertical, Mail, Shield, Check, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import RoleBadge from '@/components/admin/RoleBadge';
import InviteUserModal from '@/components/admin/InviteUserModal';
import { normalize } from '@duna/core/utils';
import { AdminUser, Role } from '@/types/admin';
import { ROLES } from '@/constants/roles';
import { accionEstadoUsuario, motivoRechazoCambioEstado } from '@duna/core/usuarios';
import { ConfirmDeleteDialog } from '@/components/admin/ConfirmDeleteDialog';
import { authClient } from '@/lib/auth-client';
import { useAccionesPorFila } from '@/hooks/useAccionGuardada';

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

  // Guarda POR USUARIO. El valor es absoluto (poner el rol en X), así que un
  // duplicado no corrompe nada — pero el menú se cierra recién en el `finally`,
  // o sea que durante todo el vuelo queda abierto y sin decir nada. Es
  // exactamente el silencio que invita al segundo click, que es lo que esta
  // guarda existe para cubrir. Ver CLAUDE.md § Doble-submit.
  const filasRol = useAccionesPorFila();

  // Usuario cuyo cambio de estado se está confirmando. `null` = diálogo cerrado.
  const [estadoTarget, setEstadoTarget] = useState<AdminUser | null>(null);

  // Dueños CON ACCESO, contados sobre la lista que ya está en pantalla. Alimenta
  // la MISMA función que decide en el servidor, así que el motivo que se muestra
  // deshabilitado es literalmente el que devolvería el endpoint.
  const ownersActivos = users.filter(x => x.role === 'OWNER' && x.activo).length;

  // Activar / desactivar. El servidor es quien MANDA sobre las tres guardas
  // (último dueño activo, uno mismo, sólo OWNER); acá sólo se propaga su frase,
  // que es la que dice qué corregir.
  const cambiarEstado = async (u: AdminUser, activo: boolean) => {
    const res = await fetch(`/api/users/${u.id}/activo`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ activo }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: null }));
      throw new Error(error || 'No se pudo cambiar el estado del usuario');
    }
    const actualizado = await res.json() as AdminUser;
    setUsers(prev => prev.map(x => x.id === actualizado.id ? actualizado : x));
  };

  const handleRoleChange = (userId: string, newRole: Role) =>
    filasRol.ejecutar(userId, async () => {
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
    });

  const handleInvited = () => {
    // SIN toast acá: el modal ya disparó "Invitación enviada a <correo>" antes
    // de cerrarse. El que había ("Usuario creado correctamente") era además
    // falso — invitar no crea ningún usuario; el usuario nace cuando la persona
    // acepta la invitación y define su contraseña. Dos toasts para una acción, y
    // el segundo afirmando algo que no pasó.
    setShowInvite(false);
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
            aria-label="Recargar"
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

                {/* Rol y, si perdió el acceso, su estado. El badge de inactivo
                    sólo aparece cuando hay algo que decir: el caso normal no
                    gasta un elemento en confirmar que todo está bien. */}
                <div className="hidden sm:flex items-center gap-2 shrink-0">
                  {!u.activo && (
                    <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      Sin acceso
                    </span>
                  )}
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
                            disabled={filasRol.enVuelo(u.id)}
                            className="flex items-center justify-between w-full px-3 py-2 text-sm hover:bg-muted transition-colors disabled:opacity-60"
                          >
                            <RoleBadge role={r} />
                            {filasRol.enVuelo(u.id)
                              ? <span className="text-xs text-muted-foreground">Aplicando…</span>
                              : u.role === r && <Check className="w-3.5 h-3.5 text-primary" />}
                          </button>
                        ))}

                        {/* La acción de estado y su INVERSA en el MISMO lugar —
                            la lección de "Activar desde el badge": una puerta sin
                            su vuelta deja a alguien atrapado y la única salida es
                            la base. Cuál de las dos se ofrece lo decide
                            `accionEstadoUsuario`, no un `if` acá.
                            No se ofrece sobre uno mismo: el server lo rechaza
                            igual, y un botón que sólo sirve para recibir un error
                            es una pregunta que no hay que hacer. */}
                        {isOwner && (() => {
                          const accion = accionEstadoUsuario(u)!;
                          // MISMA función que el servidor. Si hay motivo, el botón
                          // se muestra DESHABILITADO diciéndolo — no se esconde.
                          // Esconderlo fue el error de la primera versión: con dos
                          // usuarios, abrir el menú sobre uno mismo no mostraba
                          // nada y la acción parecía no existir. Es la regla del
                          // "Marcar En Ruta" bloqueado (§ La FILA ofrece el
                          // siguiente paso): una acción ausente manda a buscarla a
                          // otra pantalla.
                          const motivo = motivoRechazoCambioEstado({
                            actorRol: session?.user?.role,
                            actorId:  session?.user?.id ?? '',
                            objetivo: u,
                            activo:   accion.activo,
                            ownersActivos,
                          });
                          return (
                            <>
                              <div className="my-1 border-t border-border" />
                              <button
                                onClick={() => { setActiveMenu(null); setEstadoTarget(u); }}
                                disabled={!!motivo}
                                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
                              >
                                <span>{accion.label}</span>
                                {motivo && (
                                  <span className="text-[11px] leading-tight">{motivo}</span>
                                )}
                              </button>
                            </>
                          );
                        })()}
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

      {/* Se reusa el confirm compartido con `confirmKind='default'`: desactivar
          NO destruye nada —el historial queda y la persona puede volver—, así que
          va en ámbar y no en rojo. */}
      {estadoTarget && (() => {
        const accion = accionEstadoUsuario(estadoTarget)!;
        const desactivando = !accion.activo;
        return (
          <ConfirmDeleteDialog
            open
            onOpenChange={(o) => { if (!o) setEstadoTarget(null); }}
            confirmKind="default"
            title={`${accion.label} a ${estadoTarget.name || estadoTarget.email}`}
            entityLabel={estadoTarget.email}
            consequence={desactivando
              ? 'Pierde el acceso al panel de inmediato: su sesión abierta se cierra en el siguiente request. Su historial se conserva — los pagos que registró y los comprobantes que verificó siguen mostrando su nombre. Podrás reactivarlo cuando quieras.'
              : 'Vuelve a tener acceso al panel con el rol que ya tenía. Deberá iniciar sesión de nuevo.'}
            confirmLabel={accion.label}
            successMessage={accion.successMessage}
            onConfirm={() => cambiarEstado(estadoTarget, accion.activo)}
          />
        );
      })()}

      {isOwner && showInvite && (
        <InviteUserModal
          onClose={() => setShowInvite(false)}
          onSuccess={handleInvited}
        />
      )}
    </div>
  );
}