'use client';

import { useState } from 'react';
import { ROLES_INVITABLES } from '@duna/core/usuarios';
import RoleBadge from '@/components/admin/RoleBadge';
import { useAccionGuardada } from '@/hooks/useAccionGuardada';
import { useDescarteDeDrawer } from '@/hooks/useDescarteDeDrawer';
import { DunaSheet } from '@/components/admin/DunaSheet';
import { ConfirmDescartarDialog } from '@/components/admin/ConfirmDescartarDialog';
import { ErrorDialogo, useErrorDialogo } from '@/components/admin/ErrorDialogo';
import { toast } from 'sonner';

// ─── El modal de invitar es un DUNA-SHEET ─────────────────────────────────────
//
// Era un modal shadcn hand-rolled (overlay propio, `rounded-2xl`) con un defecto
// real: NO cerraba al clicar fuera. `DunaSheet` (Radix) trae eso —click-fuera,
// Escape, foco atrapado, scroll-lock— de fábrica, y el panel ya monta esa
// primitiva en los otros cinco formularios (Ajustar stock, Programar entrega,
// Nuevo pedido, Producto, Cliente). Uno solo hand-rolled era la última costura de
// formulario que no hablaba el idioma del resto.
//
// Anclaje `lado` —el drawer de los flujos con formulario, no el sheet de abajo que
// es para el detalle en angosto—. La guarda de descarte viene con la migración,
// no es un extra: al ganar el click-fuera, un formulario a medias podía perderse
// en silencio; `useDescarteDeDrawer` lo convierte en "¿descartar?" — la misma
// conducta que los otros cuatro form-sheets.

type Role = 'OWNER' | 'MANAGER' | 'STAFF';

const roleDescriptions: Record<Role, string> = {
  OWNER:   'Acceso total: configuración, datos críticos y gestión del equipo.',
  MANAGER: 'Operaciones, inventario, clientes y reportes. Sin configuración crítica.',
  STAFF:   'Solo gestión de órdenes y operaciones del día a día.',
};

export default function InviteUserModal({ open, onClose, onSuccess }: {
  open:      boolean;
  onClose:   () => void;
  onSuccess: () => void;
}) {
  // La guarda vive en el ENVOLTORIO (§ AdjustStockModal): desde acá puede cerrar la
  // TERCERA salida —Escape/clic-fuera—, que sin este gate cerraría el drawer a
  // mitad de la mutación. Cerrar no cancela nada en el server y deja al operador
  // sin saber si el correo salió.
  const guarda   = useAccionGuardada();
  const descarte = useDescarteDeDrawer({ enVuelo: guarda.enVuelo, onCerrar: onClose });

  return (
    <>
      <DunaSheet
        abierto={open}
        onCerrar={descarte.intentarCerrar}
        anclaje="lado"
        titulo="Agregar usuario"
        descripcion="Invita a un colaborador al panel: correo, nombre y rol. Recibe un enlace para crear su contraseña."
      >
        <div className="duna-modal__head">
          <div className="duna-title">Agregar usuario</div>
        </div>
        {/* El cuerpo sólo existe mientras está abierto: se re-siembra en cada
            apertura sin un efecto, y el error inline se limpia solo al cerrar. */}
        {open && (
          <Cuerpo
            guarda={guarda}
            marcarCambios={descarte.marcarCambios}
            intentarCerrar={descarte.intentarCerrar}
            onSuccess={onSuccess}
          />
        )}
      </DunaSheet>
      <ConfirmDescartarDialog
        abierto={descarte.confirmando}
        onDescartar={descarte.descartar}
        onSeguir={descarte.seguirEditando}
      />
    </>
  );
}

function Cuerpo({ guarda, marcarCambios, intentarCerrar, onSuccess }: {
  guarda:        ReturnType<typeof useAccionGuardada>;
  marcarCambios: (hay: boolean) => void;
  intentarCerrar: () => void;
  onSuccess:     () => void;
}) {
  const [name, setName]   = useState('');
  const [email, setEmail] = useState('');
  // El default sale de la MISMA lista que se ofrece: fijarlo en un rol que no está
  // entre las opciones nacería con un valor que el servidor rechaza.
  const [role, setRole]   = useState<Role>(ROLES_INVITABLES[0]);
  const error             = useErrorDialogo();

  const editar = (fn: () => void) => { fn(); marcarCambios(true); };

  const enviar = () => {
    if (!email.trim() || !name.trim()) return;
    return guarda.ejecutar(async () => {
      error.limpiar();
      try {
        const res = await fetch('/api/users/invite', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ email: email.trim(), name: name.trim(), role }),
        });

        if (!res.ok) {
          // El motivo se queda DENTRO del drawer: el formulario sigue lleno y el
          // operador corrige el correo o el rol sin perder lo escrito.
          if (res.status === 403) {
            error.mostrarMensaje('No tienes permiso para invitar usuarios.');
          } else if (res.status === 400) {
            const data = await res.json().catch(() => null);
            error.mostrarMensaje(data?.error || 'Verifica los datos e intenta de nuevo.');
          } else {
            error.mostrarMensaje('No se pudo enviar la invitación. Intenta de nuevo.');
          }
          return;
        }

        toast.success(`Invitación enviada a ${email}`);
        // Ya se envió: no queda nada que descartar, así que un cierre posterior no
        // pregunta.
        marcarCambios(false);
        onSuccess();
      } catch {
        error.mostrarMensaje('No se pudo conectar. Verifica tu conexión.');
      }
    });
  };

  const bloqueado = guarda.enVuelo;

  return (
    <>
      <div className="duna-modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-4)' }}>
        <div className="duna-field">
          <label className="duna-field__label" htmlFor="inv-nombre">Nombre completo</label>
          <input
            id="inv-nombre"
            className="duna-input"
            value={name}
            onChange={e => editar(() => setName(e.target.value))}
            placeholder="María García"
            autoComplete="off"
          />
        </div>

        <div className="duna-field">
          <label className="duna-field__label" htmlFor="inv-correo">Correo electrónico</label>
          <input
            id="inv-correo"
            type="email"
            className="duna-input"
            value={email}
            onChange={e => editar(() => setEmail(e.target.value))}
            placeholder="colaborador@correo.com"
            autoComplete="off"
          />
        </div>

        <div className="duna-field">
          <span className="duna-field__label">Rol asignado</span>
          {ROLES_INVITABLES.map(r => {
            const sel = role === r;
            return (
              <label
                key={r}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 'var(--duna-space-3)',
                  padding: 'var(--duna-space-3)', borderRadius: 'var(--duna-r-m)', cursor: 'pointer',
                  boxShadow: sel ? 'inset 0 0 0 1.5px var(--duna-ink)' : 'inset 0 0 0 1px var(--duna-border)',
                  background: sel ? 'var(--duna-wash-hover)' : 'transparent',
                }}
              >
                <input
                  type="radio"
                  name="inv-role"
                  value={r}
                  checked={sel}
                  onChange={() => editar(() => setRole(r))}
                  style={{ marginTop: '2px', flexShrink: 0, accentColor: 'var(--duna-ink)' }}
                />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <RoleBadge role={r} />
                  <span className="duna-sub" style={{ display: 'block', marginTop: '3px' }}>
                    {roleDescriptions[r]}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="duna-modal__foot">
        <ErrorDialogo mensaje={error.mensaje} className="duna-modal__aviso" />
        <div className="duna-modal__acciones">
          {/* Cancelar también se bloquea mientras la invitación viaja: cerrar a
              mitad no cancela nada en el server. */}
          <button type="button" className="duna-btn duna-btn--ghost" onClick={intentarCerrar} disabled={bloqueado}>
            Cancelar
          </button>
          <button
            type="button"
            className="duna-btn duna-btn--primary"
            onClick={enviar}
            disabled={bloqueado || !email.trim() || !name.trim()}
          >
            {/* El texto cambia, no sólo un spinner: el verbo dice QUÉ pasa, que es
                la mitad que evita el reintento. */}
            {bloqueado ? 'Enviando…' : 'Enviar invitación'}
          </button>
        </div>
      </div>
    </>
  );
}
