'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { AUTOMATIONS, type AutomationDef } from '@/constants/automations';
import { getAutomations, saveAutomation, type AutomationEstado } from '@/lib/api/automations';
import type { EstadoVida } from '@/lib/automations/historial';
import { tiempoRelativo } from '@duna/core/format-fecha';

// AUTOMATIZACIONES — rejilla de tarjetas, document-scroll (las 8 caben casi de una,
// § CLAUDE.md #22). El operador enciende/apaga y afina; la pantalla existe para que
// confíe en que funcionan cuando no pasa nada.
//
// Las de WhatsApp NO están en `estados`: el endpoint las omite mientras el canal no
// esté operativo (§ waOperativo). Se rinde SÓLO lo que el server devolvió.
//
// El acceso a "Ver lo que hizo" (acordeón) y a "Ajustes" (diálogo) entra en el
// commit 4; esta pantalla es la rejilla informativa + el switch.

// El punto de la señal de vida, por estado. Cero ámbar: `sin_casos` es gris (faint),
// no atención — sólo el fallo pide acción, y va rojo (bad).
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
    // tocadas ni tienen fila). "vigilando" sin la fecha no agrega nada que el
    // punto gris no diga ya, así que se recorta en vez de inventar la fecha.
    case 'sin_casos': return 'Sin casos';
    case 'viva':      return e.ultima ? `Viva · ${tiempoRelativo(e.ultima.createdAt)}` : 'Viva';
  }
}

function Tarjeta({ def, estado, onToggle }: {
  def: AutomationDef;
  estado: AutomationEstado;
  onToggle: () => void;
}) {
  const activo = estado.activo;
  // La frase de disparo CON EL VALOR configurado (§ constants/automations `frase`).
  // Si el operador cambia el umbral, la tarjeta lo dice sin abrir el diálogo.
  const frase = def.frase ? def.frase(estado.config) : def.disparador;

  return (
    <div className="duna-card duna-card__pad" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Nombre + switch. Sin chip pastel, sin ícono en la tarjeta (el ícono del
          registry se QUEDA: lo lee la campana por tipo), sin etiqueta Activa/Inactiva
          —el switch ya lo dice—. */}
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

      {/* Disparo (con valor) y regla de silencio (hecho declarado). */}
      <p className="duna-sub" style={{ marginTop: 'var(--duna-space-2)' }}>{frase}</p>
      {def.silencio && (
        <p className="duna-caption" style={{ marginTop: 'var(--duna-space-1)' }}>{def.silencio}</p>
      )}

      {/* Señal de vida, al pie. */}
      <div
        className="duna-caption"
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', marginTop: 'auto', paddingTop: 'var(--duna-space-4)' }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: DOT_VIDA[estado.vida], flexShrink: 0 }} />
        <span style={{ color: estado.vida === 'fallo' ? 'var(--duna-bad-ink)' : 'var(--duna-muted)', fontWeight: estado.vida === 'fallo' ? 600 : undefined }}>
          {vidaTexto(estado)}
        </span>
      </div>
    </div>
  );
}

function Grupo({ titulo, hecho, defs, estados, onToggle }: {
  titulo: string;
  hecho: string;
  defs: AutomationDef[];
  estados: Record<string, AutomationEstado>;
  onToggle: (def: AutomationDef) => void;
}) {
  if (defs.length === 0) return null;
  return (
    <section style={{ marginTop: 'var(--duna-space-6)' }}>
      <div style={{ marginBottom: 'var(--duna-space-3)' }}>
        <h2 className="duna-heading">{titulo}</h2>
        <p className="duna-sub" style={{ marginTop: '1px' }}>{hecho}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {defs.map(def => (
          <Tarjeta key={def.key} def={def} estado={estados[def.key]} onToggle={() => onToggle(def)} />
        ))}
      </div>
    </section>
  );
}

export default function Automatizaciones() {
  const [estados, setEstados] = useState<Record<string, AutomationEstado>>({});
  const [loading, setLoading] = useState(true);
  const [fallo, setFallo]     = useState(false);

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
  // absoluta y el control responde antes que el server: sin guarda de doble-submit
  // a propósito (§ CLAUDE.md — la frontera del patrón).
  const persistir = (key: string, activo: boolean, previo: AutomationEstado) => {
    const intentar = () => {
      saveAutomation(key, { activo })
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
    // Al apagar/encender, la señal de vida deriva sola en el próximo fetch; acá se
    // refleja el `activo` de inmediato (la vida se recalcula server-side).
    setEstados(prev => ({ ...prev, [def.key]: { ...previo, activo, vida: activo ? previo.vida : 'apagada' } }));
    persistir(def.key, activo, previo);
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
          con fallo puede quedar fuera de vista; esto lo dice arriba. Rojo (bad), no
          ámbar. */}
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
            defs={internas} estados={estados} onToggle={toggle}
          />
          <Grupo
            titulo="Le mandan un correo al equipo"
            hecho="Nacen apagadas: salen de la casa."
            defs={correos} estados={estados} onToggle={toggle}
          />
        </>
      )}
    </div>
  );
}
