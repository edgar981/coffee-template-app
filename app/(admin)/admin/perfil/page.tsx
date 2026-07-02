'use client';

import { useState, useEffect } from 'react';
import { User, Mail, Shield, Building2, Key, LogOut, Camera, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';

// ─── RoleBadge ────────────────────────────────────────────────────────────────

type Role = 'OWNER' | 'MANAGER' | 'STAFF';

const ROLE_CONFIG: Record<Role, { label: string; className: string }> = {
  OWNER:   { label: 'Dueño',   className: 'bg-primary/10 text-primary' },
  MANAGER: { label: 'Gerente', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  STAFF:   { label: 'Empleado', className: 'bg-muted text-muted-foreground' },
};

function RoleBadge({ role, size = 'sm' }: { role: string; size?: 'sm' | 'lg' }) {
  const config = ROLE_CONFIG[role as Role] ?? ROLE_CONFIG.STAFF;
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'} ${config.className}`}>
      {config.label}
    </span>
  );
}

// ─── ProfileForm ──────────────────────────────────────────────────────────────

interface ProfileForm {
  name:  string;
  email: string;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Perfil() {
  const router  = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [form, setForm]       = useState<ProfileForm>({ name: '', email: '' });
  const [role, setRole]       = useState<string>('STAFF');

  useEffect(() => {
    authClient.getSession().then(({ data: session }) => {
      if (!session?.user) { router.push('/login'); return; }
      setForm({
        name:  session.user.name  ?? '',
        email: session.user.email ?? '',
      });
      setRole((session.user as any).role ?? 'STAFF');
      setLoading(false);
    });
  }, [router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await authClient.updateUser({ name: form.name });
    if (error) {
      toast.error('Error al actualizar el perfil');
    } else {
      toast.success('Perfil actualizado correctamente');
    }
    setSaving(false);
  };

  const handleLogout = async () => {
    await authClient.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-7 h-7 border-2 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const initials = form.name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'SN';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Mi Perfil</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gestiona tu información personal y configuración de cuenta
        </p>
      </div>

      {/* Profile Card */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="h-24 bg-linear-to-r from-primary/20 via-primary/10 to-transparent" />
        <div className="px-6 pb-6 -mt-10">
          <div className="flex items-end gap-4 mb-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-primary/15 border-4 border-card flex items-center justify-center shadow-sm">
                <span className="text-2xl font-bold text-primary">{initials}</span>
              </div>
              <button className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary rounded-full flex items-center justify-center shadow hover:bg-primary/90 transition-colors">
                <Camera className="w-3.5 h-3.5 text-primary-foreground" />
              </button>
            </div>
            <div className="pb-1">
              <h2 className="text-xl font-semibold text-foreground">{form.name || 'Admin'}</h2>
              <div className="flex items-center gap-2 mt-1">
                <RoleBadge role={role} />
                <span className="text-xs text-muted-foreground">{form.email}</span>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Nombre completo
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors"
                    placeholder="Tu nombre"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={form.email}
                    disabled
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-input bg-muted/40 text-sm text-muted-foreground cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">El correo no se puede modificar directamente</p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-60"
              >
                {saving
                  ? <div className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                  : <CheckCircle className="w-4 h-4" />}
                Guardar cambios
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <h3 className="font-semibold text-sm text-foreground">Rol y permisos</h3>
          </div>
          <RoleBadge role={role} size="lg" />
          <p className="text-xs text-muted-foreground mt-2">
            {role === 'OWNER'
              ? 'Acceso completo a todas las funcionalidades del panel.'
              : role === 'MANAGER'
              ? 'Acceso a operaciones sin configuración de cuenta.'
              : 'Acceso a operaciones del día a día.'}
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="font-semibold text-sm text-foreground">Organización</h3>
          </div>
          <p className="font-semibold text-foreground">Sierra Nativa Coffee Co.</p>
          <p className="text-xs text-muted-foreground mt-1">Bogotá, Colombia</p>
        </div>
      </div>

      {/* Security */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Key className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground">Seguridad</h3>
            <p className="text-xs text-muted-foreground">Gestiona el acceso a tu cuenta</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Contraseña</p>
              <p className="text-xs text-muted-foreground">Última actualización hace 30 días</p>
            </div>
            <button
              onClick={() => toast.info('Cambio de contraseña próximamente')}
              className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors px-3 py-1.5 rounded-lg hover:bg-primary/10"
            >
              Cambiar
            </button>
          </div>
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Sesión activa</p>
                <p className="text-xs text-muted-foreground">Sesión iniciada en este dispositivo</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs font-semibold text-destructive hover:text-destructive/80 transition-colors px-3 py-1.5 rounded-lg hover:bg-destructive/10"
            >
              <LogOut className="w-3.5 h-3.5" />
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}