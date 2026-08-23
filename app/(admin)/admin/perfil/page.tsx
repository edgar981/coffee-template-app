'use client';

import { useState, useEffect } from 'react';
import { User, Mail, Shield, Building2, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import RoleBadge from '@/components/admin/RoleBadge';
import { siteConfig } from '@/lib/config/site';
import { useAccionGuardada } from '@/hooks/useAccionGuardada';

// ─── ESTA PANTALLA ES LA CUENTA DE QUIEN ESTÁ ADENTRO ────────────────────────
//
// Lo que se limpió respecto de la versión heredada del template, y por qué:
// · el "hace 30 días" de la contraseña era un dato INVENTADO (hardcoded), y su
//   botón "Cambiar" abría un toast "próximamente" — un control que promete algo
//   que no hace. La contraseña REAL entra en la tanda de seguridad;
// · el botón de cámara no tenía `onClick` — un adorno que finge una acción;
// · la "Organización" decía "Bogotá, Colombia", que además de hardcoded era
//   FALSO (Nayoli está en Supatá). Ahora sale de `siteConfig.brand` — la misma
//   fuente que el resto del producto, y el día del multi-tenant migra con ella.
//
// Lo que quedó es lo que la pantalla puede sostener de verdad: editar el nombre,
// ver el correo y el rol, saber de qué negocio es la cuenta, y cerrar sesión.

const PERMISOS: Record<string, string> = {
  OWNER:   'Acceso completo al panel, la configuración y los datos críticos.',
  MANAGER: 'Gestión operativa: pedidos, inventario, clientes y reportes. Sin la administración de la cuenta.',
  STAFF:   'Acceso a las operaciones del día a día.',
};

const initialesDe = (nombre: string) =>
  (nombre.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()) || 'N';

export default function Perfil() {
  const router                = useRouter();
  const [loading, setLoading] = useState(true);
  const [form, setForm]       = useState({ name: '', email: '' });
  const [role, setRole]       = useState<string>('STAFF');
  const guarda                = useAccionGuardada();

  useEffect(() => {
    authClient.getSession().then(({ data: session }) => {
      if (!session?.user) { router.push('/login'); return; }
      setForm({ name: session.user.name ?? '', email: session.user.email ?? '' });
      setRole((session.user as { role?: string }).role ?? 'STAFF');
      setLoading(false);
    });
  }, [router]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    return guarda.ejecutar(async () => {
      const { error } = await authClient.updateUser({ name: form.name });
      if (error) toast.error('No se pudo actualizar el perfil');
      else       toast.success('Perfil actualizado');
    });
  };

  const handleLogout = async () => {
    await authClient.signOut();
    router.push('/login');
  };

  if (loading) {
    return <p className="duna-caption" style={{ padding: 'var(--duna-space-6)' }}>Cargando…</p>;
  }

  return (
    <div>
      {/* Header */}
      <div className="duna-eyebrow">Cuenta</div>
      <h1 className="duna-display-m" style={{ marginTop: '2px' }}>Mi perfil</h1>
      <p className="duna-sub" style={{ marginTop: '3px', maxWidth: '42rem' }}>
        Tu información en el panel. El correo y el rol los administra un dueño; el
        nombre lo cambias acá.
      </p>

      {/* Identidad + edición del nombre */}
      <form onSubmit={handleSave} className="duna-card duna-card__pad" style={{ marginTop: 'var(--duna-space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-4)', marginBottom: 'var(--duna-space-5)' }}>
          <div className="duna-avatar" style={{ width: 56, height: 56, fontSize: 'var(--duna-text-heading)' }}>
            {initialesDe(form.name)}
          </div>
          <div style={{ minWidth: 0 }}>
            <p className="duna-title" style={{ fontSize: 'var(--duna-text-heading)', margin: 0 }}>
              {form.name || 'Sin nombre'}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', marginTop: '3px' }}>
              <RoleBadge role={role} />
              <span className="duna-caption">{form.email}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-4)' }}>
          <div className="duna-field">
            <label className="duna-field__label" htmlFor="perfil-nombre">Nombre completo</label>
            <div className="duna-search">
              <User className="duna-search__ic" />
              <input
                id="perfil-nombre"
                className="duna-input"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Tu nombre"
              />
            </div>
          </div>
          <div className="duna-field">
            <label className="duna-field__label" htmlFor="perfil-correo">Correo electrónico</label>
            <div className="duna-search">
              <Mail className="duna-search__ic" />
              <input
                id="perfil-correo"
                className="duna-input"
                value={form.email}
                disabled
                style={{ color: 'var(--duna-muted)' }}
              />
            </div>
            <p className="duna-field__hint">El correo no se puede cambiar desde acá.</p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--duna-space-4)' }}>
          <button type="submit" className="duna-btn duna-btn--primary" disabled={guarda.enVuelo}>
            {guarda.enVuelo ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>

      {/* Rol y organización */}
      <div className="duna-cards" style={{ marginTop: 'var(--duna-space-4)' }}>
        <div className="duna-card duna-card__pad">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', marginBottom: 'var(--duna-space-3)' }}>
            <Shield style={{ width: 16, height: 16, color: 'var(--duna-muted)' }} />
            <h3 className="duna-title" style={{ fontSize: 'var(--duna-text-body)', margin: 0 }}>Rol y permisos</h3>
          </div>
          <RoleBadge role={role} size="lg" />
          <p className="duna-sub" style={{ marginTop: 'var(--duna-space-2)' }}>
            {PERMISOS[role] ?? PERMISOS.STAFF}
          </p>
        </div>

        <div className="duna-card duna-card__pad">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', marginBottom: 'var(--duna-space-3)' }}>
            <Building2 style={{ width: 16, height: 16, color: 'var(--duna-muted)' }} />
            <h3 className="duna-title" style={{ fontSize: 'var(--duna-text-body)', margin: 0 }}>Organización</h3>
          </div>
          <p className="duna-body" style={{ fontWeight: 'var(--duna-w-semi)', margin: 0 }}>{siteConfig.brand.nombre}</p>
          <p className="duna-sub" style={{ marginTop: '2px' }}>{siteConfig.brand.tagline}</p>
        </div>
      </div>

      {/* Sesión */}
      <div className="duna-card duna-card__pad" style={{ marginTop: 'var(--duna-space-4)' }}>
        <h3 className="duna-title" style={{ fontSize: 'var(--duna-text-body)', margin: 0 }}>Seguridad</h3>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--duna-space-3)',
          marginTop: 'var(--duna-space-3)',
        }}>
          <div style={{ minWidth: 0 }}>
            <p className="duna-body" style={{ fontWeight: 'var(--duna-w-semi)', margin: 0 }}>Sesión activa</p>
            <p className="duna-sub" style={{ marginTop: '1px' }}>Iniciada en este dispositivo.</p>
          </div>
          <button type="button" onClick={handleLogout} className="duna-btn duna-btn--ghost duna-btn--sm" style={{ flexShrink: 0 }}>
            <LogOut /> Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
