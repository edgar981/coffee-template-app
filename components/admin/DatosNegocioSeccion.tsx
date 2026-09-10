'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';
import { useSiteSettings } from '@/components/admin/SiteSettingsProvider';
import { siteSettingsEditableSchema } from '@/lib/config/site-settings-schema';
import {
  METODOS_PAGO_ORDEN, CAMPOS_METODO, labelMetodo, metodoIncompleto,
  type MetodoPagoTipo, type MetodoPagoGuardado,
} from '@/lib/checkout/metodos-pago';
import { partirTelefono, componerTelefono, INDICATIVOS } from '@/lib/config/telefono';
import { useAccionGuardada } from '@/hooks/useAccionGuardada';
import { useDescarteDeDrawer } from '@/hooks/useDescarteDeDrawer';
import { ConfirmDescartarDialog } from '@/components/admin/ConfirmDescartarDialog';
import type { SiteSettings } from '@/lib/config/site-settings';

// Sección CONFIGURACIÓN DEL NEGOCIO: los campos PLANOS de SiteSetting (identidad y
// contacto). Los estructurados (footerNav, legalNav) siguen en código (v1). NO es el
// contenido del storefront (hero, fotos) — eso es la sección "Tienda", aparte.
//
// NACE EN LECTURA, no en formulario: son datos que se cambian dos o tres veces al año, y
// un form siempre abierto expone a un accidente algo que casi nunca se toca. "Editar" los
// vuelve editables; Guardar o Cancelar y vuelve a lectura.
//
// No hay un patrón lectura↔edición in-place que copiar (cliente/producto editan por
// modal), pero la MAQUINARIA de descarte SÍ se reusa: `useDescarteDeDrawer` (su `onCerrar`
// es "la salida real", acá salir de edición) + `ConfirmDescartarDialog`. Cancelar con
// cambios PREGUNTA; sin cambios vuelve directo. Al guardar, `router.refresh()` propaga los
// valores nuevos a todo el admin sin recargar a mano. Validación compartida con el PATCH
// (`siteSettingsEditableSchema`): aviso temprano por campo, el server manda.
//
// PAGOS PASÓ A LISTA (§ PAGOS-METODOS-MODELO-1): revierte el modelo de "4 booleanos fijos +
// un número compartido" — estar en la lista ES ofrecer el método, sin encendido/apagado
// aparte. Ésta es la forma NUEVA MÍNIMA (agregar/quitar + los campos de cada tipo); el
// pulido visual del mockup adoptado (grupos "Pagan antes"/"Pagan al recibir", el menú
// desplegable, confirmar al quitar, el toast con Deshacer) es la tanda siguiente
// (PAGOS-METODOS-UI-1), sobre esta misma rama.
//
// EL TELÉFONO se parte en indicativo+número SÓLO en esta frontera (`lib/config/telefono.ts`):
// el DATO sigue siendo UNA columna (`whatsapp`) — se COMPONE antes de validar contra el
// schema, que NO cambió para este campo. Ningún consumidor del valor compuesto se tocó
// (`whatsappUrl`, el footer, el checkout).

interface FormState {
  nombre: string; tagline: string; descripcionFooter: string;
  whatsappIndicativo: string; whatsappNumero: string;
  instagram: string; emailRemitente: string;
  emailReplyTo: string; adminEmail: string;
  metodosPago: MetodoPagoGuardado[];
}

// Los nombres de campo TEXTO PLANO que existen IDÉNTICOS en FormState y en SiteSettings — por
// eso un mismo `Campo[]` alimenta el `set()` de edición Y el `dt/dd` de lectura, sin castear.
// El teléfono (WhatsApp) y los métodos de pago quedan FUERA a propósito: el teléfono vive
// PARTIDO en el form (whatsappIndicativo/whatsappNumero) y COMPUESTO en SiteSettings
// (whatsapp) — cada lado tiene su propio control (`ControlTelefono` / texto plano); los
// métodos son su propia lista, con su propio renderer.
type CampoNombre =
  | 'nombre' | 'tagline' | 'descripcionFooter' | 'instagram'
  | 'emailRemitente' | 'emailReplyTo' | 'adminEmail';

type Campo = {
  name: CampoNombre;
  label: string;
  hint?: string;
  textarea?: boolean;
  full?: boolean;
};

const CAMPOS_IDENTIDAD: Campo[] = [
  { name: 'nombre',            label: 'Nombre del negocio' },
  { name: 'tagline',           label: 'Tagline',             hint: 'La línea bajo el nombre: ciudad o lema.' },
  { name: 'descripcionFooter', label: 'Descripción del pie', textarea: true, full: true, hint: 'El párrafo del footer del storefront.' },
];

const CAMPO_INSTAGRAM: Campo = { name: 'instagram', label: 'Instagram', hint: 'El usuario, sin @.' };

const CAMPOS_CORREOS: Campo[] = [
  { name: 'emailRemitente', label: 'Remitente de correos', full: true, hint: 'Cómo firman los correos de la tienda: "Nombre <correo@dominio>".' },
  { name: 'emailReplyTo',   label: 'Reply-To (opcional)', hint: 'A dónde responden los clientes. Vacío = sin reply-to propio.' },
  // adminEmail: el ÚNICO campo cuyo nombre no se explica solo — la etiqueta dice para qué sirve.
  { name: 'adminEmail',     label: 'Correo donde llegan los reportes del equipo', hint: 'Destinatario por defecto del resumen diario y el reporte semanal. Vacío = cada reporte usa los suyos.' },
];

// La descripción corta que acompaña al eyebrow de cada bloque (§ ADMIN-CONFIG-LECTURA-1): el
// eyebrow ROTULA, esto EXPLICA para qué es el bloque. Va al lado, no debajo — por eso el mismo
// renderer sirve en lectura y en edición (mismo esqueleto, § el principio del diseño).
const DESCRIPCION_BLOQUE = {
  Identidad: 'Cómo se nombra la tienda',
  Contacto:  'Por dónde te escriben los clientes',
  Correos:   'Desde dónde escribe la tienda y a dónde le llegan los reportes',
  Pagos:     'Cómo te pagan en el checkout',
} as const;

function renderEncabezadoBloque(eyebrow: keyof typeof DESCRIPCION_BLOQUE, style?: React.CSSProperties) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--duna-space-2)', flexWrap: 'wrap', ...style }}>
      <span className="duna-eyebrow">{eyebrow}</span>
      <span className="duna-caption">{DESCRIPCION_BLOQUE[eyebrow]}</span>
    </div>
  );
}

function desdeSettings(s: SiteSettings): FormState {
  const wa = partirTelefono(s.whatsapp);
  return {
    nombre:              s.nombre,
    tagline:             s.tagline,
    descripcionFooter:   s.descripcionFooter,
    whatsappIndicativo:  wa.indicativo,
    whatsappNumero:      wa.numero,
    instagram:           s.instagram,
    emailRemitente:      s.emailRemitente,
    emailReplyTo:        s.emailReplyTo ?? '',
    adminEmail:          s.adminEmail ?? '',
    metodosPago:         s.metodosPago,
  };
}

// SÓLO PRESENTACIÓN (§ ADMIN-CONFIG-LECTURA-1): la lectura muestra el indicativo separado del
// número (partir + volver a componer con el espacio que `componerTelefono` mete entre los dos).
// El dato guardado sigue siendo la columna compuesta tal cual — esto no la toca.
function telefonoDisplay(valor: string): string {
  const partido = partirTelefono(valor);
  return componerTelefono(partido.indicativo, partido.numero);
}

/** Los métodos de la lista, en el orden CANÓNICO — sin importar el orden de guardado ni el de
 *  agregado durante la edición. */
function enOrdenCanonico(metodos: MetodoPagoGuardado[]): MetodoPagoGuardado[] {
  return METODOS_PAGO_ORDEN
    .map(t => metodos.find(m => m.tipo === t))
    .filter((m): m is MetodoPagoGuardado => m !== undefined);
}

export default function DatosNegocioSeccion() {
  const settings = useSiteSettings();
  const router   = useRouter();
  const guarda   = useAccionGuardada();

  const [editando, setEditando]           = useState(false);
  const [form, setForm]                   = useState<FormState>(() => desdeSettings(settings));
  const [errores, setErrores]             = useState<Partial<Record<keyof FormState, string>>>({});
  const [errorServidor, setErrorServidor] = useState<string | null>(null);

  // Salir de edición = el "cierre real" que la guarda de descarte protege.
  const salirDeEdicion = () => { setEditando(false); setErrores({}); setErrorServidor(null); };
  const descarte = useDescarteDeDrawer({ enVuelo: guarda.enVuelo, onCerrar: salirDeEdicion });

  // ¿Hay cambios sin guardar? Se compara el form contra el valor actual del provider. Los dos
  // lados quedan PARTIDOS de la misma forma (`desdeSettings`), así que la comparación sigue
  // siendo consistente: abrir "Editar" sin tocar nada no debe verse sucio.
  const sucio = editando && JSON.stringify(form) !== JSON.stringify(desdeSettings(settings));
  useEffect(() => { descarte.marcarCambios(sucio); }, [sucio, descarte]);

  const abrirEdicion = () => {
    setForm(desdeSettings(settings)); // arranca de lo que hay hoy
    setErrores({});
    setErrorServidor(null);
    setEditando(true);
  };

  const set = (name: CampoNombre) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [name]: e.target.value }));

  // Los métodos que TODAVÍA no están en la lista — lo que ofrece el "+ Agregar".
  const faltantes = METODOS_PAGO_ORDEN.filter(t => !form.metodosPago.some(m => m.tipo === t));

  const agregarMetodo = (tipo: MetodoPagoTipo) => {
    setForm(f => ({ ...f, metodosPago: [...f.metodosPago, { tipo, datos: {} }] }));
  };
  const quitarMetodo = (tipo: MetodoPagoTipo) => {
    setForm(f => ({ ...f, metodosPago: f.metodosPago.filter(m => m.tipo !== tipo) }));
  };
  const setDatoMetodo = (tipo: MetodoPagoTipo, campo: string, valor: string) => {
    setForm(f => ({
      ...f,
      metodosPago: f.metodosPago.map(m => (m.tipo === tipo ? { ...m, datos: { ...m.datos, [campo]: valor } } : m)),
    }));
  };

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorServidor(null);

    // Se COMPONE antes de validar: el schema sigue validando el whatsapp COMPUESTO, tal cual
    // siempre. Si le pasáramos el form partido, zod strippearía `whatsapp` (no lo declara) y el
    // teléfono se perdería en silencio al guardar.
    const payload = {
      nombre:            form.nombre,
      tagline:           form.tagline,
      descripcionFooter: form.descripcionFooter,
      whatsapp:          componerTelefono(form.whatsappIndicativo, form.whatsappNumero),
      instagram:         form.instagram,
      emailRemitente:    form.emailRemitente,
      emailReplyTo:      form.emailReplyTo,
      adminEmail:        form.adminEmail,
      metodosPago:       form.metodosPago,
    };

    const parsed = siteSettingsEditableSchema.safeParse(payload);
    if (!parsed.success) {
      const errs: Partial<Record<keyof FormState, string>> = {};
      for (const issue of parsed.error.issues) {
        const campo = issue.path[0] as string;
        // El error del schema cae en el campo COMPUESTO, pero el form ya no tiene un control
        // con ese nombre: se mapea al slot del control de teléfono correspondiente.
        const destino: keyof FormState | undefined =
          campo === 'whatsapp' ? 'whatsappNumero' :
          (campo as keyof FormState);
        if (destino && !errs[destino]) errs[destino] = issue.message; // el primero por campo
      }
      setErrores(errs);
      return;
    }
    setErrores({});

    guarda.ejecutar(async () => {
      const res = await fetch('/api/site-settings', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErrorServidor(data?.error ?? 'No se pudo guardar. Intenta de nuevo.');
        return;
      }
      toast.success('Datos del negocio guardados.');
      setEditando(false);
      router.refresh(); // re-corre el layout server → el resto del admin ve lo nuevo
    });
  };

  return (
    <>
      {/* Encabezado de sección — el "Editar" vive acá (como "Agregar usuario" en equipo),
          y sólo en lectura: al editar, el ancla es "Guardar cambios" dentro del form. */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--duna-space-4)' }}>
        <div style={{ minWidth: 0 }}>
          <h2 className="duna-title">Datos del negocio</h2>
          <p className="duna-sub" style={{ marginTop: '3px', maxWidth: '42rem' }}>
            Identidad y contacto: cómo se nombra la tienda, por dónde la contactan y desde
            qué correo escribe. El contenido del storefront —fotos y textos— se edita aparte.
          </p>
        </div>
        {!editando && (
          <button
            type="button"
            onClick={abrirEdicion}
            className="duna-btn duna-btn--secondary"
            style={{ flexShrink: 0 }}
          >
            <Pencil /> Editar
          </button>
        )}
      </div>

      {editando ? (
        <form onSubmit={guardar} className="admin-bloques" style={{ marginTop: 'var(--duna-space-4)' }} noValidate>
          {/* Identidad */}
          <div className="admin-bloque">
            {renderEncabezadoBloque('Identidad', { marginBottom: 'var(--duna-space-3)' })}
            <div className="duna-form">
              {CAMPOS_IDENTIDAD.map(campo => renderCampoEdit(campo, form, errores, set))}
            </div>
          </div>

          {/* Contacto */}
          <div className="admin-bloque">
            {renderEncabezadoBloque('Contacto', { marginBottom: 'var(--duna-space-3)' })}
            <div className="duna-form">
              <ControlTelefono
                idBase="whatsapp"
                label="WhatsApp"
                hint="Con indicativo y número."
                error={errores.whatsappNumero}
                indicativo={form.whatsappIndicativo}
                numero={form.whatsappNumero}
                onIndicativo={v => setForm(f => ({ ...f, whatsappIndicativo: v }))}
                onNumero={v => setForm(f => ({ ...f, whatsappNumero: v }))}
              />
              {renderCampoEdit(CAMPO_INSTAGRAM, form, errores, set)}
            </div>
          </div>

          {/* Correos */}
          <div className="admin-bloque">
            {renderEncabezadoBloque('Correos', { marginBottom: 'var(--duna-space-3)' })}
            <div className="duna-form">
              {CAMPOS_CORREOS.map(campo => renderCampoEdit(campo, form, errores, set))}
            </div>
          </div>

          {/* Pagos — LISTA (§ PAGOS-METODOS-MODELO-1): estar acá ES ofrecerlo, sin encendido/
              apagado aparte. Agregar/quitar + los campos de cada uno, adentro. */}
          <div className="admin-bloque">
            {renderEncabezadoBloque('Pagos', { marginBottom: 'var(--duna-space-1)' })}
            <p className="duna-field__hint" style={{ marginTop: 0, marginBottom: 'var(--duna-space-3)' }}>
              Agrega los métodos que ofreces; cada uno pide sus datos aquí mismo. Un método sin sus
              datos no se muestra en la tienda.
            </p>

            {enOrdenCanonico(form.metodosPago).map(m => {
              const falta = metodoIncompleto(m);
              const campos = CAMPOS_METODO[m.tipo];
              return (
                <div key={m.tipo} className="admin-metodo is-on">
                  <div className="admin-metodo__head">
                    <div className="admin-metodo__fila" style={{ justifyContent: 'space-between' }}>
                      <span className="duna-field__label" style={{ margin: 0 }}>{labelMetodo(m.tipo)}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)' }}>
                        {falta && (
                          <span className="duna-badge duna-badge--attention">
                            <span className="duna-badge__dot" />{falta}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => quitarMetodo(m.tipo)}
                          className="duna-btn duna-btn--ghost duna-btn--sm"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  </div>
                  {campos.length > 0 && (
                    <div className="admin-metodo__config">
                      <div className="duna-form">
                        {campos.map(c => {
                          const id = `met-${m.tipo}-${c.name}`;
                          return (
                            <div className="duna-field" key={c.name}>
                              <label className="duna-field__label" htmlFor={id}>{c.label}</label>
                              <input
                                id={id}
                                className="duna-input"
                                value={m.datos[c.name] ?? ''}
                                onChange={e => setDatoMetodo(m.tipo, c.name, e.target.value)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {faltantes.length > 0 && (
              <div style={{ marginTop: 'var(--duna-space-3)' }}>
                <select
                  className="duna-input duna-select"
                  aria-label="Agregar método de pago"
                  value=""
                  onChange={e => {
                    const tipo = e.target.value as MetodoPagoTipo;
                    if (tipo) agregarMetodo(tipo);
                  }}
                >
                  <option value="" disabled>+ Agregar método de pago</option>
                  {faltantes.map(t => <option key={t} value={t}>{labelMetodo(t)}</option>)}
                </select>
              </div>
            )}

            {/* La lista no puede quedar vacía — el error del schema cae en `metodosPago`. */}
            {errores.metodosPago && (
              <p className="duna-field__error" style={{ marginTop: 'var(--duna-space-3)' }}>{errores.metodosPago}</p>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-3)' }}>
            <button type="submit" className="duna-btn duna-btn--primary" disabled={guarda.enVuelo}>
              {guarda.enVuelo ? 'Guardando…' : 'Guardar cambios'}
            </button>
            <button
              type="button"
              onClick={descarte.intentarCerrar}
              className="duna-btn duna-btn--ghost"
              disabled={guarda.enVuelo}
            >
              Cancelar
            </button>
            {errorServidor && (
              <p className="duna-field__error" role="alert" style={{ margin: 0 }}>{errorServidor}</p>
            )}
          </div>
        </form>
      ) : (
        <div className="admin-bloques" style={{ marginTop: 'var(--duna-space-4)' }}>
          <div className="admin-bloque">
            {renderEncabezadoBloque('Identidad', { marginBottom: 'var(--duna-space-3)' })}
            <dl className="duna-form" style={{ margin: 0 }}>
              {CAMPOS_IDENTIDAD.map(campo => renderCampoLectura(campo, settings))}
            </dl>
          </div>

          <div className="admin-bloque">
            {renderEncabezadoBloque('Contacto', { marginBottom: 'var(--duna-space-3)' })}
            <dl className="duna-form" style={{ margin: 0 }}>
              <div className="duna-field">
                <dt className="duna-field__label">WhatsApp</dt>
                <dd className="duna-body" style={{ margin: 0, wordBreak: 'break-word' }}>
                  {settings.whatsapp.trim()
                    ? telefonoDisplay(settings.whatsapp)
                    : <span style={{ color: 'var(--duna-muted)' }}>Sin definir</span>}
                </dd>
              </div>
              <div className="duna-field">
                <dt className="duna-field__label">Instagram</dt>
                <dd className="duna-body" style={{ margin: 0, wordBreak: 'break-word' }}>
                  {settings.instagram.trim()
                    ? `@${settings.instagram.trim()}`
                    : <span style={{ color: 'var(--duna-muted)' }}>Sin definir</span>}
                </dd>
              </div>
            </dl>
          </div>

          <div className="admin-bloque">
            {renderEncabezadoBloque('Correos', { marginBottom: 'var(--duna-space-3)' })}
            <dl className="duna-form" style={{ margin: 0 }}>
              {CAMPOS_CORREOS.map(campo => renderCampoLectura(campo, settings))}
            </dl>
          </div>

          {/* Pagos — MISMO esqueleto que edición, sin los controles de agregar/quitar. Un método
              en la lista sin sus datos muestra el mismo chip ámbar que en edición: el estado sale
              SIEMPRE de `metodoIncompleto`, nunca reimplementado acá. */}
          <div className="admin-bloque">
            {renderEncabezadoBloque('Pagos', { marginBottom: 'var(--duna-space-1)' })}
            <p className="duna-field__hint" style={{ marginTop: 0, marginBottom: 'var(--duna-space-3)' }}>
              Los métodos que ofreces en el checkout. Un método sin sus datos no se muestra en la
              tienda.
            </p>

            {settings.metodosPago.length === 0 ? (
              <p className="duna-body" style={{ margin: 0, color: 'var(--duna-muted)' }}>
                No hay ningún método de pago configurado.
              </p>
            ) : settings.metodosPago.map(m => {
              const falta = metodoIncompleto(m);
              const campos = CAMPOS_METODO[m.tipo];
              return (
                <div key={m.tipo} className="admin-metodo is-on">
                  <div className="admin-metodo__head">
                    <div className="admin-metodo__fila" style={{ justifyContent: 'space-between' }}>
                      <span className="duna-field__label" style={{ margin: 0 }}>{labelMetodo(m.tipo)}</span>
                      {falta && (
                        <span className="duna-badge duna-badge--attention">
                          <span className="duna-badge__dot" />{falta}
                        </span>
                      )}
                    </div>
                  </div>
                  {campos.length > 0 && (
                    <div className="admin-metodo__config">
                      <dl className="duna-form" style={{ margin: 0 }}>
                        {campos.map(c => (
                          <div className="duna-field" key={c.name}>
                            <dt className="duna-field__label">{c.label}</dt>
                            <dd className="duna-body" style={{ margin: 0, wordBreak: 'break-word' }}>
                              {(m.datos[c.name] ?? '').trim()
                                || <span style={{ color: 'var(--duna-muted)' }}>Sin definir</span>}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ConfirmDescartarDialog
        abierto={descarte.confirmando}
        onDescartar={descarte.descartar}
        onSeguir={descarte.seguirEditando}
      />
    </>
  );
}

// ── Helpers de render, sacados de un `.map` para que cada bloque los reuse sin duplicar JSX ──

function renderCampoEdit(
  campo: Campo,
  form: FormState,
  errores: Partial<Record<keyof FormState, string>>,
  set: (name: CampoNombre) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void,
) {
  const err = errores[campo.name];
  const id  = `neg-${campo.name}`;
  const describedBy = err ? `${id}-err` : campo.hint ? `${id}-hint` : undefined;
  return (
    <div key={campo.name} className={`duna-field${campo.full ? ' duna-form__full' : ''}`}>
      <label className="duna-field__label" htmlFor={id}>{campo.label}</label>
      {campo.textarea ? (
        <textarea
          id={id} className="duna-input" rows={2}
          value={form[campo.name]} onChange={set(campo.name)}
          aria-invalid={err ? true : undefined} aria-describedby={describedBy}
        />
      ) : (
        <input
          id={id} className="duna-input"
          value={form[campo.name]} onChange={set(campo.name)}
          aria-invalid={err ? true : undefined} aria-describedby={describedBy}
        />
      )}
      {err
        ? <p className="duna-field__error" id={`${id}-err`}>{err}</p>
        : campo.hint && <p className="duna-field__hint" id={`${id}-hint`}>{campo.hint}</p>}
    </div>
  );
}

function renderCampoLectura(campo: Campo, settings: SiteSettings) {
  const texto = (settings[campo.name] ?? '').toString().trim();
  return (
    <div key={campo.name} className={`duna-field${campo.full ? ' duna-form__full' : ''}`}>
      <dt className="duna-field__label">{campo.label}</dt>
      <dd className="duna-body" style={{ margin: 0, wordBreak: 'break-word' }}>
        {texto || <span style={{ color: 'var(--duna-muted)' }}>Sin definir</span>}
      </dd>
    </div>
  );
}

// El control de TELÉFONO: indicativo (select) + número (input) en UNA fila
// (§ ADMIN-CONFIG-REDISENO-1). Es el ÚNICO sitio donde hace falta un ancho a mano —el
// select—; el `flex-wrap` es la red para que no se desborde en angosto. El DATO sigue
// siendo un valor compuesto (`componerTelefono`); acá sólo vive partido, para editar.
function ControlTelefono({
  idBase, label, hint, error, indicativo, numero, onIndicativo, onNumero,
}: {
  idBase: string;
  label: string;
  hint?: string;
  error?: string;
  indicativo: string;
  numero: string;
  onIndicativo: (v: string) => void;
  onNumero: (v: string) => void;
}) {
  const id = `neg-${idBase}`;
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className="duna-field">
      <label className="duna-field__label" htmlFor={`${id}-numero`}>{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-2)' }}>
        <select
          className="duna-input duna-select"
          style={{ width: '104px', flexShrink: 0 }}
          aria-label={`Indicativo de ${label}`}
          value={indicativo}
          onChange={e => onIndicativo(e.target.value)}
        >
          <option value="">—</option>
          {INDICATIVOS.map(i => (
            <option key={i.valor} value={i.valor}>{i.valor} {i.label}</option>
          ))}
        </select>
        <input
          id={`${id}-numero`}
          className="duna-input"
          style={{ flex: '1 1 160px', minWidth: 0 }}
          value={numero}
          onChange={e => onNumero(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
      </div>
      {error
        ? <p className="duna-field__error" id={`${id}-err`}>{error}</p>
        : hint && <p className="duna-field__hint" id={`${id}-hint`}>{hint}</p>}
    </div>
  );
}
