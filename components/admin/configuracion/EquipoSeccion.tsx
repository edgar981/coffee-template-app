'use client';

import { useState, useEffect } from 'react';
import { UserPlus, Search, MoreVertical, Mail, Users, Check, RefreshCw, MailWarning } from 'lucide-react';
import { toast } from 'sonner';
import RoleBadge from '@/components/admin/RoleBadge';
import InviteUserModal from '@/components/admin/InviteUserModal';
import { normalize } from '@duna/core/utils';
import { AdminUser, Role } from '@/types/admin';
import {
  accionEstadoUsuario, motivoRechazoCambioEstado, esUltimoOwnerConAcceso,
} from '@duna/core/usuarios';
import { ConfirmDeleteDialog } from '@/components/admin/ConfirmDeleteDialog';
import { authClient } from '@/lib/auth-client';
import { useAccionesPorFila, useAccionGuardada } from '@/hooks/useAccionGuardada';
import {
  DESCRIPCION_ROL, ROLES_ASIGNABLES, confirmacionCambioRol, venceEn, type RolAsignable,
} from '@/lib/admin/configuracion-partes';
import { EncabezadoBloque } from './EncabezadoBloque';

// ─── Subsección «Equipo» ──────────────────────────────────────────────────────────────────────
//
// Antes: roles cambiables SIN confirmación (ni para hacer dueño a alguien), con "Empleado"
// ofrecido aunque `ROLES_INVITABLES = ['MANAGER']` lo deja sin acceso al panel, y el menú de
// "Cambiar rol" SIN gatear a `isOwner` (§ diagnóstico, `docs/panel/REDISENO.md` § 2). Las tres se
// corrigen acá: `ROLES_ASIGNABLES` (OWNER/MANAGER, sin STAFF), confirmación con la consecuencia en
// palabras (`confirmacionCambioRol`), y el ⋮ de acciones SÓLO se renderiza para `isOwner` —sin
// menos opciones adentro: no hay NADA en ese menú que un no-dueño pueda hacer hoy (cambiar rol y
// activar/desactivar YA eran OWNER-only del lado del servidor).
//
// La leyenda de roles usa la fuente ÚNICA (`DESCRIPCION_ROL`, § `lib/admin/configuracion-partes`)
// que reemplaza las tres que había: ésta, la de `InviteUserModal` y la de `perfil/page.tsx` (esa
// tercera queda viva — no está en `touches:` de este slice, ver el reporte de cierre).

const LEYENDA: { role: RolAsignable; titulo: string }[] = [
  { role: 'OWNER',   titulo: 'Dueño o dueña' },
  { role: 'MANAGER', titulo: 'Gerente' },
];

// La forma que llega por fetch: las fechas viajan como ISO string, no Date.
interface InvitePendiente {
  id: string; email: string; name: string | null; role: Role;
  expiresAt: string; createdAt: string;
}

const initials = (name: string) =>
  (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

export default function EquipoSeccion() {
  const { data: session }           = authClient.useSession();
  const isOwner                     = session?.user?.role === 'OWNER';
  const [users, setUsers]           = useState<AdminUser[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [invites, setInvites]       = useState<InvitePendiente[]>([]);

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

  // Las invitaciones pendientes son SÓLO del OWNER (el endpoint 403ea a los demás), así que un
  // 403 se trata como "nada que mostrar", no como error.
  const loadInvites = async () => {
    try {
      const res = await fetch('/api/users/invite');
      if (!res.ok) { setInvites([]); return; }
      setInvites(await res.json() as InvitePendiente[]);
    } catch {
      setInvites([]);
    }
  };

  useEffect(() => { loadUsers(); }, []);
  useEffect(() => { if (isOwner) loadInvites(); }, [isOwner]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const filasInvite    = useAccionesPorFila();
  const reenvioGuarda  = useAccionGuardada();

  // Usuario cuyo cambio de ESTADO se está confirmando. `null` = diálogo cerrado.
  const [estadoTarget, setEstadoTarget] = useState<AdminUser | null>(null);
  // Usuario + rol nuevo cuyo cambio de ROL se está confirmando. SIN guarda propia por fila: el
  // cambio de rol ya no es un click directo en el menú — abre ESTE confirm, y el candado vive
  // dentro de `ConfirmDeleteDialog` (su propio `useAccionGuardada`, botones bloqueados mientras
  // viaja). Una segunda guarda acá sería un segundo candado sobre la misma puerta.
  const [rolTarget, setRolTarget] = useState<{ user: AdminUser; nuevoRol: RolAsignable } | null>(null);

  const ownersActivos = users.filter(x => x.role === 'OWNER' && x.activo).length;

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

  // Lanza en vez de tragarse el error (como `cambiarEstado`, arriba): el diálogo que la llama
  // (`ConfirmDeleteDialog`) es quien decide qué hacer con el fallo —error inline, diálogo
  // abierto— y un `catch` acá se lo robaría, dejando que el diálogo cierre y muestre
  // "Rol actualizado" sobre un PATCH que en realidad falló.
  const handleRoleChange = async (userId: string, newRole: RolAsignable) => {
    const res = await fetch(`/api/users/${userId}/role`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ role: newRole }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: null }));
      throw new Error(error || 'No se pudo actualizar el rol');
    }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
  };

  const handleInvited = () => {
    setShowInvite(false);
    loadUsers();
    loadInvites();
  };

  const cancelarInvite = (id: string) =>
    filasInvite.ejecutar(id, async () => {
      try {
        const res = await fetch(`/api/users/invite/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({ error: null }));
          throw new Error(error || 'No se pudo cancelar la invitación');
        }
        toast.success('Invitación cancelada');
        loadInvites();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo cancelar la invitación');
      }
    });

  // Reenviar: la guarda es GLOBAL (`useAccionGuardada`, no por fila) a propósito — es un caso
  // raro, no una lista de acciones frecuentes como Cancelar, así que no vale la pena una segunda
  // instancia de `useAccionesPorFila` sólo para esto.
  const reenviarInvite = (id: string, email: string) =>
    reenvioGuarda.ejecutar(async () => {
      try {
        const res = await fetch(`/api/users/invite/${id}`, { method: 'POST' });
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({ error: null }));
          throw new Error(error || 'No se pudo reenviar la invitación');
        }
        toast.success(`Invitación reenviada a ${email}`);
        loadInvites();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo reenviar la invitación');
      }
    });

  // ── Derived ────────────────────────────────────────────────────────────────

  const filtered = users.filter(u =>
    normalize(u.name).includes(normalize(search)) ||
    normalize(u.email).includes(normalize(search))
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="duna-card duna-card__pad">
      <EncabezadoBloque
        titulo={`${users.length} persona${users.length !== 1 ? 's' : ''} entra${users.length !== 1 ? 'n' : ''} al panel`}
        descripcion="Dos roles, sin letra pequeña."
        editando={false}
        onEditar={() => {}}
        sinEditar
        accionExtra={isOwner && (
          <button type="button" onClick={() => setShowInvite(true)} className="duna-btn duna-btn--secondary">
            <UserPlus /> Invitar
          </button>
        )}
      />

      {/* Leyenda de roles — SÓLO los dos que el panel ofrece de verdad. */}
      <div className="duna-cards" style={{ marginTop: 'var(--duna-space-6)' }}>
        {LEYENDA.map(({ role, titulo }) => (
          <div key={role} className="duna-card duna-card__pad">
            <p className="duna-body" style={{ margin: 0, fontWeight: 'var(--duna-w-semi)' }}>{titulo}</p>
            <p className="duna-sub" style={{ marginTop: 'var(--duna-space-2)' }}>{DESCRIPCION_ROL[role]}</p>
          </div>
        ))}
      </div>

      {/* Buscador + lista */}
      <div className="duna-card" style={{ marginTop: 'var(--duna-space-6)', padding: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--duna-space-3)',
          padding: 'var(--duna-space-4)', borderBottom: '1px solid var(--duna-border)',
        }}>
          <label className="duna-search" style={{ flex: 1 }}>
            <Search className="duna-search__ic" />
            <input
              className="duna-input"
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre o correo…"
            />
          </label>
          <button
            type="button"
            onClick={loadUsers}
            className="duna-btn duna-btn--ghost duna-btn--icon"
            aria-label="Recargar"
          >
            <RefreshCw />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 'var(--duna-space-8)', textAlign: 'center' }}>
            <p className="duna-caption">Cargando…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 'var(--duna-space-8) var(--duna-space-4)', textAlign: 'center' }}>
            <div style={{
              width: 48, height: 48, margin: '0 auto var(--duna-space-3)',
              borderRadius: 'var(--duna-r-l)', background: 'var(--duna-surface-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Users style={{ width: 22, height: 22, color: 'var(--duna-muted)' }} />
            </div>
            <p className="duna-body" style={{ fontWeight: 'var(--duna-w-semi)' }}>Sin usuarios</p>
            <p className="duna-sub" style={{ marginTop: '2px' }}>
              {search ? `No hay resultados para "${search}"` : 'Agrega a tu equipo para que puedan acceder al panel.'}
            </p>
          </div>
        ) : (
          <div>
            {filtered.map((u, i) => {
              const esUno = u.id === session?.user?.id;
              return (
                <div
                  key={u.id}
                  style={{
                    position: 'relative',
                    display: 'flex', alignItems: 'center', gap: 'var(--duna-space-3)',
                    padding: 'var(--duna-space-3) var(--duna-space-4)',
                    borderTop: i === 0 ? 'none' : '1px solid var(--duna-border)',
                  }}
                >
                  <div className="duna-avatar">{initials(u.name)}</div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="duna-body" style={{
                      fontWeight: 'var(--duna-w-semi)', margin: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{u.name || '—'}</p>
                    <span className="duna-caption" style={{
                      display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      <Mail style={{ width: 12, height: 12, flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</span>
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', flexShrink: 0 }}>
                    {!u.activo && (
                      <span className="duna-badge duna-badge--neutral">Sin acceso</span>
                    )}
                    <RoleBadge role={u.role} />
                    {esUno && <span className="duna-caption">tú</span>}
                  </div>

                  {/* El ⋮ de acciones SÓLO existe para el OWNER, y nunca sobre uno mismo: cambiar
                      rol y activar/desactivar son las dos únicas acciones del menú, y las dos son
                      OWNER-only del lado del servidor — un no-dueño no tiene nada que hacer acá. */}
                  {isOwner && !esUno && (
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => setActiveMenu(activeMenu === u.id ? null : u.id)}
                        className="duna-btn duna-btn--ghost duna-btn--icon"
                        aria-label="Acciones"
                      >
                        <MoreVertical />
                      </button>

                      {activeMenu === u.id && (
                        <>
                          <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setActiveMenu(null)} />
                          <div
                            className="duna-card"
                            style={{
                              position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 20,
                              width: 208, padding: 'var(--duna-space-1) 0',
                              boxShadow: 'var(--duna-shadow-2)', overflow: 'hidden',
                            }}
                          >
                            <p className="duna-eyebrow" style={{ padding: 'var(--duna-space-2) var(--duna-space-3)' }}>
                              Cambiar rol
                            </p>
                            {ROLES_ASIGNABLES.map(r => {
                              const yaEsEste = u.role === r;
                              // El único caso donde reasignar puede dejar el panel sin dueño: bajar
                              // al ÚLTIMO owner activo a gerente. `esUltimoOwnerConAcceso` es la
                              // MISMA función que ya usa el servidor — no una segunda regla.
                              const motivo = !yaEsEste
                                ? (esUltimoOwnerConAcceso({ objetivo: u, nuevoRol: r, ownersActivos })
                                    ? 'Debe quedar al menos un dueño activo'
                                    : null)
                                : null;
                              return (
                                <button
                                  key={r}
                                  type="button"
                                  onClick={() => {
                                    if (yaEsEste) return;
                                    setActiveMenu(null);
                                    setRolTarget({ user: u, nuevoRol: r });
                                  }}
                                  disabled={yaEsEste || !!motivo}
                                  className="admin-menu-item admin-menu-item--col"
                                >
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', width: '100%' }}>
                                    <RoleBadge role={r} />
                                    {yaEsEste && <Check style={{ width: 14, height: 14, color: 'var(--duna-ink)', marginLeft: 'auto' }} />}
                                  </span>
                                  {motivo && <span className="duna-caption" style={{ lineHeight: 1.3 }}>{motivo}</span>}
                                </button>
                              );
                            })}

                            {(() => {
                              const accion = accionEstadoUsuario(u)!;
                              const motivo = motivoRechazoCambioEstado({
                                actorRol: session?.user?.role,
                                actorId:  session?.user?.id ?? '',
                                objetivo: u,
                                activo:   accion.activo,
                                ownersActivos,
                              });
                              return (
                                <>
                                  <hr className="duna-divider" style={{ margin: 'var(--duna-space-1) 0' }} />
                                  <button
                                    type="button"
                                    onClick={() => { setActiveMenu(null); setEstadoTarget(u); }}
                                    disabled={!!motivo}
                                    className="admin-menu-item admin-menu-item--col"
                                  >
                                    <span>{accion.label}</span>
                                    {motivo && <span className="duna-caption" style={{ lineHeight: 1.3 }}>{motivo}</span>}
                                  </button>
                                </>
                              );
                            })()}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div style={{ padding: 'var(--duna-space-3) var(--duna-space-4)', borderTop: '1px solid var(--duna-border)' }}>
            <p className="duna-caption">
              {filtered.length} usuario{filtered.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      {/* INVITACIONES PENDIENTES — sólo OWNER, y sólo cuando hay alguna. */}
      {isOwner && invites.length > 0 && (
        <div style={{ marginTop: 'var(--duna-space-8)' }}>
          <div className="duna-eyebrow">Invitaciones pendientes</div>
          <p className="duna-sub" style={{ marginTop: '2px', maxWidth: '42rem' }}>
            Invitaciones enviadas que todavía no se aceptaron. Reenviar manda un enlace nuevo y
            renueva el plazo; cancelar libera ese correo para volver a invitar.
          </p>
          <div className="duna-card" style={{ marginTop: 'var(--duna-space-3)', padding: 0 }}>
            {invites.map((inv, i) => (
              <div
                key={inv.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--duna-space-3)',
                  padding: 'var(--duna-space-3) var(--duna-space-4)',
                  borderTop: i === 0 ? 'none' : '1px solid var(--duna-border)',
                }}
              >
                <div className="duna-avatar" aria-hidden="true">
                  <MailWarning style={{ width: 16, height: 16 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="duna-body" style={{
                    fontWeight: 'var(--duna-w-semi)', margin: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{inv.email}</p>
                  <span className="duna-caption">Invitada como {RoleBadgeLabel(inv.role)} · {venceEn(inv.expiresAt)}</span>
                </div>
                <RoleBadge role={inv.role} />
                <button
                  type="button"
                  onClick={() => reenviarInvite(inv.id, inv.email)}
                  disabled={reenvioGuarda.enVuelo}
                  className="duna-btn duna-btn--ghost duna-btn--sm"
                  style={{ flexShrink: 0 }}
                >
                  {reenvioGuarda.enVuelo ? 'Reenviando…' : 'Reenviar'}
                </button>
                <button
                  type="button"
                  onClick={() => cancelarInvite(inv.id)}
                  disabled={filasInvite.enVuelo(inv.id)}
                  className="duna-btn duna-btn--ghost duna-btn--sm"
                  style={{ flexShrink: 0 }}
                >
                  {filasInvite.enVuelo(inv.id) ? 'Cancelando…' : 'Cancelar'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ESTADO — se reusa el confirm compartido con `confirmKind='default'`: desactivar no
          destruye nada (el historial queda, se puede reactivar). */}
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

      {/* ROL — confirma SIEMPRE, con la consecuencia en palabras (§ el diagnóstico: antes no
          preguntaba nada, ni para hacer dueño a alguien). */}
      {rolTarget && (() => {
        const c = confirmacionCambioRol(rolTarget.user.name || rolTarget.user.email, rolTarget.nuevoRol);
        return (
          <ConfirmDeleteDialog
            open
            onOpenChange={(o) => { if (!o) setRolTarget(null); }}
            confirmKind="default"
            title={c.titulo}
            entityLabel={rolTarget.user.email}
            consequence={c.consecuencia}
            confirmLabel={c.confirmLabel}
            busyLabel="Aplicando…"
            successMessage="Rol actualizado"
            onConfirm={() => handleRoleChange(rolTarget.user.id, rolTarget.nuevoRol)}
          />
        );
      })()}

      {isOwner && (
        <InviteUserModal
          open={showInvite}
          onClose={() => setShowInvite(false)}
          onSuccess={handleInvited}
        />
      )}
    </div>
  );
}

// Etiqueta en minúscula para la línea "Invitada como {rol} · vence en…" — RoleBadge ya la da en
// mayúscula inicial para el chip; acá hace falta en medio de una oración.
function RoleBadgeLabel(role: Role): string {
  const LABEL: Record<Role, string> = { OWNER: 'dueño', MANAGER: 'gerente', STAFF: 'empleado' };
  return LABEL[role] ?? 'gerente';
}
