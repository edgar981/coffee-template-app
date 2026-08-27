'use client';

import { useState, useEffect } from 'react';
import { Star, ArrowUp, ArrowDown, Trash2, Plus, Pencil, Upload, Film } from 'lucide-react';
import { ConfirmDescartarDialog } from '@/components/admin/ConfirmDescartarDialog';
import BarraProgreso from '@/components/admin/BarraProgreso';
import PosterScrubber from '@/components/admin/PosterScrubber';
import type { CampoItem } from '@/components/admin/tienda-secciones';
import type { Dims } from '@/components/admin/useSubidaImagen';
import { remuxMovAMp4 } from '@/lib/video-remux';
import {
  TIPOS_PERMITIDOS, TIPOS_VIDEO, ACCEPT_IMAGENES, ACCEPT_VIDEO, MSG_VIDEO_NO_ADMITIDO, MSG_VIDEO_GALERIA_LARGO,
  MAX_VIDEO_GALERIA_BYTES, CONTENEDORES_REMUXEABLES, type KindUpload,
} from '@/constants/upload';

// EDITOR DE LISTA (repeater) GENÉRICO — agregar / quitar / editar / reordenar (flechas) ítems, con
// cada ítem COLAPSADO a un renglón-resumen y expandible para editar. La maquinaria NO sabe nada de
// testimonios ni de fotos: opera sobre `descriptores` (nombre + tipo + rol de resumen). El mismo
// componente sirve a la galería de /nosotros (tanda 2): sólo cambian los descriptores (un campo
// `tipo:'imagen'` en vez de texto+rating).
//
// CONTROLADO: el array `items` lo posee el padre (`TiendaSeccionEditor`), para que TODO cambio pase
// por `onChange` → el mismo marcar-sucio + autoguardado que un campo plano. Agregar, quitar y mover
// también llaman a `onChange` (no son onChange de input — son los que más fácil se olvidan). Lo
// único LOCAL es qué ítem está expandido (estado de UI, no contenido).
//
// IMÁGENES: el repeater NO tiene su propio uploader —lo pide por `pedirImagen` (el `pedir` del hook
// compartido que la cáscara instancia)—, así hay UN solo <input file> y un solo `subiendo` que
// bloquea todo. Un repeater con un campo `tipo:'imagen'` AGREGA subiendo primero: un ítem-imagen
// vacío se renderizaría como una foto rota, así que "Agregar" abre el picker y crea el ítem con la
// url ya puesta.

type Item = Record<string, unknown>;

function estrellasLabel(n: number) { return `${n} estrella${n > 1 ? 's' : ''}`; }

// Rating: estrellas CLICABLES. Llenas hasta `valor` (tinta), vacías el resto (borde). Convención de
// 5 (no es un nombre de campo; es la escala del tipo 'rating').
function RatingInput({ valor, onChange }: { valor: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          aria-label={estrellasLabel(n)}
          aria-pressed={n === valor}
          onClick={() => onChange(n)}
          className="duna-btn duna-btn--ghost"
          style={{ padding: '4px', minWidth: 'auto', height: 'auto' }}
        >
          <Star
            className="h-5 w-5"
            style={{ fill: n <= valor ? 'var(--duna-ink)' : 'transparent', color: n <= valor ? 'var(--duna-ink)' : 'var(--duna-border)' }}
          />
        </button>
      ))}
    </div>
  );
}

// Pone la url en un ítem y, si el descriptor de imagen declara `dims`, guarda ancho/alto en los
// campos que nombra (para la proporción de la celda en la galería). Sin dims legibles, LIMPIA las
// viejas —al reemplazar una foto, dejar la proporción anterior sería una celda del tamaño equivocado—.
function conImagen(item: Item, d: CampoItem, url: string, dims?: Dims): Item {
  const out: Item = { ...item, [d.name]: url };
  if (d.dims) {
    if (dims) { out[d.dims.w] = dims.w; out[d.dims.h] = dims.h; }
    else { delete out[d.dims.w]; delete out[d.dims.h]; }
  }
  return out;
}

function resumenDe(item: Item, descriptores: CampoItem[], itemLabel: string, i: number) {
  const principal = descriptores.find(d => d.resumen === 'principal');
  const detalle = descriptores.find(d => d.resumen === 'detalle');
  // El fallback del título se deriva por TIPO del ítem, no por sección: un ítem-vídeo dice "Vídeo N",
  // no "Foto N", aunque viva en una galería de fotos.
  const labelTipo = item.tipo === 'video' ? 'Vídeo' : itemLabel;
  const titulo = (principal && String(item[principal.name] ?? '').trim()) || `${labelTipo} ${i + 1}`;
  const detTexto = detalle ? String(item[detalle.name] ?? '').trim() : '';
  const fragmento = detTexto.length > 60 ? detTexto.slice(0, 60) + '…' : detTexto;
  return { titulo, fragmento };
}

export default function RepeaterEditor({
  items,
  descriptores,
  itemLabel,
  genero = 'm',
  max,
  maxVideo,
  pedirImagen,
  elegir,
  subir,
  subiendo,
  progreso,
  onError,
  onChange,
}: {
  items: Item[];
  descriptores: CampoItem[];
  itemLabel: string;
  /** Género del `itemLabel`, sólo para el artículo del copy de confirmación ("esta foto" vs "este
   *  testimonio"). Default masculino. */
  genero?: 'f' | 'm';
  max?: number;
  /** Tope de VÍDEOS (separado de las fotos). Presente → el repeater ACEPTA vídeo: aparece "Agregar
   *  vídeo" y los ítems `tipo:'video'` se cuentan y renderizan aparte. Ausente → sólo fotos. */
  maxVideo?: number;
  /** Pide una subida al uploader compartido de la cáscara; entrega la url (y las dims, cuando se
   *  pudieron leer) por el callback. Ausente en repeaters sin imágenes (testimonios). */
  pedirImagen?: (onUrl: (url: string, dims?: Dims) => void) => void;
  /** ELEGIR un archivo sin subirlo (para el alta de vídeo: se eligen los dos y se sube al final). */
  elegir?: (onFile: (f: File) => void, opts: { tipos: readonly string[]; accept: string; msgError: string }) => void;
  /** SUBIR un archivo ya elegido, con su kind. Devuelve url + dims. */
  subir?: (file: File, opts: { kind: KindUpload }) => Promise<{ url: string; dims?: Dims }>;
  /** Una subida en curso (del uploader compartido): bloquea agregar/cambiar para no encimar dos. */
  subiendo?: boolean;
  /** % de la subida en curso (0–100), para la barra pegada al botón que la disparó. */
  progreso?: number | null;
  /** Para los errores de subida del flujo de vídeo (los de validación ya van por el onError del hook). */
  onError?: (msg: string) => void;
  onChange: (nuevos: Item[]) => void;
}) {
  const [expandido, setExpandido] = useState<number | null>(null);
  // Qué control disparó la subida en curso —'agregar' o el índice del ítem en "Cambiar"— para pegarle
  // la barra a ESE botón (§ el progreso donde el ojo). Sólo se setea cuando la subida la inicia ESTE
  // repeater; si sube un campo fijo de la cáscara, queda null (la barra va allá). Se limpia al terminar.
  const [subiendoDesde, setSubiendoDesde] = useState<'agregar' | 'agregar-video' | number | null>(null);
  // El .mov se re-envasa a .mp4 ANTES de subir (§ subirVideoYPoster). Ese remux no pasa por el `subiendo`
  // del hook (no es una subida), así que lleva su propio flag; `ocupado` = las dos cosas, y es lo que
  // bloquea/gate-a en el render (si sólo mirara `subiendo`, el scrubber reaparecería durante la conversión).
  const [convirtiendo, setConvirtiendo] = useState(false);
  const ocupado = subiendo || convirtiendo;
  useEffect(() => { if (!ocupado) setSubiendoDesde(null); }, [ocupado]);
  // Índice del ítem pendiente de ELIMINAR (con confirmación). Borrar destruye trabajo —una foto o
  // un testimonio— y no hay deshacer campo por campo, así que la papelera CONFIRMA antes de quitar.
  // Va en la PLATAFORMA (no en el tipo imagen) porque el testimonio borrado destruye igual.
  const [porEliminar, setPorEliminar] = useState<number | null>(null);
  // El alta/cambio de VÍDEO junta los dos archivos y sube al final (§ la decisión): el vídeo elegido
  // queda RETENIDO acá esperando el póster —así cancelar no deja un vídeo huérfano, no hay nada subido—.
  // `editar` = índice del ítem a REEMPLAZAR (Cambiar vídeo) o null = alta de un ítem nuevo: el MISMO paso
  // de póster (scrubber + subir imagen) sirve a los dos, para que cambiar el vídeo RE-DERIVE su póster y
  // el ítem nunca muestre el frame de un vídeo que ya no está. `subiendoPaso` nombra el paso.
  const [videoPendiente, setVideoPendiente] = useState<{ file: File; editar: number | null } | null>(null);
  const [subiendoPaso, setSubiendoPaso] = useState<'convirtiendo' | 'póster' | 'vídeo' | null>(null);
  // El texto del paso: 'convirtiendo' no tiene % (el remux es de una pieza); las subidas sí.
  const textoPaso = () => (subiendoPaso === 'convirtiendo' ? 'Convirtiendo el video…' : `Subiendo ${subiendoPaso}… ${progreso ?? 0}%`);

  // El PRIMER campo imagen es el MEDIA principal del ítem (foto o vídeo van en su `url`): gobierna la
  // miniatura y el agregar. Un repeater sin campo imagen (testimonios) no lo tiene y agrega vacío.
  const campoImagen = descriptores.find(d => d.tipo === 'imagen');
  // Conteo POR TIPO: fotos y vídeos tienen topes separados. `tipo` ausente = foto (ítems previos).
  const videos = items.filter(it => it.tipo === 'video');
  const fotos = items.filter(it => it.tipo !== 'video');
  const alMaxFoto = max != null && fotos.length >= max;
  const alMaxVideo = maxVideo != null && videos.length >= maxVideo;
  const aceptaVideo = maxVideo != null && !!elegir && !!subir && !!campoImagen;

  const editar = (i: number, campo: string, valor: unknown) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, [campo]: valor } : it)));

  const nuevoItem = (): Item => Object.fromEntries(descriptores.map(d => [d.name, d.defaultValor ?? '']));

  // El label del ítem se deriva por TIPO, no por sección: un ítem-vídeo dentro de una galería de "fotos"
  // dice "vídeo" (masculino), no "foto" —el copy de borrado usaba el itemLabel de la sección y salía
  // "¿Eliminar esta foto?" para un vídeo—. Un mismo repeater mezcla fotos y vídeos (topes separados).
  const etiquetaItem = (item?: Item): { label: string; genero: 'f' | 'm' } =>
    item?.tipo === 'video' ? { label: 'vídeo', genero: 'm' } : { label: itemLabel.toLowerCase(), genero };

  // ── ALTA DE VÍDEO: elegir vídeo → elegir póster → subir PÓSTER (chico) → subir VÍDEO (grande) ──────
  // El póster va PRIMERO a propósito: si el VÍDEO (grande, el que más probablemente falla en una red
  // lenta) falla después, el huérfano es una imagen de póster (~200 KB), NO un vídeo de ~200 MB. NO
  // invertir "por subir el grande primero por si falla": eso vuelve el huérfano un vídeo. (Y sin
  // borrado desde el cliente: mandar una url a borrar reabre lo que el borrado server-side previene.)
  const subirVideoYPoster = async (video: File, poster: File, editar: number | null) => {
    setSubiendoDesde(editar === null ? 'agregar-video' : editar);
    try {
      // ETAPA 1 (sólo .mov): re-envasar a .mp4 en el navegador ANTES de subir nada (§ lib/video-remux).
      // Firefox no reproduce el contenedor .mov; así se convierte solo, sin instrucción. Va PRIMERO —antes
      // del póster— por dos razones: es la etapa que el operador ve nombrada primero, y es local (no deja
      // huérfano si algo falla después). El póster-primero de la subida no cambia.
      let videoFinal = video;
      if ((CONTENEDORES_REMUXEABLES as readonly string[]).includes(video.type)) {
        setSubiendoPaso('convirtiendo');
        setConvirtiendo(true);
        try { videoFinal = await remuxMovAMp4(video); }
        finally { setConvirtiendo(false); }
        // El tope EXACTO de galería sobre lo que se SUBE: un .mov que pasó el pre-chequeo (1.5×) pero cuya
        // salida video-only sigue > 20 MB se rechaza acá con el mismo mensaje de "clip corto".
        if (videoFinal.size > MAX_VIDEO_GALERIA_BYTES) throw new Error(MSG_VIDEO_GALERIA_LARGO);
      }
      setSubiendoPaso('póster');
      const { url: posterUrl } = await subir!(poster, { kind: 'imagen' });
      setSubiendoPaso('vídeo');
      const { url: videoUrl, dims } = await subir!(videoFinal, { kind: 'imagen-o-video' });
      const ponerDims = (o: Item) => {
        if (!campoImagen!.dims) return;
        if (dims) { o[campoImagen!.dims.w] = dims.w; o[campoImagen!.dims.h] = dims.h; }
        else { delete o[campoImagen!.dims.w]; delete o[campoImagen!.dims.h]; } // vídeo no medible → limpiar, no dejar la proporción vieja
      };
      if (editar === null) {
        const nuevo: Item = { ...nuevoItem(), tipo: 'video', poster: posterUrl, [campoImagen!.name]: videoUrl };
        ponerDims(nuevo);
        onChange([...items, nuevo]);
        setExpandido(items.length);
      } else {
        // Cambiar vídeo: se reemplazan vídeo Y póster (el póster es el frame del vídeo nuevo) y las dims.
        onChange(items.map((it, idx) => {
          if (idx !== editar) return it;
          const out: Item = { ...it, poster: posterUrl, [campoImagen!.name]: videoUrl };
          ponerDims(out);
          return out;
        }));
      }
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'No se pudo subir el vídeo. Reintenta.');
    } finally {
      setVideoPendiente(null);
      setSubiendoPaso(null);
    }
  };
  const agregarVideo = () => {
    if (alMaxVideo) return;
    elegir?.(f => setVideoPendiente({ file: f, editar: null }), { tipos: TIPOS_VIDEO, accept: ACCEPT_VIDEO, msgError: MSG_VIDEO_NO_ADMITIDO });
  };
  // Cambiar el vídeo de un ítem abre EL MISMO paso de póster que el alta (el póster se re-deriva del vídeo
  // nuevo): un póster del vídeo viejo sería el frame de algo que ya no está — el defecto que esto cierra.
  const cambiarVideo = (i: number) => {
    elegir?.(f => setVideoPendiente({ file: f, editar: i }), { tipos: TIPOS_VIDEO, accept: ACCEPT_VIDEO, msgError: MSG_VIDEO_NO_ADMITIDO });
  };
  const elegirPosterParaVideo = () => {
    const vp = videoPendiente;
    if (!vp) return;
    elegir?.(poster => subirVideoYPoster(vp.file, poster, vp.editar), { tipos: TIPOS_PERMITIDOS, accept: ACCEPT_IMAGENES, msgError: 'Formato no admitido. Usa JPG, PNG o WebP.' });
  };
  // Reemplazar SÓLO el PÓSTER de un ítem-vídeo con una imagen a mano (una subida, sin tocar el vídeo ni
  // las dims). "Cambiar vídeo" ya no pasa por acá: re-deriva su póster por el scrubber (§ cambiarVideo).
  const cambiarMedia = (i: number, campo: string, kind: KindUpload, conDims: boolean, tipos: readonly string[], accept: string, msgError: string) => {
    setSubiendoDesde(i);
    setSubiendoPaso(kind === 'imagen-o-video' ? 'vídeo' : 'póster');
    elegir?.(file => {
      subir!(file, { kind })
        .then(({ url, dims }) => onChange(items.map((it, idx) => {
          if (idx !== i) return it;
          const out: Item = { ...it, [campo]: url };
          if (conDims && campoImagen!.dims) {
            if (dims) { out[campoImagen!.dims.w] = dims.w; out[campoImagen!.dims.h] = dims.h; }
            else { delete out[campoImagen!.dims.w]; delete out[campoImagen!.dims.h]; }
          }
          return out;
        })))
        .catch(err => onError?.(err instanceof Error ? err.message : 'No se pudo subir. Reintenta.'))
        .finally(() => setSubiendoPaso(null));
    }, { tipos, accept, msgError });
  };

  const agregar = () => {
    if (alMaxFoto) return;
    if (campoImagen && pedirImagen) {
      // Agregar = subir primero, luego crear el ítem con la url (y sus dims). Sin foto no hay ítem.
      setSubiendoDesde('agregar'); // la barra va pegada al botón "Agregar"
      pedirImagen((url, dims) => {
        const nuevo = conImagen(nuevoItem(), campoImagen, url, dims);
        onChange([...items, nuevo]);
        setExpandido(items.length); // expandir el nuevo para el resto de campos (p. ej. el alt)
      });
      return;
    }
    onChange([...items, nuevoItem()]);
    setExpandido(items.length);
  };

  const quitar = (i: number) => {
    onChange(items.filter((_, idx) => idx !== i));
    setExpandido(null);
  };

  const mover = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const nuevos = items.slice();
    [nuevos[i], nuevos[j]] = [nuevos[j], nuevos[i]];
    onChange(nuevos);
    setExpandido(j); // el ítem movido sigue expandido si lo estaba
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-3)' }}>
      {items.length === 0 && (
        <p className="duna-field__hint" style={{ margin: 0 }}>
          No hay {itemLabel.toLowerCase()}s todavía. Agrega el primero — mientras la lista esté vacía, la sección no se muestra en la tienda.
        </p>
      )}

      {items.map((item, i) => {
        const abierto = expandido === i;
        const { titulo, fragmento } = resumenDe(item, descriptores, itemLabel, i);
        const esVideo = item.tipo === 'video';
        // La miniatura de un VÍDEO es su PÓSTER (el `url` es un vídeo, un `<img>` con eso saldría roto).
        const miniatura = campoImagen ? String((esVideo ? item.poster : item[campoImagen.name]) ?? '') : '';
        return (
          <div key={i} className="duna-card" style={{ padding: 'var(--duna-space-3)' }}>
            {/* Renglón-resumen: (miniatura) + título + fragmento a la izquierda; controles a la derecha. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)' }}>
              {miniatura && (
                <span style={{ position: 'relative', flexShrink: 0, width: 40, height: 40 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={miniatura} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 'var(--duna-r-s)', border: '1px solid var(--duna-border)', display: 'block' }} />
                  {esVideo && <Film className="h-3 w-3" style={{ position: 'absolute', right: 2, bottom: 2, color: '#fff', filter: 'drop-shadow(0 0 2px rgba(0,0,0,.8))' }} aria-label="vídeo" />}
                </span>
              )}
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
                <button type="button" onClick={() => setPorEliminar(i)} aria-label={`Eliminar ${etiquetaItem(item).label}`} className="duna-btn duna-btn--ghost duna-btn--sm"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>

            {/* Expandido: los campos del ítem, por tipo. */}
            {abierto && (
              <div className="duna-form" style={{ marginTop: 'var(--duna-space-3)' }}>
                {descriptores.map(d => {
                  const id = `item-${i}-${d.name}`;
                  const valor = item[d.name];
                  const full = d.tipo === 'textarea' || d.tipo === 'imagen';
                  return (
                    <div key={d.name} className={`duna-field${full ? ' duna-form__full' : ''}`}>
                      <label className="duna-field__label" htmlFor={d.tipo === 'rating' || d.tipo === 'imagen' ? undefined : id}>{d.label}</label>
                      {d.tipo === 'rating' ? (
                        <RatingInput valor={Number(valor) || 0} onChange={v => editar(i, d.name, v)} />
                      ) : d.tipo === 'imagen' ? (
                        esVideo ? (
                          videoPendiente && videoPendiente.editar === i && !ocupado ? (
                            // Cambiar vídeo abre EL MISMO paso de póster que el alta, aquí en el ítem donde
                            // se clickeó: el póster se re-deriva del vídeo nuevo (scrubber), con "Subir una
                            // imagen" como alternativa. Cancelar no deja huérfano (nada subido).
                            <PosterScrubber
                              video={videoPendiente.file}
                              onPoster={(poster) => subirVideoYPoster(videoPendiente.file, poster, i)}
                              onSubirImagen={elegirPosterParaVideo}
                              onCancelar={() => setVideoPendiente(null)}
                            />
                          ) : (
                            // ÍTEM-VÍDEO: el preview es el PÓSTER (el `url` es un vídeo). "Cambiar vídeo"
                            // re-deriva su póster (§ cambiarVideo); "Cambiar póster" reemplaza sólo la imagen.
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-2)' }}>
                              {String(item.poster ?? '') && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={String(item.poster)} alt="" style={{ width: '100%', maxWidth: '240px', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 'var(--duna-r-m)', border: '1px solid var(--duna-border)' }} />
                              )}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-2)' }}>
                                <button type="button" onClick={() => cambiarVideo(i)} disabled={ocupado || !!videoPendiente} className="duna-btn duna-btn--secondary duna-btn--sm">
                                  <Film className="h-3.5 w-3.5" /> Cambiar vídeo
                                </button>
                                <button type="button" onClick={() => cambiarMedia(i, 'poster', 'imagen', false, TIPOS_PERMITIDOS, ACCEPT_IMAGENES, 'Formato no admitido. Usa JPG, PNG o WebP.')} disabled={ocupado || !!videoPendiente} className="duna-btn duna-btn--ghost duna-btn--sm">
                                  <Upload className="h-3.5 w-3.5" /> Cambiar póster
                                </button>
                              </div>
                              {ocupado && subiendoDesde === i && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <span className="duna-field__hint" style={{ margin: 0 }}>{textoPaso()}</span>
                                  {subiendoPaso !== 'convirtiendo' && <BarraProgreso pct={progreso ?? 0} />}
                                </div>
                              )}
                            </div>
                          )
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-2)' }}>
                            {String(valor ?? '') && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={String(valor)} alt="" style={{ width: '100%', maxWidth: '240px', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 'var(--duna-r-m)', border: '1px solid var(--duna-border)' }} />
                            )}
                            <div>
                              <button type="button" onClick={() => { setSubiendoDesde(i); pedirImagen?.((url, dims) => onChange(items.map((it, idx) => (idx === i ? conImagen(it, d, url, dims) : it)))); }} disabled={ocupado} className="duna-btn duna-btn--secondary duna-btn--sm">
                                <Upload className="h-3.5 w-3.5" /> {ocupado && subiendoDesde === i ? `Subiendo… ${progreso ?? 0}%` : 'Cambiar imagen'}
                              </button>
                            </div>
                            {/* La barra pegada a ESTE botón (sólo el ítem que sube). */}
                            {ocupado && subiendoDesde === i && <BarraProgreso pct={progreso ?? 0} />}
                          </div>
                        )
                      ) : d.tipo === 'textarea' ? (
                        <textarea id={id} className="duna-input" rows={2} value={String(valor ?? '')} onChange={e => editar(i, d.name, e.target.value)} aria-describedby={d.hint ? `${id}-hint` : undefined} />
                      ) : (
                        <input id={id} className="duna-input" value={String(valor ?? '')} onChange={e => editar(i, d.name, e.target.value)} aria-describedby={d.hint ? `${id}-hint` : undefined} />
                      )}
                      {d.hint && !(esVideo && d.tipo === 'imagen') && <p className="duna-field__hint" id={`${id}-hint`}>{d.hint}</p>}
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
          <button type="button" onClick={agregar} disabled={alMaxFoto || ocupado || !!videoPendiente} className="duna-btn duna-btn--secondary duna-btn--sm">
            <Plus className="h-3.5 w-3.5" /> {campoImagen && subiendo && subiendoDesde === 'agregar' ? `Subiendo… ${progreso ?? 0}%` : `Agregar ${itemLabel.toLowerCase()}`}
          </button>
          {aceptaVideo && (
            <button type="button" onClick={agregarVideo} disabled={alMaxVideo || ocupado || !!videoPendiente} className="duna-btn duna-btn--secondary duna-btn--sm">
              <Film className="h-3.5 w-3.5" /> Agregar vídeo
            </button>
          )}
        </div>

        {/* Paso del póster del ALTA (editar === null): el vídeo ya se eligió (RETENIDO, sin subir), y el
            póster sale de un FRAME del propio vídeo (scrubber). "Subir una imagen" es la ALTERNATIVA;
            Cancelar NO deja huérfano. El paso del CAMBIO va INLINE en su ítem (arriba). Cualquiera entra
            por subirVideoYPoster → el póster sube PRIMERO, después el vídeo. */}
        {videoPendiente && videoPendiente.editar === null && !ocupado && (
          <PosterScrubber
            video={videoPendiente.file}
            onPoster={(poster) => subirVideoYPoster(videoPendiente.file, poster, null)}
            onSubirImagen={elegirPosterParaVideo}
            onCancelar={() => setVideoPendiente(null)}
          />
        )}

        {/* La barra del alta —foto o vídeo—. En el vídeo, la ETIQUETA nombra el paso (convirtiendo/póster/
            vídeo) para que se lea como pasos, no como un reinicio. 'convirtiendo' no lleva barra (sin %). */}
        {ocupado && (subiendoDesde === 'agregar' || subiendoDesde === 'agregar-video') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '240px' }}>
            {subiendoDesde === 'agregar-video' && <span className="duna-field__hint" style={{ margin: 0 }}>{textoPaso()}</span>}
            {subiendoPaso !== 'convirtiendo' && <BarraProgreso pct={progreso ?? 0} />}
          </div>
        )}

        {alMaxFoto && (
          <p className="duna-field__hint" style={{ margin: 0 }}>Llegaste al máximo de {max} {itemLabel.toLowerCase()}s. Quita alguno para agregar otro.</p>
        )}
        {aceptaVideo && alMaxVideo && (
          <p className="duna-field__hint" style={{ margin: 0 }}>Llegaste al máximo de {maxVideo} vídeos. Quita alguno para agregar otro.</p>
        )}
      </div>

      {/* Confirmación de borrado — reusa ConfirmDescartarDialog (superficie centrada que NO descarta
          al tocar fuera, foco en la acción segura). El label y su artículo se derivan por TIPO del ítem
          que se va a borrar (§ etiquetaItem): "esta foto" / "este vídeo". */}
      {(() => { const etq = etiquetaItem(porEliminar !== null ? items[porEliminar] : undefined); return (
      <ConfirmDescartarDialog
        abierto={porEliminar !== null}
        onDescartar={() => { const i = porEliminar; setPorEliminar(null); if (i !== null) quitar(i); }}
        onSeguir={() => setPorEliminar(null)}
        titulo={`¿Eliminar est${etq.genero === 'f' ? 'a' : 'e'} ${etq.label}?`}
        descripcion="Se quita de la lista. Recuerda publicar para aplicar el cambio en la tienda."
        confirmLabel="Eliminar"
        seguirLabel="Conservar"
      />
      ); })()}
    </div>
  );
}
