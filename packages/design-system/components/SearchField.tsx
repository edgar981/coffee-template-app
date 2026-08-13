// Campo de búsqueda — AGNÓSTICO. Es un `duna-input` con la lupa adentro y NADA
// más: no sabe qué se busca, no guarda la consulta, no filtra ninguna lista.
//
// ── POR QUÉ EL FILTRADO NO ENTRA ─────────────────────────────────────────────
//
// Porque "empatar" es una decisión de dominio, no de forma. Buscar clientes
// empata contra nombre, correo y teléfono —y el teléfono sin normalizar no
// empata—; buscar productos empataría contra SKU. Un filtro adentro obligaría al
// sistema a elegir uno de esos criterios para todos, y la pantalla que necesitara
// otro tendría que pelearse con él. El componente es CONTROLADO: recibe `value`,
// avisa con `onChange`, y quien lo monta decide qué hacer con el texto.
//
// ── POR QUÉ LA LUPA VA INLINE Y NO POR PROP ──────────────────────────────────
//
// El paquete no tiene dependencias (React es peer) y no puede ganar una librería
// de íconos por un ícono. Tampoco se pide por prop: la lupa no es contenido, es
// la señal de que esto es un buscador — un campo de búsqueda al que hay que
// pasarle su propia lupa deja de ser una primitiva y pasa a ser una plantilla.
// El resto de los íconos del sistema (canal, insight) SÍ vienen del consumidor,
// porque ésos sí son contenido.

export interface SearchFieldProps {
  /** El texto actual. Controlado: el dueño de la consulta es la pantalla. */
  value: string;
  /** Avisa el texto nuevo. El DS no decide qué se hace con él. */
  onChange: (value: string) => void;
  /**
   * NOMBRE ACCESIBLE, y es obligatorio a propósito.
   *
   * No hay `<label>` visible —la lupa hace ese trabajo para quien ve— así que sin
   * esto el campo se anuncia como "cuadro de edición" y nada más. El `placeholder`
   * NO sirve de nombre: desaparece al escribir, y varios lectores de pantalla no
   * lo anuncian. Y no lleva default porque este paquete es agnóstico de idioma:
   * un "Buscar" por defecto sería castellano cableado en el sistema.
   */
  label: string;
  /** Pista dentro del campo. Es idioma, por eso viaja por prop. */
  placeholder?: string;
  autoFocus?: boolean;
}

export function SearchField({ value, onChange, label, placeholder, autoFocus }: SearchFieldProps) {
  return (
    <div className="duna-search">
      {/* `aria-hidden`: la lupa es decoración de rol, y el nombre del campo ya lo
          dice `aria-label`. Anunciarla sería repetir. */}
      <svg className="duna-search__ic" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <input
        type="search"
        className="duna-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
    </div>
  );
}
