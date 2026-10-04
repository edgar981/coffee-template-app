'use client';

import { useState } from 'react';
import { Upload, ImageIcon } from 'lucide-react';
import { useSubidaImagen } from '@/components/admin/useSubidaImagen';
import BarraProgreso from '@/components/admin/BarraProgreso';
import { OPCIONES_CTA_DESTINO } from '@/components/admin/tienda-secciones';
import { MAX_SUBIDA_DIRECTA_MB } from '@/constants/upload';
import {
  DESCRIPTOR_INSTANCIA, type InstanciaContent, type SeccionInstanciaTipo,
} from '@/lib/config/secciones-instancias';

// EL FORMULARIO de UNA sección agregada (§ EDITOR-AGREGAR-SECCION-1, docs/editor-tienda/
// AGREGAR-SECCIONES.md, punto 2 del plan). "Reusa `TiendaSeccionEditor`-COMO-PATRÓN" significaba
// esto: la misma FORMA de campo (duna-field + label + hint + input/textarea/select, la misma
// miniatura+Cambiar+Quitar para una imagen) armada DINÁMICAMENTE desde `DESCRIPTOR_INSTANCIA[tipo]`
// — NO literalmente la función `renderCampo` de ese archivo, que tiene semántica HARDCODEADA por
// NOMBRE de campo ajena a este catálogo (p. ej. `campo.name === 'alto'` también escribe
// `alturaLlena`, un campo que ninguna instancia tiene). Un formulario bespoke, genérico por TIPO,
// evita heredar esos casos especiales sin tener que pelearlos uno por uno.
//
// CONTROLADO, sin estado propio ni autoguardado: el dueño (`TiendaPaginas.tsx`) es quien posee
// `seccionesHomeLocal` y el ÚNICO autoguardado de la clave META `seccionesHome` — el mismo criterio
// que ya rige 'orden' (un array, un autoguardado). Cada tecla llama a `onCambiar` con el objeto
// COMPLETO (nunca un parche parcial): es el mismo contrato que exige el puente en vivo
// (`fusionarContenidoInstancia` resuelve el mensaje COMPLETO contra el descriptor, § CLAUDE.md "la
// FRONTERA fina de defaults-como-fallback" aplicada acá — un parche parcial haría que los campos
// AUSENTES del parche cayeran a su default por la rama `opcional`).

const LABEL_CAMPO: Record<string, string> = {
  antetitulo: 'Antetítulo',
  titulo: 'Título',
  texto: 'Texto',
  ctaLabel: 'Botón · texto',
  ctaDestino: 'Botón · destino',
  ctaSecundarioLabel: 'Segundo botón · texto',
  ctaSecundarioDestino: 'Segundo botón · destino',
};
const HINT_CAMPO: Record<string, string> = {
  antetitulo: 'Una línea corta encima del título. Vacío: no se muestra.',
  titulo: 'El título de esta sección.',
  texto: 'El texto que acompaña al título. Vacío: no se muestra.',
  ctaLabel: 'El texto del botón. Vacío: no se muestra.',
  ctaDestino: 'A dónde lleva el botón. Sin destino, no se muestra aunque tenga texto.',
  ctaSecundarioLabel: 'El texto del segundo botón. Vacío: no se muestra.',
  ctaSecundarioDestino: 'A dónde lleva el segundo botón. Sin destino, no se muestra aunque tenga texto.',
};
const LABEL_ESCALAR: Record<string, string> = { alineacion: 'Alineación', lado: 'Lado de la imagen', alto: 'Alto' };
const LABEL_VALOR_ESCALAR: Record<string, Record<string, string>> = {
  alineacion: { izquierda: 'Izquierda', centro: 'Centro', derecha: 'Derecha' },
  lado: { izquierda: 'Izquierda', derecha: 'Derecha' },
  alto: { justo: 'Justo', alto: 'Alto', pantalla: 'Pantalla completa' },
};

export function InstanciaEditorForm({ tipo, instancia, onCambiar }: {
  tipo: SeccionInstanciaTipo;
  instancia: InstanciaContent;
  /** El objeto COMPLETO, siempre — ver el docstring de cabecera. */
  onCambiar: (siguiente: InstanciaContent) => void;
}) {
  const descriptor = DESCRIPTOR_INSTANCIA[tipo];
  const datos = instancia as unknown as Record<string, string>;
  const [errorSubida, setErrorSubida] = useState<string | null>(null);
  const subida = useSubidaImagen({ onError: setErrorSubida });

  const set = (campo: string, valor: string) => onCambiar({ ...instancia, [campo]: valor } as InstanciaContent);

  const camposImagen = new Set(descriptor.imagenes ?? []);
  const camposTexto = Object.entries(descriptor.campos).filter(([campo]) => !camposImagen.has(campo));

  return (
    <div className="admin-bloques">
      <input ref={subida.inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={subida.alElegir} hidden disabled={subida.subiendo} />
      <div className="admin-bloque" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-4)' }}>
        {camposTexto.map(([campo, kind]) => {
          const id = `inst-${campo}`;
          const label = LABEL_CAMPO[campo] ?? campo;
          const hint = HINT_CAMPO[campo] ?? '';
          const value = datos[campo] ?? '';
          const esDestino = campo === 'ctaDestino' || campo === 'ctaSecundarioDestino';
          return (
            <div key={campo} className={`duna-field${campo === 'texto' ? ' duna-form__full' : ''}`}>
              <label className="duna-field__label" htmlFor={id}>
                {label}{kind === 'requerido' && ' *'}
              </label>
              {esDestino ? (
                <select id={id} className="duna-input duna-select" value={value} onChange={(e) => set(campo, e.target.value)}>
                  {OPCIONES_CTA_DESTINO.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : campo === 'texto' ? (
                <textarea id={id} className="duna-input" rows={3} value={value} onChange={(e) => set(campo, e.target.value)} aria-describedby={`${id}-hint`} />
              ) : (
                <input id={id} className="duna-input" value={value} onChange={(e) => set(campo, e.target.value)} aria-describedby={`${id}-hint`} />
              )}
              {hint && <p className="duna-field__hint" id={`${id}-hint`}>{hint}</p>}
            </div>
          );
        })}

        {descriptor.escalares && Object.keys(descriptor.escalares).map((campo) => {
          const id = `inst-${campo}`;
          const def = descriptor.escalares![campo];
          const value = datos[campo] ?? def.canonica;
          const labelesValor = LABEL_VALOR_ESCALAR[campo] ?? {};
          return (
            <div key={campo} className="duna-field">
              <label className="duna-field__label" htmlFor={id}>{LABEL_ESCALAR[campo] ?? campo}</label>
              <select id={id} className="duna-input duna-select" value={value} onChange={(e) => set(campo, e.target.value)}>
                {def.claves.map((v) => <option key={v} value={v}>{labelesValor[v] ?? v}</option>)}
              </select>
            </div>
          );
        })}

        {Array.from(camposImagen).map((campo) => {
          const id = `inst-${campo}`;
          const value = datos[campo] ?? '';
          const subiendoEste = subida.subiendo;
          return (
            <div key={campo} className="duna-field">
              <span className="duna-field__label">Imagen</span>
              <div style={{ display: 'flex', gap: 'var(--duna-space-3)', alignItems: 'flex-start', marginTop: 'var(--duna-space-1)' }}>
                <div className="duna-tile" style={{ width: 'calc(var(--duna-thumb-w) * 2)' }}>
                  {value
                    ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={value} alt="" />
                    : <ImageIcon aria-hidden width={20} height={20} />}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-2)', minWidth: 0 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-2)' }}>
                    <button
                      type="button"
                      onClick={() => subida.pedir((url) => set(campo, url))}
                      className="duna-btn duna-btn--secondary duna-btn--sm"
                      disabled={subida.subiendo}
                      id={id}
                    >
                      <Upload /> {value ? 'Cambiar' : 'Agregar foto'}
                    </button>
                    {value && (
                      <button type="button" onClick={() => set(campo, '')} className="duna-btn duna-btn--ghost duna-btn--sm" disabled={subida.subiendo}>
                        Quitar
                      </button>
                    )}
                  </div>
                  {errorSubida ? (
                    <span className="duna-field__error" role="alert">{errorSubida}</span>
                  ) : (
                    <span className="duna-field__hint" style={{ margin: 0 }}>
                      {subiendoEste ? `Subiendo… ${subida.progreso ?? 0}%` : `JPG, PNG o WebP · máx ${MAX_SUBIDA_DIRECTA_MB} MB. Vacío: no se muestra.`}
                    </span>
                  )}
                  {subiendoEste && <BarraProgreso pct={subida.progreso ?? 0} />}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default InstanciaEditorForm;
