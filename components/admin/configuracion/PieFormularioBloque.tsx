'use client';

// El pie de CADA formulario de bloque: Guardar / Cancelar / error del servidor — el mismo patrón
// que ya tenía `DatosNegocioSeccion`, extraído para los cuatro bloques de SiteSetting.

export function PieFormularioBloque({ enVuelo, onCancelar, errorServidor }: {
  enVuelo:        boolean;
  onCancelar:     () => void;
  errorServidor:  string | null;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-3)' }}>
      <button type="submit" className="duna-btn duna-btn--primary" disabled={enVuelo}>
        {enVuelo ? 'Guardando…' : 'Guardar cambios'}
      </button>
      <button type="button" onClick={onCancelar} className="duna-btn duna-btn--ghost" disabled={enVuelo}>
        Cancelar
      </button>
      {errorServidor && (
        <p className="duna-field__error" role="alert" style={{ margin: 0 }}>{errorServidor}</p>
      )}
    </div>
  );
}
