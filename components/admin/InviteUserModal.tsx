'use client';

import { useState } from 'react';
import { X, UserPlus, Mail } from 'lucide-react';
import { toast } from 'sonner';
import RoleBadge from '@/components/admin/RoleBadge';

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = 'OWNER' | 'MANAGER' | 'STAFF';

interface InviteUserModalProps {
  onClose:   () => void;
  onSuccess: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES: Role[] = ['OWNER', 'MANAGER', 'STAFF'];

const roleDescriptions: Record<Role, string> = {
  OWNER:   'Acceso total: configuración, datos críticos y gestión del equipo.',
  MANAGER: 'Operaciones, inventario, clientes y reportes. Sin configuración crítica.',
  STAFF:   'Solo gestión de órdenes y operaciones del día a día.',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function InviteUserModal({ onClose, onSuccess }: InviteUserModalProps) {
  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [role, setRole]       = useState<Role>('STAFF');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !name.trim()) return;
    setLoading(true);

    try {
      const res = await fetch('/api/users/invite', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim(), name: name.trim(), role }),
      });

      if (!res.ok) {
        if (res.status === 403) {
          toast.error('No tienes permiso para invitar usuarios.');
        } else if (res.status === 400) {
          const data = await res.json().catch(() => null);
          toast.error(data?.error || 'Verifica los datos e intenta de nuevo.');
        } else {
          toast.error('No se pudo enviar la invitación. Intenta de nuevo.');
        }
        return;
      }

      toast.success(`Invitación enviada a ${email}`);
      onSuccess();
    } catch {
      toast.error('No se pudo conectar. Verifica tu conexión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <UserPlus className="w-4.5 h-4.5 text-primary" style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Agregar usuario</h2>
              <p className="text-xs text-muted-foreground">Crea acceso al panel para un colaborador</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted text-muted-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Nombre completo
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                placeholder="María García"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Correo electrónico
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="colaborador@restaurante.co"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors"
              />
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Rol asignado
            </label>
            <div className="space-y-2">
              {ROLES.map(r => (
                <label
                  key={r}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    role === r
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r}
                    checked={role === r}
                    onChange={() => setRole(r)}
                    className="mt-0.5 accent-primary shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <RoleBadge role={r} />
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {roleDescriptions[r]}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !email.trim() || !name.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {loading
                ? <div className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                : <UserPlus className="w-4 h-4" />}
              Crear usuario
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}