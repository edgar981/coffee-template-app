'use client';

import { Plus, Undo2, X } from 'lucide-react';
import { opcionesVivas, type MoliendaOpcion, type ProblemaOpciones } from '@duna/core/moliendas-opciones';

// ─── Opciones de molienda para el cliente ────────────────────────────────────
// La UI que faltaba: el tipo prometía "el admin activa nuevas moliendas con
// `disponible` — sin cambios de código" y hasta hoy la única vía era un UPDATE a
// mano sobre el Json.
//
// OJO — este editor gestiona `Product.moliendasOpciones` (lo que el CLIENTE elige
// en la página de producto) y NO `Product.molienda` (ficha técnica: "esta bolsa es
// molienda Media"). Son campos distintos; de ahí el label largo.
//
// Editar esto es OPERAR LA TIENDA, no llenar un campo de la ficha: con el fix
// híbrido-por-cardinalidad, cuántas opciones queden disponibles decide si la card
// del catálogo agrega directo o manda al detalle a elegir. Por eso la ayuda no es
// decorativa — es la única parte de la pantalla que dice qué se está cambiando.
//
// ── CONTROLES DUNA, Y SE MIGRÓ EN EL SITIO ──────────────────────────────────
//
// Este editor lo montan las DOS pantallas de producto —la vieja, que todavía es
// un diálogo shadcn, y el drawer Duna nuevo—, así que la migración lo mete en una
// superficie vieja. Es la mezcla que H6 ya decidió aceptar, y en la dirección que
// declaró preferible: "un control nuevo en una pantalla vieja se lee como
// PROMESA; un control viejo dentro de una superficie nueva se lee como DEUDA".
// Una copia Duna al lado sería una segunda definición de las mismas reglas — que
// es lo que este repo lleva cuatro secciones documentando como el modo de falla.
// La mezcla desaparece cuando la pantalla vieja se retire.
//
// ── EL TOGGLE ES `.duna-switch` + `role="switch"`, opción C ─────────────────
//
// El paquete pone la FORMA (la cápsula y su pulgar) y el consumidor la CONDUCTA
// (el rol, el estado y el clic). No se cambió a checkbox: `disponible` se lee como
// el interruptor de una fila y así lo enseñó la pantalla vieja; convertirlo en
// casilla sería rediseñar mientras se migra. Un `<button>` responde a Enter y
// Espacio sin un handler de teclado escrito a mano.

interface Props {
  opciones: MoliendaOpcion[];
  onChange: (opciones: MoliendaOpcion[]) => void;
  /**
   * Índices marcados para quitar AL GUARDAR. Quitar es deshacible hasta entonces
   * (decisión del owner): la fila se queda a la vista, tachada y con "Deshacer".
   */
  quitadas: Set<number>;
  onToggleQuitada: (i: number) => void;
  /** Problemas ya calculados por `validarOpciones`. Se pintan al intentar guardar. */
  problemas: ProblemaOpciones[];
  /** Bloquea la edición mientras la mutación viaja (la mitad de estado de la guarda). */
  disabled?: boolean;
}

export function MoliendasOpcionesEditor({
  opciones, onChange, quitadas, onToggleQuitada, problemas, disabled,
}: Props) {
  // Los conteos hablan del RESULTADO de guardar, no de lo que hay en pantalla:
  // una fila marcada ya no cuenta como opción ni como disponible. Si contara, la
  // línea diría "1 disponible" mientras el guardado deja cero.
  const vivas       = opcionesVivas(opciones, quitadas);
  const disponibles = vivas.filter(o => o.disponible).length;
  // Filas señaladas por algún problema, para el borde de alerta. Un Set porque una
  // fila puede aparecer en dos problemas (sin nombre Y repetida).
  const filasConProblema = new Set(problemas.flatMap(p => p.indices));

  const actualizar = (i: number, patch: Partial<MoliendaOpcion>) =>
    onChange(opciones.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));

  // Agregar APENDIZA — nunca reordena ni reindexa, que es lo que mantiene válidos
  // los índices de `quitadas` mientras el modal está abierto.
  const agregar = () => onChange([...opciones, { nombre: '', metodo: '', disponible: true }]);

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <span className="duna-field__label">Opciones de molienda para el cliente</span>
      <p className="duna-caption" style={{ margin: 'var(--duna-space-hairline) 0 0' }}>
        {vivas.length === 0
          ? 'Sin opciones — este producto no pide molienda.'
          : `${vivas.length} ${vivas.length === 1 ? 'opción' : 'opciones'} · ${disponibles} disponible${disponibles === 1 ? '' : 's'}`}
        {quitadas.size > 0 && ` · ${quitadas.size} se ${quitadas.size === 1 ? 'quitará' : 'quitarán'} al guardar`}
      </p>

      {opciones.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-2)', marginTop: 'var(--duna-space-2)' }}>
          {/* key por índice, y acá es SEGURO y no una concesión: con el quitar
              diferido nada se reindexa mientras el modal está abierto —agregar
              apendiza, quitar solo marca— así que el índice de una fila no cambia
              nunca. Es la misma propiedad que hace estable al Set de `quitadas`.
              Si alguna vez se agrega reordenamiento, esto necesita un id propio. */}
          {opciones.map((opcion, i) => {
            const quitada  = quitadas.has(i);
            const conProblema = !quitada && filasConProblema.has(i);
            const etiqueta = opcion.nombre || 'esta molienda';
            const tachado  = quitada ? { textDecoration: 'line-through' as const, opacity: .6 } : undefined;
            return (
              <div
                key={i}
                style={{
                  display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 'var(--duna-space-2)',
                  padding: 'var(--duna-space-2)', borderRadius: 'var(--duna-r-m)',
                  background: 'var(--duna-surface-2)',
                  border: `1px ${quitada ? 'dashed' : 'solid'} ${conProblema ? 'var(--duna-bad)' : 'var(--duna-border)'}`,
                }}
              >
                <div className="duna-field" style={{ minWidth: '140px', flex: 1 }}>
                  <span className="duna-field__label">Nombre</span>
                  <input
                    className="duna-input"
                    value={opcion.nombre}
                    onChange={e => actualizar(i, { nombre: e.target.value })}
                    disabled={disabled || quitada}
                    aria-invalid={conProblema || undefined}
                    style={tachado}
                    placeholder="Media"
                  />
                </div>
                <div className="duna-field" style={{ minWidth: '160px', flex: 1.4 }}>
                  <span className="duna-field__label">Método (texto del chip)</span>
                  <input
                    className="duna-input"
                    value={opcion.metodo}
                    onChange={e => actualizar(i, { metodo: e.target.value })}
                    disabled={disabled || quitada}
                    style={tachado}
                    placeholder="Filtro / Greca tradicional"
                  />
                </div>
                {/* El toggle es la decisión real de esta pantalla: `disponible` es lo
                    que el storefront cuenta para decidir card vs. detalle. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', flexShrink: 0, paddingBottom: 'var(--duna-space-2)' }}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={opcion.disponible}
                    aria-label={`Disponible: ${opcion.nombre || 'molienda sin nombre'}`}
                    disabled={disabled || quitada}
                    onClick={() => actualizar(i, { disponible: !opcion.disponible })}
                    className={`duna-switch${opcion.disponible ? ' is-on' : ''}`}
                  >
                    <span className="duna-switch__thumb" />
                  </button>
                  <span className="duna-caption" style={quitada ? { opacity: .6 } : undefined}>Disponible</span>
                </div>
                {/* La X marca, no borra. Se vuelve "Deshacer" en el MISMO lugar para
                    que la corrección esté donde el dedo ya está.

                    VA GHOST Y NO `--danger`, y el cambio es respecto de la versión
                    shadcn, que usaba `destructiveGhost`. Ese tratamiento es anterior
                    a la regla que H6 fijó: «destructivo = quita algo que no se puede
                    recuperar desde el panel». Esta X es lo contrario — es DESHACIBLE
                    hasta guardar, la fila se queda a la vista y el botón de al lado
                    dice "Deshacer". Pintarla de alerta le pondría el color de lo
                    irreversible a la acción más reversible del formulario, que es
                    exactamente lo que diluye el rojo. Mismo criterio con el que
                    "Marcar fallido" y "Rechazar comprobante" no van en rojo. */}
                <button
                  type="button"
                  className="duna-btn duna-btn--sm duna-btn--ghost"
                  style={{ flexShrink: 0, marginBottom: 'var(--duna-space-hairline)' }}
                  onClick={() => onToggleQuitada(i)}
                  disabled={disabled}
                  aria-label={quitada ? `Deshacer: conservar ${etiqueta}` : `Quitar ${etiqueta}`}
                >
                  {quitada ? <><Undo2 /> Deshacer</> : <X />}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        className="duna-btn duna-btn--secondary duna-btn--sm"
        style={{ marginTop: 'var(--duna-space-2)' }}
        onClick={agregar}
        disabled={disabled}
      >
        <Plus /> Agregar molienda
      </button>

      {/* La línea que explica QUÉ controla esto. Sin ella, el operador cambia un
          toggle y el comportamiento de la tienda cambia sin que nada lo anuncie. */}
      <p className="duna-caption" style={{ marginTop: 'var(--duna-space-2)' }}>
        Con una sola molienda disponible, la tarjeta de la tienda agrega directo; con
        varias, lleva al detalle para elegir.
      </p>

      {problemas.length > 0 && (
        <ul style={{ margin: 'var(--duna-space-1) 0 0', paddingLeft: 'var(--duna-space-4)' }}>
          {problemas.map(p => (
            <li key={p.codigo} className="duna-field__error">{p.mensaje}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
