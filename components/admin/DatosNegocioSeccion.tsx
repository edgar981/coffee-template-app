'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';
import { useSiteSettings } from '@/components/admin/SiteSettingsProvider';
import { siteSettingsEditableSchema } from '@/lib/config/site-settings-schema';
import { useAccionGuardada } from '@/hooks/useAccionGuardada';
import { useDescarteDeDrawer } from '@/hooks/useDescarteDeDrawer';
import { ConfirmDescartarDialog } from '@/components/admin/ConfirmDescartarDialog';
import type { SiteSettings } from '@/lib/config/site-settings';

// Sección CONFIGURACIÓN DEL NEGOCIO: los campos PLANOS de SiteSetting (identidad y
// contacto). Los estructurados (emailColors, footerNav, legalNav) siguen en código (v1).
// NO es el contenido del storefront (hero, fotos) — eso es la sección "Tienda", aparte.
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

interface FormState {
  nombre: string; tagline: string; descripcionFooter: string;
  whatsapp: string; instagram: string; emailRemitente: string;
  emailReplyTo: string; adminEmail: string;
  bancoNombre: string; bancoTipoCuenta: string; bancoNumeroCuenta: string; bancoTitular: string;
}

type Campo = {
  name: keyof FormState;
  label: string;
  hint?: string;
  textarea?: boolean;
  full?: boolean;
};

const CAMPOS: Campo[] = [
  { name: 'nombre',            label: 'Nombre del negocio' },
  { name: 'tagline',           label: 'Tagline',            hint: 'La línea bajo el nombre: ciudad o lema.' },
  { name: 'descripcionFooter', label: 'Descripción del pie', textarea: true, full: true, hint: 'El párrafo del footer del storefront.' },
  { name: 'whatsapp',          label: 'WhatsApp',           hint: 'Con indicativo, p. ej. +57 315 576 6064.' },
  { name: 'instagram',         label: 'Instagram',          hint: 'El usuario, sin @.' },
  { name: 'emailRemitente',    label: 'Remitente de correos', full: true, hint: 'Cómo firman los correos de la tienda: "Nombre <correo@dominio>".' },
  { name: 'emailReplyTo',      label: 'Reply-To (opcional)', hint: 'A dónde responden los clientes. Vacío = sin reply-to propio.' },
  // adminEmail: el ÚNICO campo cuyo nombre no se explica solo — la etiqueta dice para qué sirve.
  { name: 'adminEmail',        label: 'Correo donde llegan los reportes del equipo', hint: 'Destinatario por defecto del resumen diario y el reporte semanal. Vacío = cada reporte usa los suyos.' },
  // Cuenta para transferencias del checkout. El hint del primer campo enmarca el grupo; con los
  // esenciales (banco+tipo+número) vacíos, el método "Transferencia bancaria" no se muestra.
  { name: 'bancoNombre',       label: 'Banco (para transferencias)', hint: 'La cuenta del método "Transferencia bancaria" del checkout. Deja banco, tipo y número vacíos y ese método no se muestra.' },
  { name: 'bancoTipoCuenta',   label: 'Tipo de cuenta',      hint: 'Ahorros o Corriente.' },
  { name: 'bancoNumeroCuenta', label: 'Número de cuenta' },
  { name: 'bancoTitular',      label: 'Titular de la cuenta (opcional)', hint: 'A nombre de quién está la cuenta. Vacío: no se muestra.' },
];

function desdeSettings(s: SiteSettings): FormState {
  return {
    nombre:            s.nombre,
    tagline:           s.tagline,
    descripcionFooter: s.descripcionFooter,
    whatsapp:          s.whatsapp,
    instagram:         s.instagram,
    emailRemitente:    s.emailRemitente,
    emailReplyTo:      s.emailReplyTo ?? '',
    adminEmail:        s.adminEmail ?? '',
    bancoNombre:       s.bancoNombre ?? '',
    bancoTipoCuenta:   s.bancoTipoCuenta ?? '',
    bancoNumeroCuenta: s.bancoNumeroCuenta ?? '',
    bancoTitular:      s.bancoTitular ?? '',
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

  // ¿Hay cambios sin guardar? Se compara el form contra el valor actual del provider. El
  // cuerpo REPORTA su sucio a la guarda (§ useDescarteDeDrawer): un ref, sin re-render.
  const sucio = editando && JSON.stringify(form) !== JSON.stringify(desdeSettings(settings));
  useEffect(() => { descarte.marcarCambios(sucio); }, [sucio, descarte]);

  const abrirEdicion = () => {
    setForm(desdeSettings(settings)); // arranca de lo que hay hoy
    setErrores({});
    setErrorServidor(null);
    setEditando(true);
  };

  const set = (name: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [name]: e.target.value }));

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorServidor(null);

    const parsed = siteSettingsEditableSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Partial<Record<keyof FormState, string>> = {};
      for (const issue of parsed.error.issues) {
        const campo = issue.path[0] as keyof FormState;
        if (campo && !errs[campo]) errs[campo] = issue.message; // el primero por campo
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

      <div className="duna-card duna-card__pad" style={{ marginTop: 'var(--duna-space-4)' }}>
        {editando ? (
          <form onSubmit={guardar} className="duna-form" noValidate>
            {CAMPOS.map(campo => {
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
            })}

            <div className="duna-form__full" style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-3)' }}>
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
          <dl className="duna-form" style={{ margin: 0 }}>
            {CAMPOS.map(campo => {
              const texto = (settings[campo.name] ?? '').toString().trim();
              return (
                <div key={campo.name} className={`duna-field${campo.full ? ' duna-form__full' : ''}`}>
                  <dt className="duna-field__label">{campo.label}</dt>
                  <dd className="duna-body" style={{ margin: 0, wordBreak: 'break-word' }}>
                    {texto || <span style={{ color: 'var(--duna-muted)' }}>Sin definir</span>}
                  </dd>
                </div>
              );
            })}
          </dl>
        )}
      </div>

      <ConfirmDescartarDialog
        abierto={descarte.confirmando}
        onDescartar={descarte.descartar}
        onSeguir={descarte.seguirEditando}
      />
    </>
  );
}
