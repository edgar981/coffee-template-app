'use client';

import { useState } from 'react';
import { Upload, ImageIcon, Film } from 'lucide-react';
import { useSubidaImagen } from '@/components/admin/useSubidaImagen';
import PosterScrubber from '@/components/admin/PosterScrubber';
import BarraProgreso from '@/components/admin/BarraProgreso';
import { OPCIONES_CTA_DESTINO } from '@/components/admin/tienda-secciones';
import { remuxMovAMp4 } from '@/lib/video-remux';
import {
  MAX_SUBIDA_DIRECTA_MB, TIPOS_PERMITIDOS, TIPOS_VIDEO, ACCEPT_IMAGENES, ACCEPT_VIDEO,
  MSG_VIDEO_NO_ADMITIDO, CONTENEDORES_REMUXEABLES, MAX_VIDEO_HERO_BYTES, MSG_VIDEO_HERO_LARGO,
} from '@/constants/upload';
import { InstanciaItemsEditor } from '@/components/admin/editor/InstanciaItemsEditor';
import { SelectorMovimiento } from '@/components/admin/editor/SelectorMovimiento';
import { VistaMovimiento } from '@/components/admin/editor/VistaMovimiento';
import {
  DESCRIPTOR_INSTANCIA, type InstanciaContent, type InstanciaVideoContent, type SeccionInstanciaTipo,
} from '@/lib/config/secciones-instancias';

const MAX_VIDEO_HERO_MB = MAX_VIDEO_HERO_BYTES / (1024 * 1024);

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
// § SECCIONES-TIPOS-3 — "disposicion"/"modo" se suman a los escalares ya conocidos; "lado" se
// REUSA tal cual (mismas dos claves que ya usa "imagenTexto", § secciones-instancias.ts).
const LABEL_ESCALAR: Record<string, string> = {
  alineacion: 'Alineación', lado: 'Lado de la imagen', alto: 'Alto', disposicion: 'Chicas', modo: 'Modo',
};
const LABEL_VALOR_ESCALAR: Record<string, Record<string, string>> = {
  alineacion: { izquierda: 'Izquierda', centro: 'Centro', derecha: 'Derecha' },
  lado: { izquierda: 'Izquierda', derecha: 'Derecha' },
  alto: { justo: 'Justo', alto: 'Alto', pantalla: 'Pantalla completa' },
  disposicion: { dos: 'Dos chicas', cuatro: 'Cuatro chicas' },
  modo: { fondo: 'Fondo, con texto encima', reproducir: 'Reproducir al tocar' },
};
// § SECCIONES-CARRUSEL-1 — el PRIMER (y hoy único) booleano de INSTANCIA del catálogo
// (`DESCRIPTOR_INSTANCIA.carrusel.booleanos`). Mismo patrón de mapas por NOMBRE que los de arriba:
// una lista fija alcanza porque no hay más de un booleano de instancia hoy.
const LABEL_BOOLEANO: Record<string, string> = {
  autoplay: 'Avance automático',
};
const HINT_BOOLEANO: Record<string, string> = {
  autoplay: 'Avanza solo cada pocos segundos. Se pausa al pasar el mouse, con foco o al tocar. Apagado por defecto.',
};
// § EDITOR-PANEL-CONTROLES-1 — un COMPORTAMIENTO, no un ON/OFF: el spec lo nombra textual ("el
// carrusel que avanza solo" → segmentado "Solo" / "A mano"). `[false, true]`: el índice 0 es la
// palabra para `false`, el 1 para `true` — el orden que lee `OPCIONES_SEGMENTO_BOOLEANO[campo]`.
const OPCIONES_SEGMENTO_BOOLEANO: Record<string, [string, string]> = {
  autoplay: ['A mano', 'Solo'],
};
// § SECCIONES-TIPOS-2/3/SECCIONES-CARRUSEL-1 — el nombre SINGULAR de un ítem de cada tipo REPEATER,
// para `InstanciaItemsEditor` (sus botones: "Agregar pregunta", "¿Eliminar esta columna?"). Sólo
// cubre los tipos con `descriptor.items`; los demás nunca llegan al bloque que lo consume.
const ITEM_LABEL: Partial<Record<SeccionInstanciaTipo, string>> = {
  preguntas: 'pregunta',
  columnas: 'columna',
  filas: 'fila',
  collage: 'foto',
  carrusel: 'diapositiva',
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

  // § SECCIONES-TIPOS-3 — "video": `imagen`/`poster` NO pasan por el bloque genérico de imagen de
  // abajo (que trataría cada uno como una foto suelta, con su propio "Agregar foto"): van en el
  // bloque bespoke de más abajo, que sube el PAR juntos con el mismo pipeline que el hero. El resto
  // de los tipos (banner, imagenTexto…) sigue exactamente igual.
  const esVideoInstancia = tipo === 'video';
  const camposImagen = new Set(descriptor.imagenes ?? []);
  if (esVideoInstancia) { camposImagen.delete('imagen'); camposImagen.delete('poster'); }
  const camposTexto = Object.entries(descriptor.campos).filter(([campo]) => !camposImagen.has(campo) && !(esVideoInstancia && (campo === 'imagen' || campo === 'poster')));

  // ── EL VIDEO DE "video" (§ SECCIONES-TIPOS-3) — MISMA secuencia que el video del hero en
  // `TiendaSeccionEditor.tsx` (video elegido y RETENIDO hasta elegir el póster — cancelar no deja un
  // video huérfano—, remux si es .mov, EL PÓSTER SUBE PRIMERO), adaptada a este formulario bespoke:
  // "video" no es un repeater, así que no hay índice de ítem ni `InstanciaItemsEditor` que reusar.
  // MISMO TOPE que el hero (§ MAX_VIDEO_HERO_BYTES, el spec: "mismo tope y mismo pipeline de subida
  // que el hero") — más chico que el de la galería/collage porque esta sección, en modo 'fondo',
  // está siempre en el viewport sin forma de diferir la descarga.
  const [videoPendiente, setVideoPendiente] = useState<File | null>(null);
  const [convirtiendo, setConvirtiendo] = useState(false);
  const [subiendoPasoVideo, setSubiendoPasoVideo] = useState<'convirtiendo' | 'póster' | 'vídeo' | null>(null);
  const ocupadoVideo = subida.subiendo || convirtiendo;
  const textoPasoVideo = () => (subiendoPasoVideo === 'convirtiendo' ? 'Convirtiendo el video…' : `Subiendo ${subiendoPasoVideo}… ${subida.progreso ?? 0}%`);

  const agregarVideo = () => {
    subida.elegir((f) => {
      const esMov = (CONTENEDORES_REMUXEABLES as readonly string[]).includes(f.type);
      const limite = esMov ? MAX_VIDEO_HERO_BYTES * 1.5 : MAX_VIDEO_HERO_BYTES;
      if (f.size > limite) { setErrorSubida(MSG_VIDEO_HERO_LARGO); return; }
      setVideoPendiente(f);
    }, { tipos: TIPOS_VIDEO, accept: ACCEPT_VIDEO, msgError: MSG_VIDEO_NO_ADMITIDO });
  };

  const subirVideoYPoster = async (video: File, poster: File) => {
    try {
      let videoFinal = video;
      if ((CONTENEDORES_REMUXEABLES as readonly string[]).includes(video.type)) {
        setSubiendoPasoVideo('convirtiendo');
        setConvirtiendo(true);
        try { videoFinal = await remuxMovAMp4(video); }
        finally { setConvirtiendo(false); }
        if (videoFinal.size > MAX_VIDEO_HERO_BYTES) throw new Error(MSG_VIDEO_HERO_LARGO);
      }
      setSubiendoPasoVideo('póster');
      const { url: posterUrl } = await subida.subir(poster, { kind: 'imagen' });
      setSubiendoPasoVideo('vídeo');
      const { url: videoUrl } = await subida.subir(videoFinal, { kind: 'imagen-o-video' });
      // LOS DOS A LA VEZ (§ el orden es la garantía, como el video del hero): nunca un `imagen` de
      // video sin su `poster`.
      onCambiar({ ...instancia, imagen: videoUrl, poster: posterUrl } as InstanciaContent);
    } catch (err) {
      setErrorSubida(err instanceof Error ? err.message : 'No se pudo subir el video. Reintenta.');
    } finally {
      setVideoPendiente(null);
      setSubiendoPasoVideo(null);
    }
  };

  const elegirPosterVideo = () => {
    if (!videoPendiente) return;
    subida.elegir((poster) => subirVideoYPoster(videoPendiente, poster), { tipos: TIPOS_PERMITIDOS, accept: ACCEPT_IMAGENES, msgError: 'Formato no admitido. Usa JPG, PNG o WebP.' });
  };

  const quitarVideo = () => onCambiar({ ...instancia, imagen: '', poster: '' } as InstanciaContent);

  return (
    <div className="admin-bloques">
      <input ref={subida.inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={subida.alElegir} hidden disabled={subida.subiendo} />
      {/* § SECCIONES-TIPOS-3 — segundo input para el flujo "elegir sin subir" (alta de video, acá o
          en `InstanciaItemsEditor` vía `elegir`/`subir`); su `accept` lo fija `subida.elegir` por
          llamada — mismo patrón que `TiendaSeccionEditor.tsx` para el video del hero. */}
      <input ref={subida.inputHoldRef} type="file" onChange={subida.alElegirHold} hidden />
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

        {descriptor.escalares && Object.keys(descriptor.escalares)
          // § MOVIMIENTO-EDITOR-EXPOSICION-1 — `animacion` NO entra al `<select>` nativo genérico
          // de abajo: tiene su PROPIO control (tarjetas con mini-loop, bloque aparte). El escalar
          // sigue viviendo en `descriptor.escalares` (clamp/almacenamiento), sólo cambia quién lo
          // RENDERIZA.
          .filter((campo) => campo !== 'animacion')
          .map((campo) => {
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

        {/* § MOVIMIENTO-EDITOR-EXPOSICION-1 — el ajuste «Animación»: tarjetas con mini-loop
            («Ninguna» primero) + la vista previa quieta con «Ver animación» junto al ajuste (una de
            las dos ubicaciones que el spec permite — la otra es la barra flotante del iframe, fuera
            de `touches:`). Sólo los tipos que `DESCRIPTOR_INSTANCIA` declara con
            `animacionElemento` lo ofrecen. */}
        {descriptor.animacionElemento && (
          <div className="duna-field duna-form__full">
            <span className="duna-field__label">Animación</span>
            <p className="duna-field__hint" style={{ marginTop: 0 }}>
              Elegir una no la reproduce acá: la página del editor queda quieta. Corre en la tienda
              publicada, al hacer scroll.
            </p>
            <SelectorMovimiento
              id={`inst-animacion-${tipo}`}
              elemento={descriptor.animacionElemento}
              valor={datos.animacion ?? ''}
              onElegir={(v) => set('animacion', v)}
              ariaLabel="Animación"
            />
            <VistaMovimiento elemento={descriptor.animacionElemento} animacion={datos.animacion ?? ''} />
          </div>
        )}

        {/* § EDITOR-PANEL-CONTROLES-1 — BOOLEANOS de instancia (hoy, sólo `carrusel.autoplay`): un
            COMPORTAMIENTO, no un ON/OFF — segmentado con palabras (`.duna-seg`, ya primitiva del
            sistema), no `.duna-switch`. Dos formas para el mismo control sería la misma trampa que
            el resto de este archivo evita por nombre. */}
        {descriptor.booleanos && descriptor.booleanos.map((campo) => {
          const on = (datos as unknown as Record<string, unknown>)[campo] === true;
          const [labelOff, labelOn] = OPCIONES_SEGMENTO_BOOLEANO[campo] ?? ['No', 'Sí'];
          return (
            <div key={campo} className="duna-field">
              <span className="duna-field__label">{LABEL_BOOLEANO[campo] ?? campo}</span>
              <div className="duna-seg editor-seg-full" role="group" aria-label={LABEL_BOOLEANO[campo] ?? campo} style={{ marginTop: 'var(--duna-space-2)' }}>
                <button
                  type="button"
                  aria-pressed={!on}
                  onClick={() => onCambiar({ ...instancia, [campo]: false } as InstanciaContent)}
                  className={`duna-seg__item${!on ? ' is-on' : ''}`}
                >
                  {labelOff}
                </button>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => onCambiar({ ...instancia, [campo]: true } as InstanciaContent)}
                  className={`duna-seg__item${on ? ' is-on' : ''}`}
                >
                  {labelOn}
                </button>
              </div>
              {HINT_BOOLEANO[campo] && (
                <p className="duna-field__hint" style={{ marginTop: 'var(--duna-space-2)' }}>{HINT_BOOLEANO[campo]}</p>
              )}
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

        {/* § SECCIONES-TIPOS-3 — "video": el PAR `imagen`+`poster` sube JUNTO con el mismo
            pipeline que el hero (elegir video → scrubber de póster → subir póster → subir video),
            nunca como dos campos de imagen sueltos. */}
        {esVideoInstancia && (() => {
          const videoInst = instancia as InstanciaVideoContent;
          return (
          <div className="duna-field duna-form__full">
            <span className="duna-field__label">Video</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-2)', marginTop: 'var(--duna-space-1)' }}>
              {videoPendiente && !ocupadoVideo ? (
                <PosterScrubber
                  video={videoPendiente}
                  onPoster={(poster) => subirVideoYPoster(videoPendiente, poster)}
                  onSubirImagen={elegirPosterVideo}
                  onCancelar={() => setVideoPendiente(null)}
                />
              ) : (
                <>
                  {videoInst.imagen && (
                    <div className="duna-tile" style={{ width: 'calc(var(--duna-thumb-w) * 2)' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {videoInst.poster ? <img src={videoInst.poster} alt="" /> : <Film aria-hidden width={20} height={20} />}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-2)' }}>
                    <button type="button" onClick={agregarVideo} disabled={ocupadoVideo} className="duna-btn duna-btn--secondary duna-btn--sm">
                      <Film className="h-3.5 w-3.5" /> {videoInst.imagen ? 'Cambiar video' : 'Agregar video'}
                    </button>
                    {videoInst.imagen && (
                      <button type="button" onClick={quitarVideo} disabled={ocupadoVideo} className="duna-btn duna-btn--ghost duna-btn--sm">
                        Quitar
                      </button>
                    )}
                  </div>
                  {errorSubida ? (
                    <span className="duna-field__error" role="alert">{errorSubida}</span>
                  ) : ocupadoVideo ? (
                    <span className="duna-field__hint" style={{ margin: 0 }}>{textoPasoVideo()}</span>
                  ) : (
                    <span className="duna-field__hint" style={{ margin: 0 }}>MP4, WebM o MOV · máx {MAX_VIDEO_HERO_MB} MB. El póster se elige de un cuadro del propio video.</span>
                  )}
                  {ocupadoVideo && subiendoPasoVideo !== 'convirtiendo' && <BarraProgreso pct={subida.progreso ?? 0} />}
                </>
              )}
            </div>
          </div>
          );
        })()}
      </div>

      {/* § SECCIONES-TIPOS-2/3 — el REPEATER (Preguntas/Columnas/Filas/Collage): el array `items`
          vive APARTE de los campos planos de arriba (que acá sólo son la cabecera — `titulo`), en
          su propio bloque, como en `TiendaSeccionEditor` una sección repeater separa su encabezado
          de su `RepeaterEditor`. El uploader es el MISMO `subida` de arriba (un solo `<input>`).
          `conVideo` (§ SECCIONES-TIPOS-3) sólo se enciende para "collage" — sus ítems son foto O
          VIDEO; los tres repeater de § SECCIONES-TIPOS-2 siguen sin él, foto-solo como siempre. */}
      {descriptor.items && (
        <div className="admin-bloque" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-3)' }}>
          <InstanciaItemsEditor
            items={(instancia as unknown as { items?: Record<string, string>[] }).items ?? []}
            descriptor={descriptor.items.descriptor}
            min={descriptor.items.min}
            max={descriptor.items.max}
            itemLabel={ITEM_LABEL[tipo] ?? 'ítem'}
            conVideo={tipo === 'collage'}
            pedirImagen={subida.pedir}
            elegir={subida.elegir}
            subir={subida.subir}
            subiendo={subida.subiendo}
            progreso={subida.progreso}
            onError={setErrorSubida}
            onCambiar={(nuevos) => onCambiar({ ...instancia, items: nuevos } as unknown as InstanciaContent)}
          />
          {errorSubida && <span className="duna-field__error" role="alert">{errorSubida}</span>}
        </div>
      )}
    </div>
  );
}

export default InstanciaEditorForm;
