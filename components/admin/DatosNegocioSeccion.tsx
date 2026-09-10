'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';
import { useSiteSettings } from '@/components/admin/SiteSettingsProvider';
import { siteSettingsEditableSchema } from '@/lib/config/site-settings-schema';
import { estadoMetodoEditor, type MetodoPagoId, type SettingsMetodos } from '@/lib/checkout/metodos-pago';
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
// REDISEÑO (ADMIN-CONFIG-REDISENO-1): la sección pasa del `CAMPOS.map` plano dentro de UNA
// tarjeta al modelo de BLOQUES que `/admin/tienda` ya usaba —`.admin-bloques`/`.admin-bloque`,
// generalizado de `.tienda-form`/`.tienda-form__bloque` acá mismo, en `duna.css`, porque
// Configuración es su SEGUNDO consumidor—. Cuatro piezas: Identidad · Contacto · Correos ·
// Pagos (con la config de cada método ADENTRO, § abajo).
//
// EL TELÉFONO se parte en indicativo+número SÓLO en esta frontera (`lib/config/telefono.ts`):
// el DATO sigue siendo UNA columna (`whatsapp`, `pagoMovilNumero`) — se COMPONE antes de
// validar contra el schema, que NO cambió. Ningún consumidor del valor compuesto se tocó
// (`whatsappUrl`, el footer, el checkout).

interface FormState {
  nombre: string; tagline: string; descripcionFooter: string;
  whatsappIndicativo: string; whatsappNumero: string;
  instagram: string; emailRemitente: string;
  emailReplyTo: string; adminEmail: string;
  bancoNombre: string; bancoTipoCuenta: string; bancoNumeroCuenta: string; bancoTitular: string;
  // Métodos de pago (toggles) + el número de pago móvil, partido para editar.
  pagoNequiActivo: boolean; pagoDaviplataActivo: boolean; pagoTransferenciaActivo: boolean; pagoEfectivoActivo: boolean;
  movilIndicativo: string; movilNumero: string;
}

// Sólo las claves booleanas de FormState (para el toggle de cada método).
type FormBoolKey = { [K in keyof FormState]: FormState[K] extends boolean ? K : never }[keyof FormState];

// Los nombres de campo TEXTO PLANO que existen IDÉNTICOS en FormState y en SiteSettings — por
// eso un mismo `Campo[]` alimenta el `set()` de edición Y el `dt/dd` de lectura, sin castear.
// El teléfono (WhatsApp, pago móvil) queda FUERA a propósito: en el form vive PARTIDO
// (whatsappIndicativo/whatsappNumero, movilIndicativo/movilNumero) y en SiteSettings vive
// COMPUESTO (whatsapp, pagoMovilNumero) — cada lado tiene su propio control
// (`ControlTelefono` / texto plano), no este renderer genérico.
type CampoNombre =
  | 'nombre' | 'tagline' | 'descripcionFooter' | 'instagram'
  | 'emailRemitente' | 'emailReplyTo' | 'adminEmail'
  | 'bancoNombre' | 'bancoTipoCuenta' | 'bancoNumeroCuenta' | 'bancoTitular';

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

// La config de la sub-pieza «Transferencia bancaria» (§ Pagos). El hint del primer campo
// enmarca el grupo; con los esenciales (banco+tipo+número) vacíos, ese método no se muestra.
const CAMPOS_BANCO: Campo[] = [
  { name: 'bancoNombre',       label: 'Banco', hint: 'La cuenta del método "Transferencia bancaria" del checkout. Deja banco, tipo y número vacíos y ese método no se muestra.' },
  { name: 'bancoTipoCuenta',   label: 'Tipo de cuenta', hint: 'Ahorros o Corriente.' },
  { name: 'bancoNumeroCuenta', label: 'Número de cuenta' },
  { name: 'bancoTitular',      label: 'Titular de la cuenta (opcional)', hint: 'A nombre de quién está la cuenta. Vacío: no se muestra.' },
];

// Los 4 métodos, para el bloque de toggles. El campo booleano de cada uno en el form.
const METODOS_PAGO: { id: MetodoPagoId; activoKey: FormBoolKey; label: string }[] = [
  { id: 'nequi',         activoKey: 'pagoNequiActivo',         label: 'Nequi' },
  { id: 'daviplata',     activoKey: 'pagoDaviplataActivo',     label: 'Daviplata' },
  { id: 'transferencia', activoKey: 'pagoTransferenciaActivo', label: 'Transferencia bancaria' },
  { id: 'efectivo',      activoKey: 'pagoEfectivoActivo',      label: 'Contra entrega (efectivo)' },
];

function desdeSettings(s: SiteSettings): FormState {
  const wa    = partirTelefono(s.whatsapp);
  const movil = partirTelefono(s.pagoMovilNumero ?? '');
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
    bancoNombre:         s.bancoNombre ?? '',
    bancoTipoCuenta:     s.bancoTipoCuenta ?? '',
    bancoNumeroCuenta:   s.bancoNumeroCuenta ?? '',
    bancoTitular:        s.bancoTitular ?? '',
    pagoNequiActivo:         s.pagoNequiActivo,
    pagoDaviplataActivo:     s.pagoDaviplataActivo,
    pagoTransferenciaActivo: s.pagoTransferenciaActivo,
    pagoEfectivoActivo:      s.pagoEfectivoActivo,
    movilIndicativo:     movil.indicativo,
    movilNumero:         movil.numero,
  };
}

// La forma que `estadoMetodoEditor` espera (`SettingsMetodos`), armada desde el form EN
// EDICIÓN: compone el teléfono partido de vuelta a un valor EFÍMERO, sólo para evaluar el
// predicado compartido — NO es lo que se guarda; `guardar()` compone su propio payload.
function comoMetodos(form: FormState): SettingsMetodos {
  return {
    bancoNombre:       form.bancoNombre,
    bancoTipoCuenta:   form.bancoTipoCuenta,
    bancoNumeroCuenta: form.bancoNumeroCuenta,
    bancoTitular:      form.bancoTitular,
    pagoNequiActivo:         form.pagoNequiActivo,
    pagoDaviplataActivo:     form.pagoDaviplataActivo,
    pagoTransferenciaActivo: form.pagoTransferenciaActivo,
    pagoEfectivoActivo:      form.pagoEfectivoActivo,
    pagoMovilNumero: componerTelefono(form.movilIndicativo, form.movilNumero),
  };
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

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorServidor(null);

    // Se COMPONE antes de validar: el schema sigue validando el valor COMPUESTO, tal cual
    // siempre. Si le pasáramos el form partido, zod strippearía `whatsapp`/`pagoMovilNumero`
    // (no los declara) y el teléfono se perdería en silencio al guardar.
    const payload = {
      nombre:            form.nombre,
      tagline:           form.tagline,
      descripcionFooter: form.descripcionFooter,
      whatsapp:          componerTelefono(form.whatsappIndicativo, form.whatsappNumero),
      instagram:         form.instagram,
      emailRemitente:    form.emailRemitente,
      emailReplyTo:      form.emailReplyTo,
      adminEmail:        form.adminEmail,
      bancoNombre:       form.bancoNombre,
      bancoTipoCuenta:   form.bancoTipoCuenta,
      bancoNumeroCuenta: form.bancoNumeroCuenta,
      bancoTitular:      form.bancoTitular,
      pagoNequiActivo:         form.pagoNequiActivo,
      pagoDaviplataActivo:     form.pagoDaviplataActivo,
      pagoTransferenciaActivo: form.pagoTransferenciaActivo,
      pagoEfectivoActivo:      form.pagoEfectivoActivo,
      pagoMovilNumero:         componerTelefono(form.movilIndicativo, form.movilNumero),
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
          campo === 'pagoMovilNumero' ? 'movilNumero' :
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

  // Estados de los tres métodos con config, para el aviso "Encendido — falta configurarlo"
  // (§ Pagos). Reusa `estadoMetodoEditor` — NO se reimplementa ese predicado.
  const metodos          = comoMetodos(form);
  const nequiEstado      = estadoMetodoEditor(metodos, 'nequi');
  const daviplataEstado  = estadoMetodoEditor(metodos, 'daviplata');
  const transfEstado     = estadoMetodoEditor(metodos, 'transferencia');
  const movilFaltaDatos  = nequiEstado === 'activo_sin_datos' || daviplataEstado === 'activo_sin_datos';
  const transfFaltaDatos = transfEstado === 'activo_sin_datos';

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
            <div className="duna-eyebrow" style={{ marginBottom: 'var(--duna-space-3)' }}>Identidad</div>
            <div className="duna-form">
              {CAMPOS_IDENTIDAD.map(campo => renderCampoEdit(campo, form, errores, set))}
            </div>
          </div>

          {/* Contacto */}
          <div className="admin-bloque">
            <div className="duna-eyebrow" style={{ marginBottom: 'var(--duna-space-3)' }}>Contacto</div>
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
            <div className="duna-eyebrow" style={{ marginBottom: 'var(--duna-space-3)' }}>Correos</div>
            <div className="duna-form">
              {CAMPOS_CORREOS.map(campo => renderCampoEdit(campo, form, errores, set))}
            </div>
          </div>

          {/* Pagos — cada método con su config ADENTRO (§ el defecto que este bloque arregla:
              antes los 4 checkboxes vivían al fondo y sus datos, arriba, lejos del toggle). */}
          <div className="admin-bloque">
            <div className="duna-eyebrow" style={{ marginBottom: 'var(--duna-space-1)' }}>Pagos</div>
            <p className="duna-field__hint" style={{ marginTop: 0, marginBottom: 'var(--duna-space-3)' }}>
              Enciende los que ofreces. Uno encendido sin sus datos (número, cuenta) no se muestra hasta completarlo.
            </p>

            {/* a) Pago móvil — Nequi y Daviplata comparten el mismo número. */}
            <div className={`admin-metodo${(form.pagoNequiActivo || form.pagoDaviplataActivo) ? ' is-on' : ''}`}>
              <div className="admin-metodo__head">
                {(['nequi', 'daviplata'] as const).map(id => {
                  const m = METODOS_PAGO.find(x => x.id === id)!;
                  const activo = form[m.activoKey];
                  return (
                    <div key={id} className="admin-metodo__fila">
                      <button
                        type="button" role="switch" aria-checked={activo}
                        aria-label={`Encender ${m.label}`}
                        onClick={() => setForm(f => ({ ...f, [m.activoKey]: !f[m.activoKey] }))}
                        className={`duna-switch${activo ? ' is-on' : ''}`}
                      >
                        <span className="duna-switch__thumb" />
                      </button>
                      <span className="duna-field__label" style={{ margin: 0 }}>{m.label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="admin-metodo__config">
                <ControlTelefono
                  idBase="movil"
                  label="Número de pago móvil"
                  hint="Donde recibes Nequi y Daviplata. Puede ser distinto del WhatsApp. Vacío: esos métodos no se muestran."
                  error={errores.movilNumero}
                  indicativo={form.movilIndicativo}
                  numero={form.movilNumero}
                  onIndicativo={v => setForm(f => ({ ...f, movilIndicativo: v }))}
                  onNumero={v => setForm(f => ({ ...f, movilNumero: v }))}
                />
                {movilFaltaDatos && (
                  <p className="admin-metodo__aviso">Encendido — falta configurarlo</p>
                )}
              </div>
            </div>

            {/* b) Transferencia bancaria. */}
            <div className={`admin-metodo${form.pagoTransferenciaActivo ? ' is-on' : ''}`}>
              <div className="admin-metodo__head">
                <div className="admin-metodo__fila">
                  <button
                    type="button" role="switch" aria-checked={form.pagoTransferenciaActivo}
                    aria-label="Encender Transferencia bancaria"
                    onClick={() => setForm(f => ({ ...f, pagoTransferenciaActivo: !f.pagoTransferenciaActivo }))}
                    className={`duna-switch${form.pagoTransferenciaActivo ? ' is-on' : ''}`}
                  >
                    <span className="duna-switch__thumb" />
                  </button>
                  <span className="duna-field__label" style={{ margin: 0 }}>Transferencia bancaria</span>
                </div>
              </div>
              <div className="admin-metodo__config">
                <div className="duna-form">
                  {CAMPOS_BANCO.map(campo => renderCampoEdit(campo, form, errores, set))}
                </div>
                {transfFaltaDatos && (
                  <p className="admin-metodo__aviso">Encendido — falta configurarlo</p>
                )}
              </div>
            </div>

            {/* c) Contra entrega (efectivo) — sin config: no hay nada que configurar. */}
            <div className={`admin-metodo${form.pagoEfectivoActivo ? ' is-on' : ''}`}>
              <div className="admin-metodo__head">
                <div className="admin-metodo__fila">
                  <button
                    type="button" role="switch" aria-checked={form.pagoEfectivoActivo}
                    aria-label="Encender Contra entrega (efectivo)"
                    onClick={() => setForm(f => ({ ...f, pagoEfectivoActivo: !f.pagoEfectivoActivo }))}
                    className={`duna-switch${form.pagoEfectivoActivo ? ' is-on' : ''}`}
                  >
                    <span className="duna-switch__thumb" />
                  </button>
                  <span className="duna-field__label" style={{ margin: 0 }}>Contra entrega (efectivo)</span>
                </div>
              </div>
            </div>

            {/* Al menos un método encendido — el error del schema cae en `pagoNequiActivo`. */}
            {errores.pagoNequiActivo && (
              <p className="duna-field__error" style={{ marginTop: 'var(--duna-space-3)' }}>{errores.pagoNequiActivo}</p>
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
            <div className="duna-eyebrow" style={{ marginBottom: 'var(--duna-space-3)' }}>Identidad</div>
            <dl className="duna-form" style={{ margin: 0 }}>
              {CAMPOS_IDENTIDAD.map(campo => renderCampoLectura(campo, settings))}
            </dl>
          </div>

          <div className="admin-bloque">
            <div className="duna-eyebrow" style={{ marginBottom: 'var(--duna-space-3)' }}>Contacto</div>
            <dl className="duna-form" style={{ margin: 0 }}>
              <div className="duna-field">
                <dt className="duna-field__label">WhatsApp</dt>
                <dd className="duna-body" style={{ margin: 0, wordBreak: 'break-word' }}>
                  {settings.whatsapp.trim() || <span style={{ color: 'var(--duna-muted)' }}>Sin definir</span>}
                </dd>
              </div>
              {renderCampoLectura(CAMPO_INSTAGRAM, settings)}
            </dl>
          </div>

          <div className="admin-bloque">
            <div className="duna-eyebrow" style={{ marginBottom: 'var(--duna-space-3)' }}>Correos</div>
            <dl className="duna-form" style={{ margin: 0 }}>
              {CAMPOS_CORREOS.map(campo => renderCampoLectura(campo, settings))}
            </dl>
          </div>

          <div className="admin-bloque">
            <div className="duna-eyebrow" style={{ marginBottom: 'var(--duna-space-3)' }}>Pagos</div>
            {/* Métodos de pago, en lectura: encendido / apagado / encendido-sin-datos. */}
            <dl className="duna-form" style={{ margin: 0 }}>
              <div className="duna-field duna-form__full">
                <dt className="duna-field__label">Métodos de pago del checkout</dt>
                <dd className="duna-body" style={{ margin: 0 }}>
                  {METODOS_PAGO.map(m => {
                    const estado = estadoMetodoEditor(settings, m.id);
                    return (
                      <div key={m.id} style={{ display: 'flex', gap: 'var(--duna-space-2)', alignItems: 'baseline' }}>
                        <span>{m.label}:</span>
                        {estado === 'apagado'
                          ? <span style={{ color: 'var(--duna-muted)' }}>Apagado</span>
                          : estado === 'activo_sin_datos'
                            ? <span style={{ color: 'var(--duna-sol-ink)' }}>Encendido — falta configurarlo</span>
                            : <span>Encendido</span>}
                      </div>
                    );
                  })}
                </dd>
              </div>
            </dl>
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
