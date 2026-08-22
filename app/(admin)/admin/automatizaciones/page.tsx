'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AUTOMATIONS, type AutomationDef } from '@/constants/automations';
import {
  getAutomations, saveAutomation, getAutomationHistory,
  type AutomationEstado, type HistorialResp,
} from '@/lib/api/automations';
import type { EstadoVida } from '@/lib/automations/historial';
import { tiempoRelativo } from '@duna/core/format-fecha';
import { Pliegue } from '@/components/admin/Pliegue';
import AutomationConfigDialog from '@/components/admin/AutomationConfigDialog';

// AUTOMATIZACIONES — rejilla de tarjetas, document-scroll (las 8 caben casi de una,
// § CLAUDE.md #22). El operador enciende/apaga, afina en el diálogo de Ajustes, y ve
// lo que cada una HIZO en un acordeón inline. La pantalla existe para que confíe en
// que funcionan cuando no pasa nada.
//
// Las de WhatsApp NO están en `estados`: el endpoint las omite mientras el canal no
// esté operativo (§ waOperativo). Se rinde SÓLO lo que el server devolvió.
//
// DOS ACCESOS DISTINTOS porque son dos cosas distintas: "Ver lo que hizo" es LECTURA
// —acordeón inline, el catálogo sigue visible— y "Ajustes" es EDICIÓN —el diálogo
// que ya existe—.

const DOT_VIDA: Record<EstadoVida, string> = {
  viva:      'var(--duna-ok)',
  sin_casos: 'var(--duna-faint)',
  fallo:     'var(--duna-bad)',
  apagada:   'var(--duna-border-2)',
};

function vidaTexto(e: AutomationEstado): string {
  switch (e.vida) {
    case 'apagada':   return 'Apagada';
    case 'fallo':     return 'Falló · pide tu atención';
    // "Sin casos" a secas: NO hay dato honesto de "desde cuándo vigila"
    // (`AutomationSetting` no guarda cuándo se encendió, y las default-on nunca
    // tocadas ni tienen fila). Sin la fecha, "vigilando" no agrega nada al punto gris.
    case 'sin_casos': return 'Sin casos';
    case 'viva':      return e.ultima ? `Viva · ${tiempoRelativo(e.ultima.createdAt)}` : 'Viva';
  }
}

// ── El historial inline · se pide al MONTARSE, o sea al abrir el acordeón ──────
// El `Pliegue` sólo renderiza sus children cuando está abierto, así que montar acá
// el fetch es lazy por construcción: no se pide el historial de las 8 si no se abre
// ninguno. El fallo se hace VISIBLE con "Reintentar" (§ CLAUDE.md #33: una carga que
// falla en silencio deja la pantalla mostrando lo que el dato no respalda).
function HistorialInline({ automationKey, activo }: { automationKey: string; activo: boolean }) {
  const [fase, setFase]   = useState<'load' | 'ok' | 'err'>('load');
  const [data, setData]   = useState<HistorialResp | null>(null);
  const [intento, setInt] = useState(0);

  useEffect(() => {
    // fase arranca en 'load' (useState) y el reintento la re-pone en su handler,
    // así que acá NO se setea 'load' síncrono (§ backlog #27, cascading renders).
    let vivo = true;
    getAutomationHistory(automationKey)
      .then(d => { if (vivo) { setData(d); setFase('ok'); } })
      .catch(() => { if (vivo) setFase('err'); });
    return () => { vivo = false; };
  }, [automationKey, intento]);

  if (fase === 'load') return <p className="duna-caption">Cargando…</p>;
  if (fase === 'err') return (
    <p className="duna-caption">
      No se pudo cargar el historial.{' '}
      <button type="button" className="duna-link" style={{ fontSize: 'inherit' }} onClick={() => { setFase('load'); setInt(n => n + 1); }}>
        Reintentar
      </button>
    </p>
  );
  if (!data || data.entradas.length === 0) return (
    // El vacío HABLA, y distinto según el estado: encendida y esperando NO es lo
    // mismo que apagada y sin trabajar.
    <p className="duna-caption" style={{ lineHeight: 1.5 }}>
      {activo
        ? 'Nada todavía, y eso es información: está encendida y vigilando, pero no ha pasado lo que vigila. La primera vez que actúe aparecerá aquí.'
        : 'Apagada — no ha hecho nada porque no está trabajando. Enciéndela y este historial empezará a escribirse.'}
    </p>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-3)' }}>
      {data.entradas.map((e, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span className="duna-body-sm" style={{ color: 'var(--duna-ink-2)' }}>
            {e.href ? <Link href={e.href} className="duna-link">{e.sobreQue}</Link> : e.sobreQue}
          </span>
          <span className="duna-caption" style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)' }}>
            <span>{tiempoRelativo(e.cuando)}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: e.resultado === 'fallo' ? 'var(--duna-bad-ink)' : 'var(--duna-muted)' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: e.resultado === 'fallo' ? 'var(--duna-bad)' : 'var(--duna-ok)', flexShrink: 0 }} />
              {e.resultadoLabel}
            </span>
          </span>
        </div>
      ))}
      {data.hayMas && (
        <p className="duna-caption" style={{ color: 'var(--duna-faint)' }}>
          Mostrando las últimas {data.entradas.length}.
        </p>
      )}
    </div>
  );
}

function Tarjeta({ def, estado, onToggle, onAjustes }: {
  def: AutomationDef;
  estado: AutomationEstado;
  onToggle: () => void;
  onAjustes: () => void;
}) {
  const activo = estado.activo;
  const frase  = def.frase ? def.frase(estado.config) : def.disparador;

  return (
    <div className="duna-card duna-card__pad" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--duna-space-3)' }}>
        <h3 className="duna-title" style={{ flex: 1, minWidth: 0, fontSize: 'var(--duna-text-body)', color: activo ? undefined : 'var(--duna-muted)' }}>
          {def.nombre}
        </h3>
        <button
          type="button"
          className={`duna-switch${activo ? ' is-on' : ''}`}
          aria-label={`${activo ? 'Apagar' : 'Encender'} ${def.nombre}`}
          aria-pressed={activo}
          onClick={onToggle}
        >
          <span className="duna-switch__thumb" />
        </button>
      </div>

      <p className="duna-sub" style={{ marginTop: 'var(--duna-space-2)' }}>{frase}</p>
      {def.silencio && (
        <p className="duna-caption" style={{ marginTop: 'var(--duna-space-1)' }}>{def.silencio}</p>
      )}

      {/* Foot: señal de vida + Ajustes. `marginTop: auto` lo ancla abajo. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', marginTop: 'auto', paddingTop: 'var(--duna-space-4)' }}>
        <div className="duna-caption" style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: DOT_VIDA[estado.vida], flexShrink: 0 }} />
          <span style={{ color: estado.vida === 'fallo' ? 'var(--duna-bad-ink)' : 'var(--duna-muted)', fontWeight: estado.vida === 'fallo' ? 600 : undefined }}>
            {vidaTexto(estado)}
          </span>
        </div>
        {/* Ajustes SÓLO si hay algo que afinar: `orden_recibida` no tiene campos, y
            un botón que abre un diálogo vacío es una pregunta sin respuesta. */}
        {def.campos.length > 0 && (
          <button type="button" className="duna-btn duna-btn--ghost duna-btn--sm" onClick={onAjustes}>
            Ajustes
          </button>
        )}
      </div>

      {/* "Ver lo que hizo" — acordeón inline (LECTURA), el catálogo sigue visible. */}
      <Pliegue label="Ver lo que hizo" className="mt-3 pt-3 border-t border-border">
        <HistorialInline automationKey={def.key} activo={activo} />
      </Pliegue>
    </div>
  );
}

function Grupo({ titulo, hecho, defs, estados, onToggle, onAjustes }: {
  titulo: string;
  hecho: string;
  defs: AutomationDef[];
  estados: Record<string, AutomationEstado>;
  onToggle: (def: AutomationDef) => void;
  onAjustes: (def: AutomationDef) => void;
}) {
  if (defs.length === 0) return null;
  return (
    <section style={{ marginTop: 'var(--duna-space-6)' }}>
      <div style={{ marginBottom: 'var(--duna-space-3)' }}>
        <h2 className="duna-heading">{titulo}</h2>
        <p className="duna-sub" style={{ marginTop: '1px' }}>{hecho}</p>
      </div>
      {/* items-start: al abrir un acordeón, sólo crece ESA tarjeta — no estira a
          sus vecinas de fila (lo que haría el `stretch` por defecto del grid). */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
        {defs.map(def => (
          <Tarjeta
            key={def.key} def={def} estado={estados[def.key]}
            onToggle={() => onToggle(def)} onAjustes={() => onAjustes(def)}
          />
        ))}
      </div>
    </section>
  );
}

export default function Automatizaciones() {
  const [estados, setEstados]           = useState<Record<string, AutomationEstado>>({});
  const [loading, setLoading]           = useState(true);
  const [fallo, setFallo]               = useState(false);
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

  // ── Escritura optimista ──────────────────────────────────────────────────
  // Se pinta el cambio y luego se persiste; si falla, un toast con "Reintentar"
  // (que reusa el MISMO patch capturado) y se revierte. El switch es escritura
  // absoluta y responde antes que el server: sin guarda de doble-submit a
  // propósito (§ CLAUDE.md — la frontera del patrón).
  const persistir = (key: string, patch: { activo?: boolean; config?: Record<string, unknown> }, previo: AutomationEstado) => {
    const intentar = () => {
      saveAutomation(key, patch)
        .then(res => setEstados(prev => ({ ...prev, [key]: { ...prev[key], activo: res.activo, config: res.config } })))
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
    setEstados(prev => ({ ...prev, [def.key]: { ...previo, activo, vida: activo ? previo.vida : 'apagada' } }));
    persistir(def.key, { activo }, previo);
  };

  const guardarConfig = (def: AutomationDef, config: Record<string, unknown>) => {
    const previo = estados[def.key];
    if (!previo) return;
    setEstados(prev => ({ ...prev, [def.key]: { ...previo, config } }));
    persistir(def.key, { config }, previo);
  };

  // Sólo lo que el server devolvió (WhatsApp ya viene omitido, § waOperativo).
  const internas = AUTOMATIONS.filter(d => d.canal === 'interno' && estados[d.key]);
  const correos  = AUTOMATIONS.filter(d => d.canal === 'email'   && estados[d.key]);
  const conFallo = [...internas, ...correos].filter(d => estados[d.key]?.vida === 'fallo');

  return (
    <div>
      <div className="duna-eyebrow">Crecimiento</div>
      <h1 className="duna-display-m" style={{ marginTop: '2px' }}>Automatizaciones</h1>
      <p className="duna-sub" style={{ marginTop: '3px', maxWidth: '46rem' }}>
        Las tareas que el sistema hace solo: vigilar y avisar. Sólo observan — ninguna
        cobra, despacha ni cancela. Un aviso roto nunca puede romper una venta.
      </p>

      {/* Roll-up de fallo: el único vital, y sólo cuando hay algo roto. Una tarjeta
          con fallo puede quedar fuera de vista; esto lo dice arriba. Rojo, no ámbar. */}
      {conFallo.length > 0 && (
        <div
          role="alert"
          style={{
            display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)',
            marginTop: 'var(--duna-space-4)', padding: '9px 14px',
            border: '1px solid var(--duna-bad)', borderRadius: 'var(--duna-r-m)',
            background: 'var(--duna-bad-soft)', width: 'fit-content',
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--duna-bad)', flexShrink: 0 }} />
          <span className="duna-body-sm" style={{ color: 'var(--duna-ink-2)' }}>
            <b style={{ color: 'var(--duna-bad-ink)' }}>
              {conFallo.length === 1 ? 'Una automatización falló' : `${conFallo.length} automatizaciones fallaron`}:
            </b>{' '}
            {conFallo.map(d => d.nombre).join(', ')}. Es lo único aquí que pide una acción.
          </span>
        </div>
      )}

      {fallo && (
        <div className="duna-card duna-card__pad" style={{ marginTop: 'var(--duna-space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--duna-space-3)' }}>
          <p className="duna-sub" style={{ margin: 0 }}>No se pudieron cargar las automatizaciones.</p>
          <button type="button" className="duna-btn duna-btn--secondary duna-btn--sm" onClick={cargar}>Reintentar</button>
        </div>
      )}

      {!fallo && !loading && (
        <>
          <Grupo
            titulo="Vigilan el negocio y avisan al equipo en el panel"
            hecho="Nacen encendidas: no cuestan nada y no dependen de nadie externo."
            defs={internas} estados={estados} onToggle={toggle} onAjustes={setConfigurando}
          />
          <Grupo
            titulo="Le mandan un correo al equipo"
            hecho="Nacen apagadas: salen de la casa."
            defs={correos} estados={estados} onToggle={toggle} onAjustes={setConfigurando}
          />
        </>
      )}

      {/* Ajustes: el diálogo que YA existe (shadcn, intacto — su migración a
          DunaDialog es otra tanda, § backlog). `key` lo remonta con la config vigente. */}
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
    </div>
  );
}
