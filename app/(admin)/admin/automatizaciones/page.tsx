'use client';

import { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { AUTOMATION_TEMPLATES } from '@/lib/mock/automations';
import { getAutomations, toggleAutomation } from '@/lib/api/automations';
import type { Automation } from '@/types/automation';
import type { LucideIcon } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

type AutomationCanal = 'whatsapp' | 'email' | 'interno' | 'sms';

const CANAL_LABELS: Record<AutomationCanal, string> = {
  whatsapp: '📱 WhatsApp',
  email:    '✉️ Email',
  interno:  '🔔 Interno',
  sms:      '💬 SMS',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Automatizaciones() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    getAutomations().then(data => { setAutomations(data); setLoading(false); });
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────

  const getAutomation = (tipo: string): Automation | undefined =>
    automations.find(a => a.tipo === tipo);

  const activeCount      = automations.filter(a => a.activa).length;
  const totalExecutions  = automations.reduce((sum, a) => sum + a.veces_ejecutada, 0);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleToggle = async (template: Automation) => {
    const updated = await toggleAutomation(template.tipo);
    setAutomations(updated);

    const isNowActive = updated.find(a => a.tipo === template.tipo)?.activa ?? false;
    toast.success(
      isNowActive
        ? `${template.nombre} activada`
        : `${template.nombre} desactivada`
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Automatizaciones</h1>
        <p className="text-sm text-muted-foreground">Centro de flujos de trabajo automáticos</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card text-center">
          <p className="text-3xl font-bold text-primary">{activeCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Flujos Activos</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-3xl font-bold">{AUTOMATION_TEMPLATES.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Flujos Disponibles</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-3xl font-bold text-emerald-600">{totalExecutions}</p>
          <p className="text-xs text-muted-foreground mt-1">Ejecuciones Totales</p>
        </div>
      </div>

      {/* Active banner */}
      {activeCount > 0 && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center">
            <Zap className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-400">
              {activeCount} automatización{activeCount > 1 ? 'es' : ''} activa{activeCount > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-500">
              Tu negocio está operando en piloto automático en los flujos habilitados.
            </p>
          </div>
        </div>
      )}

      {/* Cards */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando automatizaciones...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {AUTOMATION_TEMPLATES.map(template => {
            const existing = getAutomation(template.tipo);
            const isActive = existing?.activa ?? false;
            const Icon     = template.icon as LucideIcon;

            return (
              <div
                key={template.tipo}
                className={`bg-card border rounded-xl p-5 transition-all ${
                  isActive
                    ? 'border-primary/30 shadow-sm ring-1 ring-primary/10'
                    : 'border-border'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${template.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <Switch
                    checked={isActive}
                    onCheckedChange={() => handleToggle(existing ?? template)}
                  />
                </div>

                <h3 className="font-semibold text-sm mb-1">{template.nombre}</h3>
                <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{template.descripcion}</p>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="text-muted-foreground/60">Canal:</span>
                    <span className="font-medium text-foreground">
                      {CANAL_LABELS[template.canal as AutomationCanal] ?? template.canal}
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="text-muted-foreground/60 shrink-0">Disparador:</span>
                    <span className="text-foreground">{template.condicion}</span>
                  </div>
                  {(existing?.veces_ejecutada ?? 0) > 0 && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="text-muted-foreground/60">Ejecuciones:</span>
                      <span className="font-medium text-emerald-600">{existing?.veces_ejecutada}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {isActive ? '● Activo' : '○ Inactivo'}
                  </span>
                  {existing?.ultima_ejecucion && (
                    <span className="text-xs text-muted-foreground">
                      Último: {new Date(existing.ultima_ejecucion).toLocaleDateString('es-CO')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Coming soon */}
      <div className="bg-muted/40 border border-dashed border-border rounded-xl p-8 text-center">
        <Zap className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
        <h3 className="font-semibold text-sm mb-1">Flujos Personalizados</h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Próximamente podrás crear flujos de automatización personalizados con condiciones y acciones avanzadas.
        </p>
      </div>
    </div>
  );
}