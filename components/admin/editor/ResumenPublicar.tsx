'use client';

import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useContenedorDunaPortal } from '@/components/admin/dunaPortal';
import type { CambioResumen } from '@/lib/admin/resumen-cambios';

// § EDITOR-TIENDA-PUBLICAR-RESUMEN-1 (docs/editor-tienda/REDISENO.md § 3/§ 9, slice 8). El botón
// «Publicar» de la barra deja de ser un gesto a ciegas: cuenta los cambios y, al tocarlo, abre un
// POPOVER que los lista EN PALABRAS —«Hero · Titular · nuevo», «Hero · Composición «Portada»»,
// «Nosotros · Tercer párrafo · nuevo»— antes de publicar nada. «Publicar» y «Descartar todo» viven
// ACÁ DENTRO (el spec: "con publicar todo o descartar"), no sueltos en la barra: las dos acciones
// actúan sobre la MISMA lista que el popover ya muestra, así que tiene que ser el mismo sitio.
//
// EL RESUMEN SE CALCULA AL ABRIR (`cargarResumen`, un fetch — § `TiendaPaginas.resumenPendientes`),
// no en cada render: comparar borrador contra publicado cuesta dos llamadas de red, y el botón se
// clickea mucho menos de lo que el panel re-renderiza (cada tecla del formulario, cada mensaje del
// iframe). Abrir el popover sin haber cargado todavía muestra "Calculando…", nunca una lista vieja.
//
// EL ÁMBAR ES SÓLO PARA LO QUE ESPERA PUBLICARSE (§ CLAUDE.md, "el ámbar es MARCA/DATO o ESTADO
// según el SITIO"; REDISENO.md § 3: "El ámbar se usa solo para lo que espera publicarse"): el
// recuento vive en un `duna-badge--attention` DENTRO del botón, que por lo demás sigue siendo el
// primario de siempre (`duna-btn--primary`) — el botón no se vuelve ámbar entero.
export interface ResumenPublicarProps {
  /** Cuántas claves (secciones + 'orden' + 'tema') tienen borrador — el número del badge. */
  pendientes: number;
  /** `true` mientras el autoguardado no asentó, o mientras ya se está publicando/descartando: el
   *  botón y las dos acciones del popover quedan deshabilitados, como ya pasaba antes de esta
   *  tanda (§ `EditorTiendaPantallaCompleta.tsx`, el `disabled` de los botones viejos). */
  deshabilitado: boolean;
  /** `true` mientras `onPublicar`/`onDescartar` está en vuelo — cambia el texto del botón a
   *  "Publicando…", igual que el botón viejo. */
  procesando: boolean;
  /** Pide la lista EN PALABRAS — `TiendaPaginasHandle.resumenPendientes`. Puede lanzar (fetch
   *  caído); el popover lo muestra inline, nunca deja la lista vieja puesta. */
  cargarResumen: () => Promise<CambioResumen[]>;
  /** Publica TODO lo pendiente — el MISMO `publicarTodo` que ya mostraba su propio toast de éxito/
   *  error; este componente no duplica ese aviso, sólo cierra el popover al terminar. */
  onPublicar: () => Promise<void>;
  /** Gemelo de `onPublicar` para descartar. */
  onDescartar: () => Promise<void>;
  /** Tocar una fila de la lista navega a ese elemento en el lienzo (§ el spec) — resuelto por
   *  `EditorTiendaPantallaCompleta`/`TiendaPaginas.irAItem`; este componente sólo manda la `clave`. */
  onIrAItem: (clave: string) => void;
}

export function ResumenPublicar({
  pendientes, deshabilitado, procesando, cargarResumen, onPublicar, onDescartar, onIrAItem,
}: ResumenPublicarProps) {
  const contenedor = useContenedorDunaPortal();
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [cambios, setCambios] = useState<CambioResumen[] | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const alAbrir = (o: boolean) => {
    setAbierto(o);
    if (!o) return;
    setCargando(true);
    setErrorCarga(null);
    cargarResumen()
      .then((c) => setCambios(c))
      .catch(() => setErrorCarga('No se pudo calcular qué va a publicarse.'))
      .finally(() => setCargando(false));
  };

  // `publicarTodo`/`descartarTodo` (el llamador) ya se encargan de su propio toast de éxito/error y
  // de NUNCA lanzar (atrapan internamente) — este `await` sólo espera a que terminen para cerrar el
  // popover, no decide si la acción salió bien.
  const ejecutar = async (accion: () => Promise<void>) => {
    await accion();
    setAbierto(false);
  };

  if (pendientes === 0) return null;

  return (
    <Popover open={abierto} onOpenChange={alAbrir}>
      <PopoverTrigger asChild>
        <button type="button" className="duna-btn duna-btn--primary duna-btn--sm" disabled={deshabilitado}>
          {procesando ? 'Publicando…' : (
            <>
              Publicar <span className="duna-badge duna-badge--attention">{pendientes}</span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" container={contenedor} style={{ width: '22rem' }}>
        {/* El encabezado cuenta las FILAS que la lista de abajo realmente muestra (`cambios.length`),
            no las CLAVES pendientes (`pendientes`, el badge del botón): una sola sección puede traer
            varios campos cambiados a la vez — como en el ejemplo del spec, "Hero · Titular · nuevo"
            Y "Hero · Composición «Portada»" el mismo "1 sin publicar" — y decir "un cambio" sobre una
            lista de tres filas se leería como un conteo que no cuadra con lo que está debajo. Mientras
            carga (`cambios === null`) se usa `pendientes` como piso razonable, nunca "0 cambios". */}
        <p className="duna-sub" style={{ margin: 0, marginBottom: 'var(--duna-space-3)' }}>
          {(() => {
            const n = cambios?.length ?? pendientes;
            return n === 1 ? 'Un cambio sin publicar' : `${n} cambios sin publicar`;
          })()}
        </p>

        {cargando && <p className="duna-caption">Calculando…</p>}
        {errorCarga && <p className="duna-field__error" role="alert">{errorCarga}</p>}
        {!cargando && !errorCarga && cambios && cambios.length === 0 && (
          <p className="duna-caption">Sin detalle para mostrar.</p>
        )}
        {!cargando && !errorCarga && cambios && cambios.length > 0 && (
          <ul style={{
            display: 'grid', gap: 'var(--duna-space-1)', margin: 0, padding: 0, listStyle: 'none',
            maxHeight: '16rem', overflowY: 'auto',
          }}>
            {cambios.map((c, i) => (
              <li key={`${c.clave}-${c.elemento}-${i}`}>
                <button
                  type="button"
                  className="duna-btn duna-btn--ghost duna-btn--sm"
                  style={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left', whiteSpace: 'normal', height: 'auto' }}
                  onClick={() => { setAbierto(false); onIrAItem(c.clave); }}
                >
                  {c.etiqueta}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div style={{ display: 'flex', gap: 'var(--duna-space-2)', marginTop: 'var(--duna-space-3)' }}>
          <button
            type="button"
            className="duna-btn duna-btn--ghost duna-btn--sm"
            onClick={() => ejecutar(onDescartar)}
            disabled={deshabilitado || procesando}
          >
            Descartar todo
          </button>
          <button
            type="button"
            className="duna-btn duna-btn--primary duna-btn--sm"
            onClick={() => ejecutar(onPublicar)}
            disabled={deshabilitado || procesando}
          >
            {procesando ? 'Publicando…' : 'Publicar'}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default ResumenPublicar;
