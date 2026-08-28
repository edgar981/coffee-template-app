'use client';

import { useState, useEffect } from 'react';
import { UserPlus, Search, MoreVertical, Mail, Users, Check, RefreshCw, MailWarning } from 'lucide-react';
import { toast } from 'sonner';
import RoleBadge from '@/components/admin/RoleBadge';
import InviteUserModal from '@/components/admin/InviteUserModal';
import DatosNegocioSeccion from '@/components/admin/DatosNegocioSeccion';
import PaletaSeccion from '@/components/admin/PaletaSeccion';
import { normalize } from '@duna/core/utils';
import { AdminUser, Role } from '@/types/admin';
import { ROLES } from '@/constants/roles';
import { accionEstadoUsuario, motivoRechazoCambioEstado } from '@duna/core/usuarios';
import { ConfirmDeleteDialog } from '@/components/admin/ConfirmDeleteDialog';
import { authClient } from '@/lib/auth-client';
import { useAccionesPorFila } from '@/hooks/useAccionGuardada';

// La forma que llega por fetch: las fechas viajan como ISO string, no Date.
interface InvitePendiente {
  id: string; email: string; name: string | null; role: Role;
  expiresAt: string; createdAt: string;
}

// "Vence en N h" / "en N días" — se calcula una vez al render (aproximado, y la
// página recarga). Sin reloj vivo: la invitación dura 48 h, no es un cronómetro.
function venceEn(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'Vencida';
  const horas = Math.round(ms / 3_600_000);
  if (horas >= 24) { const d = Math.round(horas / 24); return `Vence en ${d} día${d !== 1 ? 's' : ''}`; }
  if (horas >= 1)  return `Vence en ${horas} h`;
  return 'Vence pronto';
}

// ─── ESTA ES LA PANTALLA DE CONFIGURACIÓN ────────────────────────────────────
//
// Se llamó "Equipo y usuarios" mientras SÓLO mostraba equipo —llamarla
// "Configuración" con una única cosa adentro habría sido una promesa vacía—. Con el
// editor del negocio (SiteSetting) ya hay contenido REAL, así que recupera el título
// "Configuración" y se organiza en DOS secciones: "Datos del negocio" y "Equipo y
// usuarios". Ése era el disparador anotado: el nombre volvía cuando hubiera config real.
//
// SIN sub-rutas todavía: dos secciones caben en una página. El HUB con sub-routes es la
// era multi-tenant, cuando haya varias verticales de config (facturación, integraciones).
//
// La ruta se queda en `/admin/configuracion`; la subruta vieja `/configuracion/usuarios`
// redirige acá (§ lib/redirect-config).

// ─── Helpers ──────────────────────────────────────────────────────────────────

const initials = (name: string) =>
  (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

const LEYENDA: { role: Role; desc: string }[] = [
  { role: 'OWNER',   desc: 'Acceso total al sistema, configuración y datos críticos.' },
  { role: 'MANAGER', desc: 'Gestión operativa: órdenes, inventario, clientes y reportes.' },
  { role: 'STAFF',   desc: 'Solo puede ver y gestionar órdenes del día a día.' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Configuracion() {
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

  // Las invitaciones pendientes son SÓLO del OWNER (el endpoint 403ea a los demás),
  // así que un 403 se trata como "nada que mostrar", no como error. La sección no
  // existe para quien no puede invitar.
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

  // Guarda POR USUARIO. El valor es absoluto (poner el rol en X), así que un
  // duplicado no corrompe nada — pero el menú se cierra recién en el `finally`,
  // o sea que durante todo el vuelo queda abierto y sin decir nada. Es
  // exactamente el silencio que invita al segundo click, que es lo que esta
  // guarda existe para cubrir. Ver CLAUDE.md § Doble-submit.
  const filasRol = useAccionesPorFila();

  // Guarda por invitación para el botón Cancelar — su propia instancia, otro
  // espacio de ids (ids de invitación, no de usuario).
  const filasInvite = useAccionesPorFila();

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
    // La nueva pendiente aparece en su sección: recargar las dos.
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

  // ── Derived ────────────────────────────────────────────────────────────────

  const filtered = users.filter(u =>
    normalize(u.name).includes(normalize(search)) ||
    normalize(u.email).includes(normalize(search))
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header de la página */}
      <div style={{ minWidth: 0 }}>
        <h1 className="duna-display-m">Configuración</h1>
        <p className="duna-sub" style={{ marginTop: '3px', maxWidth: '42rem' }}>
          La identidad del negocio y quién tiene acceso al panel.
        </p>
      </div>

      {/* ── Sección: Datos del negocio (lectura↔edición, dueña de su header) ── */}
      <section style={{ marginTop: 'var(--duna-space-8)' }}>
        <DatosNegocioSeccion />
      </section>

      {/* ── Sección: Colores de la tienda (misma cáscara que Datos del negocio) ── */}
      <section style={{ marginTop: 'var(--duna-space-8)' }}>
        <PaletaSeccion />
      </section>

      {/* ── Sección: Equipo y usuarios ────────────────────────────────────── */}
      <section style={{ marginTop: 'var(--duna-space-8)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--duna-space-4)' }}>
          <div style={{ minWidth: 0 }}>
            <h2 className="duna-title">Equipo y usuarios</h2>
            <p className="duna-sub" style={{ marginTop: '3px', maxWidth: '42rem' }}>
              Quién tiene acceso al panel, con qué rol, y quién lo conserva. Invitar a
              alguien le manda un correo; el usuario nace cuando acepta y define su
              contraseña.
            </p>
          </div>
          {isOwner && (
            <button
              type="button"
              onClick={() => setShowInvite(true)}
              className="duna-btn duna-btn--secondary"
              style={{ flexShrink: 0 }}
            >
              <UserPlus /> Agregar usuario
            </button>
          )}
        </div>

      {/* Leyenda de roles */}
      <div className="duna-cards" style={{ marginTop: 'var(--duna-space-6)' }}>
        {LEYENDA.map(({ role, desc }) => (
          <div key={role} className="duna-card duna-card__pad">
            <RoleBadge role={role} />
            <p className="duna-sub" style={{ marginTop: 'var(--duna-space-2)' }}>{desc}</p>
          </div>
        ))}
      </div>

      {/* Buscador + lista */}
      <div className="duna-card" style={{ marginTop: 'var(--duna-space-6)', padding: 0 }}>
        {/* Buscar */}
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

        {/* Estados */}
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
            {filtered.map((u, i) => (
              <div
                key={u.id}
                style={{
                  position: 'relative',
                  display: 'flex', alignItems: 'center', gap: 'var(--duna-space-3)',
                  padding: 'var(--duna-space-3) var(--duna-space-4)',
                  borderTop: i === 0 ? 'none' : '1px solid var(--duna-border)',
                }}
              >
                {/* Avatar */}
                <div className="duna-avatar">{initials(u.name)}</div>

                {/* Identidad */}
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

                {/* Rol y, si perdió el acceso, su estado. El badge de "Sin acceso"
                    sólo aparece cuando hay algo que decir: el caso normal no gasta
                    un elemento en confirmar que todo está bien. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', flexShrink: 0 }}>
                  {!u.activo && (
                    <span className="duna-badge duna-badge--neutral">Sin acceso</span>
                  )}
                  <RoleBadge role={u.role} />
                </div>

                {/* Menú de acciones */}
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
                        {ROLES.map(r => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => handleRoleChange(u.id, r)}
                            disabled={filasRol.enVuelo(u.id)}
                            className="admin-menu-item"
                          >
                            <RoleBadge role={r} />
                            {filasRol.enVuelo(u.id)
                              ? <span className="duna-caption">Aplicando…</span>
                              : u.role === r && <Check style={{ width: 14, height: 14, color: 'var(--duna-ink)' }} />}
                          </button>
                        ))}

                        {/* La acción de estado y su INVERSA en el MISMO lugar — la
                            lección de "Activar desde el badge": una puerta sin su
                            vuelta deja a alguien atrapado y la única salida es la
                            base. Cuál de las dos se ofrece lo decide
                            `accionEstadoUsuario`, no un `if` acá. No se ofrece sobre
                            uno mismo: el server lo rechaza igual, y un botón que sólo
                            sirve para recibir un error es una pregunta que no hay que
                            hacer. */}
                        {isOwner && (() => {
                          const accion = accionEstadoUsuario(u)!;
                          // MISMA función que el servidor. Si hay motivo, el botón se
                          // muestra DESHABILITADO diciéndolo — no se esconde.
                          // Esconderlo fue el error de la primera versión: con dos
                          // usuarios, abrir el menú sobre uno mismo no mostraba nada y
                          // la acción parecía no existir. Es la regla del "Marcar En
                          // Ruta" bloqueado: una acción ausente manda a buscarla a
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
              </div>
            ))}
          </div>
        )}

        {/* Conteo */}
        {!loading && filtered.length > 0 && (
          <div style={{ padding: 'var(--duna-space-3) var(--duna-space-4)', borderTop: '1px solid var(--duna-border)' }}>
            <p className="duna-caption">
              {filtered.length} usuario{filtered.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      {/* INVITACIONES PENDIENTES — sólo OWNER, y sólo cuando hay alguna. Una
          invitación pendiente es alguien invitado que aún no aceptó; mientras viva,
          su correo queda BLOQUEADO para re-invitar (el POST lo rechaza 48 h). Verla
          y poder cancelarla es la salida a un correo mal tecleado. Vacía no gasta un
          bloque: el caso normal es que no haya ninguna. */}
      {isOwner && invites.length > 0 && (
        <div style={{ marginTop: 'var(--duna-space-8)' }}>
          <div className="duna-eyebrow">Invitaciones pendientes</div>
          <p className="duna-sub" style={{ marginTop: '2px', maxWidth: '42rem' }}>
            Invitaciones enviadas que todavía no se aceptaron. Cancelar una libera ese
            correo para volver a invitar.
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
                  <span className="duna-caption">{venceEn(inv.expiresAt)}</span>
                </div>
                <RoleBadge role={inv.role} />
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
      </section>

      {/* Se reusa el confirm compartido con `confirmKind='default'`: desactivar NO
          destruye nada —el historial queda y la persona puede volver—, así que va
          en ámbar y no en rojo. */}
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
