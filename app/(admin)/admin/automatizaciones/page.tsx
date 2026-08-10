'use client';

import { useState, useEffect } from 'react';
import { Zap, Settings2, MessageCircleWarning } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { AUTOMATIONS, type AutomationCanal, type AutomationDef } from '@/constants/automations';
import { getAutomations, saveAutomation, type AutomationEstado } from '@/lib/api/automations';
import { tiempoRelativo } from '@duna/core/format-fecha';
import AutomationConfigDialog from '@/components/admin/AutomationConfigDialog';

// La página RENDERIZA DESDE EL REGISTRY (constants/automations.ts) y le superpone
// el estado guardado que devuelve la API. Añadir una automatización al catálogo la
// hace aparecer aquí sin tocar este archivo — mismo patrón que los widgets del
// dashboard.

const CANAL_LABEL: Record<AutomationCanal, string> = {
  whatsapp: 'WhatsApp',
  email:    'Email',
  interno:  'Campana',
};

const TIPO_LABEL = { evento: 'Por evento', programada: 'Programada' } as const;

export default function Automatizaciones() {
  const [estados, setEstados]   = useState<Record<string, AutomationEstado>>({});
  const [loading, setLoading]   = useState(true);
  const [fallo, setFallo]       = useState(false);
  const [configurando, setConfigurando] = useState<AutomationDef | null>(null);

  const cargar = () => {
    setLoading(true);
    setFallo(false);
    getAutomations()
      .then(lista => setEstados(Object.fromEntries(lista.map(e => [e.key, e]))))
      .catch(() => setFallo(true))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial: el estado lo escriben los callbacks del fetch
  useEffect(cargar, []);

  // ── Derivados ──────────────────────────────────────────────────────────────

  const activas       = AUTOMATIONS.filter(d => estados[d.key]?.activo).length;
  const ejecuciones   = Object.values(estados).reduce((s, e) => s + e.ejecuciones, 0);
  // El canal WhatsApp no está conectado todavía: si hay alguna activa, hay que
  // decirlo — de lo contrario la página aparenta estar enviando mensajes.
  const whatsappActivas = AUTOMATIONS.filter(d => d.canal === 'whatsapp' && estados[d.key]?.activo).length;

  // ── Escritura optimista ────────────────────────────────────────────────────
  // Se pinta el cambio de inmediato y luego se persiste. Si falla, un toast cuyo
  // "Reintentar" reusa el MISMO patch (capturado aquí, no leído de un estado que
  // ya pudo cambiar) y se revierte lo pintado.

  const persistir = (key: string, patch: { activo?: boolean; config?: Record<string, unknown> }, previo: AutomationEstado) => {
    const intentar = () => {
      saveAutomation(key, patch)
        .then(res => setEstados(prev => ({
          ...prev,
          [key]: { ...prev[key], activo: res.activo, config: res.config },
        })))
        .catch(() => {
          setEstados(prev => ({ ...prev, [key]: previo }));
          toast.error('No se pudo guardar la automatización', {
            action: { label: 'Reintentar', onClick: intentar },
          });
        });
    };
    intentar();
  };

  const toggle = (def: AutomationDef) => {
    const previo = estados[def.key];
    if (!previo) return;
    const activo = !previo.activo;
    setEstados(prev => ({ ...prev, [def.key]: { ...previo, activo } }));
    persistir(def.key, { activo }, previo);
  };

  const guardarConfig = (def: AutomationDef, config: Record<string, unknown>) => {
    const previo = estados[def.key];
    if (!previo) return;
    setEstados(prev => ({ ...prev, [def.key]: { ...previo, config } }));
    persistir(def.key, { config }, previo);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Automatizaciones</h1>
        <p className="text-sm text-muted-foreground">Centro de flujos de trabajo automáticos</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card text-center">
          <p className="text-3xl font-bold text-foreground">{activas}</p>
          <p className="text-xs text-muted-foreground mt-1">Flujos activos</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-3xl font-bold">{AUTOMATIONS.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Flujos disponibles</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-3xl font-bold">{ejecuciones}</p>
          <p className="text-xs text-muted-foreground mt-1">Ejecuciones totales</p>
        </div>
      </div>

      {/* Canal WhatsApp sin conectar — honestidad, no UI falsa de "enviado" */}
      {whatsappActivas > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-900/15">
          <MessageCircleWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              Canal WhatsApp pendiente de conexión (Meta)
            </p>
            <p className="text-xs leading-relaxed text-amber-800/80 dark:text-amber-300/80">
              {whatsappActivas === 1 ? 'Hay 1 automatización activa' : `Hay ${whatsappActivas} automatizaciones activas`} por WhatsApp.
              Todo el flujo se ejecuta y queda registrado con el mensaje ya redactado, pero no se envía
              hasta conectar la cuenta de Meta.
            </p>
          </div>
        </div>
      )}

      {fallo && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-4">
          <p className="text-sm text-muted-foreground">No se pudieron cargar las automatizaciones.</p>
          <Button variant="outline" size="sm" onClick={cargar}>Reintentar</Button>
        </div>
      )}

      {/* Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {AUTOMATIONS.map(def => {
          const estado  = estados[def.key];
          const activo  = estado?.activo ?? false;
          const Icon    = def.icono;
          // La API devuelve las 3 más recientes en orden desc; sólo se usa la
          // primera. Se deja que siga mandando tres: cambiar el endpoint por
          // esto acoplaría la forma del dato a una decisión de layout.
          const ultima  = estado?.recientes?.[0];

          return (
            <div
              key={def.key}
              className={`rounded-xl border bg-card p-5 transition-all ${
                activo ? 'border-primary/30 shadow-sm ring-1 ring-primary/10' : 'border-border'
              }`}
            >
              <div className="mb-3 flex items-start justify-between">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${def.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <Switch
                  checked={activo}
                  disabled={loading || !estado}
                  onCheckedChange={() => toggle(def)}
                  aria-label={`${activo ? 'Desactivar' : 'Activar'} ${def.nombre}`}
                />
              </div>

              <h3 className="mb-1 text-sm font-semibold">{def.nombre}</h3>
              <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{def.descripcion}</p>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground/60">Canal:</span>
                  <span className="font-medium text-foreground">{CANAL_LABEL[def.canal]}</span>
                  <span className="text-muted-foreground/60">·</span>
                  <span className="text-muted-foreground">{TIPO_LABEL[def.tipo]}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="shrink-0 text-muted-foreground/60">Disparador:</span>
                  <span className="text-foreground">{def.disparador}</span>
                </div>
              </div>

              {/* Evidencia de vida en UNA línea. La lista de las 3 últimas se
                  retiró: una fecha y un badge por corrida no informan nada
                  accionable —quién quiere el detalle quiere el target, no el
                  timestamp— y hacían crecer la card de forma distinta según
                  cuántas veces hubiera corrido cada automatización, así que la
                  grilla no cerraba. El detalle por corrida, si algún día hace
                  falta, va dentro de "Configurar". */}
              <div className="mt-3 border-t border-border pt-3">
                <p className="text-xs text-muted-foreground">
                  {estado?.ejecuciones ?? 0} {(estado?.ejecuciones ?? 0) === 1 ? 'ejecución' : 'ejecuciones'}
                  {ultima && (
                    <>
                      {' · '}
                      {/* El caso normal no grita y el fallo sí: la última corrida
                          sólo se tiñe cuando FALLÓ, que es lo único que pide una
                          acción. Amber Minimal — el color es información. */}
                      {ultima.estado === 'FALLIDO'
                        ? <span className="font-medium text-destructive">última falló</span>
                        : <>última {tiempoRelativo(ultima.createdAt)}</>}
                    </>
                  )}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <span className={`text-xs font-medium ${activo ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {activo ? 'Activa' : 'Inactiva'}
                </span>
                {def.campos.length > 0 && (
                  <Button
                    variant="outline" size="sm" className="h-7 gap-1.5 text-xs"
                    disabled={!estado}
                    onClick={() => setConfigurando(def)}
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    Configurar
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Diálogo de configuración — `key` lo remonta con la config vigente */}
      {configurando && estados[configurando.key] && (
        <AutomationConfigDialog
          key={`${configurando.key}-${JSON.stringify(estados[configurando.key].config)}`}
          def={configurando}
          config={estados[configurando.key].config}
          open
          onOpenChange={(o) => { if (!o) setConfigurando(null); }}
          onSave={(config) => guardarConfig(configurando, config)}
        />
      )}

      <div className="rounded-xl border border-dashed border-border bg-muted/40 p-8 text-center">
        <Zap className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
        <h3 className="mb-1 text-sm font-semibold">Flujos personalizados</h3>
        <p className="mx-auto max-w-sm text-xs text-muted-foreground">
          Próximamente podrás crear flujos con condiciones y acciones propias.
        </p>
      </div>
    </div>
  );
}
