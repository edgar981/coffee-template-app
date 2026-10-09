'use client';

import { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, Trash2, Plus, Pencil, Upload, ImageIcon, Film } from 'lucide-react';
import { ConfirmDescartarDialog } from '@/components/admin/ConfirmDescartarDialog';
import BarraProgreso from '@/components/admin/BarraProgreso';
import PosterScrubber from '@/components/admin/PosterScrubber';
import { OPCIONES_CTA_DESTINO } from '@/components/admin/tienda-secciones';
import { remuxMovAMp4 } from '@/lib/video-remux';
import {
  MAX_SUBIDA_DIRECTA_MB, TIPOS_PERMITIDOS, TIPOS_VIDEO, ACCEPT_IMAGENES, ACCEPT_VIDEO,
  MSG_VIDEO_NO_ADMITIDO, CONTENEDORES_REMUXEABLES, type KindUpload,
} from '@/constants/upload';
import type { InstanciaItemDescriptor } from '@/lib/config/secciones-instancias';

// EL EDITOR DE ÍTEMS de un tipo REPEATER del catálogo de instancias (§ SECCIONES-TIPOS-2: Preguntas,
// Columnas, Filas; § SECCIONES-TIPOS-3: Collage, el primero con ítems foto-O-VIDEO, § `conVideo`
// más abajo) — agregar / quitar-CON-CONFIRMACIÓN / reordenar (flechas), cada ítem colapsado a
// un renglón-resumen y expandible para editar. MISMO patrón visual que `RepeaterEditor.tsx`
// (admin-level, § su docstring), pero NO es ese componente ni lo reusa: `RepeaterEditor.tsx` no está
// en `touches:` de este slice, y le falta justo lo que acá hace falta — un PISO (`min`) que impida
// bajar de dos columnas, no sólo un tope (`max`). Duplicar el patrón visual (~lo mismo que ya pagó
// `InstanciaEditorForm.tsx` al no reusar `TiendaSeccionEditor.renderCampo`) es más barato que abrir
// una segunda superficie fuera de alcance.
//
// CONTROLADO: `InstanciaEditorForm` (y, por arriba, `TiendaPaginas.tsx`) poseen el array completo —
// cada cambio, incluido agregar/quitar/mover, pasa por `onCambiar` con el array ENTERO, el mismo
// autoguardado de la instancia completa, nunca uno propio de este editor.
//
// MIN/MAX SON DE ESTE EDITOR, NO DEL RESOLVER (§ `InstanciaItemsDef`, secciones-instancias.ts): "de
// dos a seis columnas" es cierto porque la papelera se deshabilita en el piso y "Agregar" en el
// tope — el modelo no los impone (SOFT, resuelve lo que haya).

type Item = Record<string, string>;

const LABEL_CAMPO_ITEM: Record<string, string> = {
  pregunta: 'Pregunta',
  respuesta: 'Respuesta',
  titulo: 'Título',
  texto: 'Texto',
  imagen: 'Imagen',
  enlace: 'Destino',
  ctaLabel: 'Botón · texto',
  ctaDestino: 'Botón · destino',
  // § SECCIONES-TIPOS-3 — los campos del ítem de "collage" que no son "imagen"/"enlace" (ya
  // declarados arriba). `url` nunca se renderiza como campo de texto (va por `camposImagen`, igual
  // que `imagen` en Columnas/Filas) — queda acá sólo por completitud del mapa, nunca se lee.
  url: 'Imagen o video',
  leyenda: 'Leyenda',
  // § MOVIMIENTO-NIVEL-EDITORIAL-1 — "proceso": el rótulo corto de cada paso ("01 · Cosecha" en el
  // prototipo). Opcional (§ DESCRIPTOR_INSTANCIA.proceso) — un paso sin etiqueta sigue narrando con
  // sólo título+texto.
  etiqueta: 'Etiqueta del paso',
};
// Los campos de DESTINO (set cerrado, igual que `ctaDestino` en los campos planos de la instancia)
// y los de TEXTO LARGO (textarea) se reconocen por NOMBRE — no hay más de estos ocho nombres en los
// tres tipos del catálogo (§ secciones-instancias.ts, DESCRIPTOR_INSTANCIA.{preguntas,columnas,
// filas}.items.descriptor.campos), así que una lista fija alcanza sin volverse una config aparte.
const CAMPOS_DESTINO = new Set(['enlace', 'ctaDestino']);
const CAMPOS_MULTILINEA = new Set(['respuesta', 'texto']);

// El resumen del renglón colapsado: el campo "principal" (pregunta/título) y un fragmento del campo
// "detalle" (respuesta/texto) — MISMOS roles que `resumen: 'principal'|'detalle'` de `CampoItem`
// (`components/admin/tienda-secciones.ts`), reconocidos por nombre en vez de declarados por ítem
// (los tres tipos de este catálogo sólo tienen UN candidato a cada rol).
function resumenDe(item: Item, i: number, itemLabel: string): { titulo: string; fragmento: string } {
  // § SECCIONES-TIPOS-3 — el fallback se deriva por TIPO del ítem, no por `itemLabel` de la
  // sección: un ítem-video de "collage" dice "Video N", no "Foto N" — mismo criterio que
  // `RepeaterEditor.resumenDe`. `leyenda` (collage) entra como candidato a "principal"/"detalle" —
  // ningún otro tipo del catálogo declara ambos campos a la vez, así que no hay ambigüedad.
  const labelTipo = item.tipo === 'video' ? 'Video' : itemLabel;
  const principal = (item.pregunta ?? item.titulo ?? item.leyenda ?? '').trim();
  const titulo = principal !== '' ? principal : `${labelTipo} ${i + 1}`;
  const detalle = (item.respuesta ?? item.texto ?? '').trim();
  const fragmento = detalle.length > 60 ? detalle.slice(0, 60) + '…' : detalle;
  return { titulo, fragmento };
}

export function InstanciaItemsEditor({
  items, descriptor, min, max, itemLabel, genero = 'f', conVideo = false,
  pedirImagen, elegir, subir, subiendo, progreso, onError, onCambiar,
}: {
  items: Item[];
  descriptor: InstanciaItemDescriptor;
  min: number;
  max?: number;
  /** Nombre SINGULAR en minúscula ("pregunta", "columna", "fila") — para los botones y el renglón.
   *  Plural = `${itemLabel}s` (las tres son regulares en español, sin excepción que tratar). */
  itemLabel: string;
  /** Género del `itemLabel`, para el artículo del copy de confirmación. Default femenino — las tres
   *  del catálogo ("pregunta"/"columna"/"fila") lo son. */
  genero?: 'f' | 'm';
  /** § SECCIONES-TIPOS-3 — presente ⇒ el PRIMER campo de `descriptor.imagenes` acepta TAMBIÉN
   *  video (hoy sólo "collage"): aparece "Agregar video" junto a "Agregar foto", y el ítem-video se
   *  edita con el flujo de video+póster en vez del de foto suelta. Ausente (default) ⇒ sólo fotos,
   *  comportamiento IDÉNTICO al de antes de este slice. */
  conVideo?: boolean;
  /** Pide una subida al uploader COMPARTIDO de la cáscara (la misma instancia que
   *  `InstanciaEditorForm` ya usa para sus campos de imagen planos — un solo `<input>`, un solo
   *  `subiendo`). */
  pedirImagen: (onUrl: (url: string) => void) => void;
  /** ELEGIR un archivo sin subirlo (para el alta de video: se eligen los dos y se sube al final).
   *  Sólo hace falta con `conVideo`. */
  elegir?: (onFile: (f: File) => void, opts: { tipos: readonly string[]; accept: string; msgError: string }) => void;
  /** SUBIR un archivo ya elegido, con su kind. Sólo hace falta con `conVideo`. */
  subir?: (file: File, opts: { kind: KindUpload }) => Promise<{ url: string }>;
  subiendo: boolean;
  progreso: number | null;
  /** Errores del flujo de video (los de la foto suelta ya van por el `onError` del hook, vía
   *  `pedirImagen`). Sólo hace falta con `conVideo`. */
  onError?: (msg: string) => void;
  onCambiar: (nuevos: Item[]) => void;
}) {
  const [expandido, setExpandido] = useState<number | null>(null);
  const [subiendoDesde, setSubiendoDesde] = useState<'agregar' | 'agregar-video' | number | null>(null);
  const [porEliminar, setPorEliminar] = useState<number | null>(null);
  const camposImagen = new Set(descriptor.imagenes ?? []);
  // El PRIMER campo de `descriptor.imagenes` es el MEDIA del ítem (igual criterio que `agregar`, más
  // abajo): gobierna el video, cuando `conVideo`.
  const campoMedia = descriptor.imagenes?.[0];
  const alMax = max != null && items.length >= max;
  const alMin = items.length <= min;

  // § SECCIONES-TIPOS-3 — EL VIDEO: MISMA secuencia que `RepeaterEditor.subirVideoYPoster` (video
  // elegido y RETENIDO hasta elegir el póster — cancelar no deja un video huérfano—, remux si es
  // .mov, EL PÓSTER SUBE PRIMERO), pero sin un tope de VIDEOS separado del de FOTOS: "de tres a
  // seis ítems" es el único tope de "collage" (§ el spec), foto y video cuentan igual contra él —
  // a diferencia de la galería de /nosotros, que sí separa `max`/`maxVideo`.
  const [convirtiendo, setConvirtiendo] = useState(false);
  const ocupado = subiendo || convirtiendo;
  useEffect(() => { if (!ocupado) setSubiendoDesde(null); }, [ocupado]);
  const [videoPendiente, setVideoPendiente] = useState<{ file: File; editar: number | null } | null>(null);
  const [subiendoPaso, setSubiendoPaso] = useState<'convirtiendo' | 'póster' | 'vídeo' | null>(null);
  const textoPaso = () => (subiendoPaso === 'convirtiendo' ? 'Convirtiendo el video…' : `Subiendo ${subiendoPaso}… ${progreso ?? 0}%`);

  const nuevoItem = (): Item => Object.fromEntries(Object.keys(descriptor.campos).map((c) => [c, '']));

  const editar = (i: number, campo: string, valor: string) =>
    onCambiar(items.map((it, idx) => (idx === i ? { ...it, [campo]: valor } : it)));

  // Agregar con campo-imagen = sube PRIMERO (un ítem-imagen vacío sería una foto rota) — mismo
  // criterio que `RepeaterEditor.agregar`. Ninguno de los tipos del catálogo tiene MÁS de un
  // campo de imagen por ítem, así que basta con el primero declarado.
  const agregar = () => {
    if (alMax) return;
    if (campoMedia) {
      setSubiendoDesde('agregar');
      pedirImagen((url) => {
        onCambiar([...items, { ...nuevoItem(), [campoMedia]: url }]);
        setExpandido(items.length);
      });
      return;
    }
    onCambiar([...items, nuevoItem()]);
    setExpandido(items.length);
  };

  // ── ALTA/CAMBIO DE VIDEO (§ SECCIONES-TIPOS-3, sólo con `conVideo`) ──────────────────────────────
  const agregarVideo = () => {
    if (alMax || !elegir) return;
    setSubiendoDesde('agregar-video');
    elegir((f) => setVideoPendiente({ file: f, editar: null }), { tipos: TIPOS_VIDEO, accept: ACCEPT_VIDEO, msgError: MSG_VIDEO_NO_ADMITIDO });
  };
  const cambiarVideo = (i: number) => {
    if (!elegir) return;
    setSubiendoDesde(i);
    elegir((f) => setVideoPendiente({ file: f, editar: i }), { tipos: TIPOS_VIDEO, accept: ACCEPT_VIDEO, msgError: MSG_VIDEO_NO_ADMITIDO });
  };
  const subirVideoYPoster = async (video: File, poster: File, indiceEditar: number | null) => {
    if (!subir || !campoMedia) return;
    try {
      let videoFinal = video;
      if ((CONTENEDORES_REMUXEABLES as readonly string[]).includes(video.type)) {
        setSubiendoPaso('convirtiendo');
        setConvirtiendo(true);
        try { videoFinal = await remuxMovAMp4(video); }
        finally { setConvirtiendo(false); }
      }
      setSubiendoPaso('póster');
      const { url: posterUrl } = await subir(poster, { kind: 'imagen' });
      setSubiendoPaso('vídeo');
      const { url: videoUrl } = await subir(videoFinal, { kind: 'imagen-o-video' });
      if (indiceEditar === null) {
        const nuevo: Item = { ...nuevoItem(), tipo: 'video', poster: posterUrl, [campoMedia]: videoUrl };
        onCambiar([...items, nuevo]);
        setExpandido(items.length);
      } else {
        onCambiar(items.map((it, idx) => (idx === indiceEditar ? { ...it, tipo: 'video', poster: posterUrl, [campoMedia]: videoUrl } : it)));
      }
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'No se pudo subir el video. Reintenta.');
    } finally {
      setVideoPendiente(null);
      setSubiendoPaso(null);
    }
  };
  const elegirPosterParaVideo = () => {
    const vp = videoPendiente;
    if (!vp || !elegir) return;
    elegir((poster) => subirVideoYPoster(vp.file, poster, vp.editar), { tipos: TIPOS_PERMITIDOS, accept: ACCEPT_IMAGENES, msgError: 'Formato no admitido. Usa JPG, PNG o WebP.' });
  };
  const cambiarPoster = (i: number) => {
    if (!elegir || !subir) return;
    setSubiendoDesde(i);
    setSubiendoPaso('póster');
    elegir((file) => {
      subir(file, { kind: 'imagen' })
        .then(({ url }) => onCambiar(items.map((it, idx) => (idx === i ? { ...it, poster: url } : it))))
        .catch((err) => onError?.(err instanceof Error ? err.message : 'No se pudo subir. Reintenta.'))
        .finally(() => setSubiendoPaso(null));
    }, { tipos: TIPOS_PERMITIDOS, accept: ACCEPT_IMAGENES, msgError: 'Formato no admitido. Usa JPG, PNG o WebP.' });
  };

  const quitar = (i: number) => {
    if (alMin) return;
    onCambiar(items.filter((_, idx) => idx !== i));
    setExpandido(null);
  };

  const mover = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const nuevos = items.slice();
    [nuevos[i], nuevos[j]] = [nuevos[j], nuevos[i]];
    onCambiar(nuevos);
    setExpandido(j); // el ítem movido sigue expandido si lo estaba
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-3)' }}>
      {items.map((item, i) => {
        const abierto = expandido === i;
        const { titulo, fragmento } = resumenDe(item, i, itemLabel);
        const subiendoEste = subiendo && subiendoDesde === i;
        // § EDITOR-PANEL-PIEL-1 — `editor-repeater-item`: protege este `.duna-card` del aplanado que
        // `.editor-panel` aplica a los demás grupos (editor.css) — el panel es blanco ahora, así que
        // sin este marcador el ítem quedaría sin borde, blanco sobre blanco.
        return (
          <div key={i} className="duna-card editor-repeater-item" style={{ padding: 'var(--duna-space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)' }}>
              <button
                type="button"
                onClick={() => setExpandido(abierto ? null : i)}
                className="duna-btn duna-btn--ghost duna-btn--sm"
                aria-expanded={abierto}
                style={{ flex: 1, justifyContent: 'flex-start', minWidth: 0, textAlign: 'left' }}
              >
                <Pencil className="h-3.5 w-3.5" style={{ flexShrink: 0 }} />
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <strong>{titulo}</strong>{fragmento && <span className="duna-sub"> · {fragmento}</span>}
                </span>
              </button>
              <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir" className="duna-btn duna-btn--ghost duna-btn--sm"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => mover(i, 1)} disabled={i === items.length - 1} aria-label="Bajar" className="duna-btn duna-btn--ghost duna-btn--sm"><ArrowDown className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => setPorEliminar(i)} disabled={alMin} aria-label={`Eliminar ${itemLabel}`} className="duna-btn duna-btn--ghost duna-btn--sm"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>

            {abierto && (
              <div className="duna-form" style={{ marginTop: 'var(--duna-space-3)' }}>
                {Object.keys(descriptor.campos)
                  // § SECCIONES-TIPOS-3 — con `conVideo`, "tipo"/"poster" NUNCA se iteran como
                  // campos sueltos: el bloque de abajo (sobre el campo MEDIA, `campoMedia`) los
                  // maneja juntos — "poster" como miniatura del ítem-video, "tipo" nunca se edita a
                  // mano (lo pone el botón que se usó: Agregar foto vs Agregar video).
                  .filter((campo) => !(conVideo && (campo === 'poster' || campo === 'tipo')))
                  .map((campo) => {
                  const id = `item-${i}-${campo}`;
                  const label = LABEL_CAMPO_ITEM[campo] ?? campo;
                  const kind = descriptor.campos[campo];
                  const valor = item[campo] ?? '';
                  const esVideoItem = conVideo && item.tipo === 'video';

                  if (camposImagen.has(campo)) {
                    // § SECCIONES-TIPOS-3 — EL ÍTEM-VIDEO: la miniatura es su PÓSTER (el campo
                    // media es un video, un `<img>` con eso saldría roto), y los botones son
                    // "Cambiar vídeo" (re-deriva el póster del vídeo nuevo, § `cambiarVideo`) +
                    // "Cambiar póster" (reemplaza sólo la miniatura, § `cambiarPoster`) — MISMO
                    // patrón que `RepeaterEditor`.
                    if (esVideoItem) {
                      const subiendoEsteItem = ocupado && subiendoDesde === i;
                      return (
                        <div key={campo} className="duna-field duna-form__full">
                          <span className="duna-field__label">{label}</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-2)', marginTop: 'var(--duna-space-1)' }}>
                            {videoPendiente && videoPendiente.editar === i && !ocupado ? (
                              <PosterScrubber
                                video={videoPendiente.file}
                                onPoster={(poster) => subirVideoYPoster(videoPendiente.file, poster, i)}
                                onSubirImagen={elegirPosterParaVideo}
                                onCancelar={() => setVideoPendiente(null)}
                              />
                            ) : (
                              <>
                                {item.poster && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={item.poster} alt="" style={{ width: '100%', maxWidth: 240, aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 'var(--duna-r-m)', border: '1px solid var(--duna-border)' }} />
                                )}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-2)' }}>
                                  <button type="button" onClick={() => cambiarVideo(i)} disabled={ocupado || !!videoPendiente} className="duna-btn duna-btn--secondary duna-btn--sm">
                                    <Film className="h-3.5 w-3.5" /> Cambiar vídeo
                                  </button>
                                  <button type="button" onClick={() => cambiarPoster(i)} disabled={ocupado || !!videoPendiente} className="duna-btn duna-btn--ghost duna-btn--sm">
                                    <Upload className="h-3.5 w-3.5" /> Cambiar póster
                                  </button>
                                </div>
                                {subiendoEsteItem && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span className="duna-field__hint" style={{ margin: 0 }}>{textoPaso()}</span>
                                    {subiendoPaso !== 'convirtiendo' && <BarraProgreso pct={progreso ?? 0} />}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={campo} className="duna-field duna-form__full">
                        <span className="duna-field__label">{label}</span>
                        <div style={{ display: 'flex', gap: 'var(--duna-space-3)', alignItems: 'flex-start', marginTop: 'var(--duna-space-1)' }}>
                          <div className="duna-tile" style={{ width: 'calc(var(--duna-thumb-w) * 2)' }}>
                            {valor
                              ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={valor} alt="" />
                              : <ImageIcon aria-hidden width={20} height={20} />}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-2)', minWidth: 0 }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-2)' }}>
                              <button
                                type="button"
                                onClick={() => { setSubiendoDesde(i); pedirImagen((url) => editar(i, campo, url)); }}
                                className="duna-btn duna-btn--secondary duna-btn--sm"
                                disabled={subiendo}
                              >
                                <Upload /> {valor ? 'Cambiar' : 'Agregar foto'}
                              </button>
                              {valor && (
                                <button type="button" onClick={() => editar(i, campo, '')} className="duna-btn duna-btn--ghost duna-btn--sm" disabled={subiendo}>
                                  Quitar
                                </button>
                              )}
                            </div>
                            <span className="duna-field__hint" style={{ margin: 0 }}>
                              {subiendoEste ? `Subiendo… ${progreso ?? 0}%` : `JPG, PNG o WebP · máx ${MAX_SUBIDA_DIRECTA_MB} MB. Vacío: no se muestra.`}
                            </span>
                            {subiendoEste && <BarraProgreso pct={progreso ?? 0} />}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (CAMPOS_DESTINO.has(campo)) {
                    return (
                      <div key={campo} className="duna-field">
                        <label className="duna-field__label" htmlFor={id}>{label}</label>
                        <select id={id} className="duna-input duna-select" value={valor} onChange={(e) => editar(i, campo, e.target.value)}>
                          {OPCIONES_CTA_DESTINO.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                    );
                  }

                  const multilinea = CAMPOS_MULTILINEA.has(campo);
                  return (
                    <div key={campo} className={`duna-field${multilinea ? ' duna-form__full' : ''}`}>
                      <label className="duna-field__label" htmlFor={id}>
                        {label}{kind === 'requerido' && ' *'}
                      </label>
                      {multilinea ? (
                        <textarea id={id} className="duna-input" rows={2} value={valor} onChange={(e) => editar(i, campo, e.target.value)} />
                      ) : (
                        <input id={id} className="duna-input" value={valor} onChange={(e) => editar(i, campo, e.target.value)} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-2)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-2)' }}>
          <button type="button" onClick={agregar} disabled={alMax || ocupado || !!videoPendiente} className="duna-btn duna-btn--secondary duna-btn--sm">
            <Plus className="h-3.5 w-3.5" /> {subiendo && subiendoDesde === 'agregar' ? `Subiendo… ${progreso ?? 0}%` : `Agregar ${itemLabel}`}
          </button>
          {/* § SECCIONES-TIPOS-3 — sólo con `conVideo` (hoy, "collage"): "Agregar video" junto a
              "Agregar foto", comparten el MISMO tope (`alMax`, "de tres a seis ítems" sin distinción
              de tipo). */}
          {conVideo && elegir && subir && (
            <button type="button" onClick={agregarVideo} disabled={alMax || ocupado || !!videoPendiente} className="duna-btn duna-btn--secondary duna-btn--sm">
              <Film className="h-3.5 w-3.5" /> Agregar video
            </button>
          )}
        </div>

        {/* El paso del PÓSTER del ALTA (editar === null): el video ya se eligió (RETENIDO, sin
            subir) y el póster sale de un cuadro del propio video (scrubber). El paso del CAMBIO va
            INLINE en su ítem (arriba, § el bloque `esVideoItem`). */}
        {videoPendiente && videoPendiente.editar === null && !ocupado && (
          <PosterScrubber
            video={videoPendiente.file}
            onPoster={(poster) => subirVideoYPoster(videoPendiente.file, poster, null)}
            onSubirImagen={elegirPosterParaVideo}
            onCancelar={() => setVideoPendiente(null)}
          />
        )}

        {subiendo && subiendoDesde === 'agregar' && (
          <div style={{ maxWidth: 240 }}><BarraProgreso pct={progreso ?? 0} /></div>
        )}
        {ocupado && subiendoDesde === 'agregar-video' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: 240 }}>
            <span className="duna-field__hint" style={{ margin: 0 }}>{textoPaso()}</span>
            {subiendoPaso !== 'convirtiendo' && <BarraProgreso pct={progreso ?? 0} />}
          </div>
        )}
        {alMax && (
          <p className="duna-field__hint" style={{ margin: 0 }}>Llegaste al máximo de {max} {itemLabel}s. Quita alguna para agregar otra.</p>
        )}
        {alMin && min > 0 && (
          <p className="duna-field__hint" style={{ margin: 0 }}>Mínimo {min} {itemLabel}s — no se pueden quitar más.</p>
        )}
      </div>

      {/* El artículo/label del ítem a borrar se deriva por TIPO, no por `itemLabel` de la sección —
          mismo criterio que `resumenDe`/`RepeaterEditor.etiquetaItem`: "¿Eliminar este video?" para
          un ítem-video, aunque la sección sea de "fotos". */}
      {(() => {
        const itemBorrar = porEliminar !== null ? items[porEliminar] : undefined;
        const esVideoBorrar = conVideo && itemBorrar?.tipo === 'video';
        const labelBorrar = esVideoBorrar ? 'video' : itemLabel;
        const generoBorrar = esVideoBorrar ? 'm' : genero;
        return (
          <ConfirmDescartarDialog
            abierto={porEliminar !== null}
            onDescartar={() => { const i = porEliminar; setPorEliminar(null); if (i !== null) quitar(i); }}
            onSeguir={() => setPorEliminar(null)}
            titulo={`¿Eliminar est${generoBorrar === 'f' ? 'a' : 'e'} ${labelBorrar}?`}
            descripcion="Se quita de la lista. Recuerda publicar para aplicar el cambio en la tienda."
            confirmLabel="Eliminar"
            seguirLabel="Conservar"
          />
        );
      })()}
    </div>
  );
}

export default InstanciaItemsEditor;
