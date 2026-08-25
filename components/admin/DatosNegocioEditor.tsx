'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useSiteSettings } from '@/components/admin/SiteSettingsProvider';
import { siteSettingsEditableSchema } from '@/lib/config/site-settings-schema';
import { useAccionGuardada } from '@/hooks/useAccionGuardada';

// Editor de la CONFIGURACIÓN DEL NEGOCIO: los campos PLANOS de SiteSetting (identidad y
// contacto). Los estructurados (emailColors, footerNav, legalNav) siguen en código (v1).
// NO es el contenido del storefront (hero, fotos, títulos) — eso es la sección "Tienda",
// trabajo aparte.
//
// Valores iniciales del provider (snapshot del request). Al guardar, `router.refresh()`
// re-corre el layout server (getSiteSettings fresco) y propaga los valores nuevos a todo
// el admin —mensajes de WhatsApp, Perfil, correos— sin recargar a mano.
//
// La validación la comparte con el PATCH (`siteSettingsEditableSchema`): acá es el aviso
// temprano por campo; el server MANDA. Éxito → toast; error → inline (§ Toast=éxito,
// inline=error). Doble-submit por `useAccionGuardada`.

interface FormState {
  nombre: string; tagline: string; descripcionFooter: string;
  whatsapp: string; instagram: string; emailRemitente: string;
  emailReplyTo: string; adminEmail: string;
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
];

export default function DatosNegocioEditor() {
  const settings = useSiteSettings();
  const router   = useRouter();
  const guarda   = useAccionGuardada();

  const [form, setForm] = useState<FormState>({
    nombre:            settings.nombre,
    tagline:           settings.tagline,
    descripcionFooter: settings.descripcionFooter,
    whatsapp:          settings.whatsapp,
    instagram:         settings.instagram,
    emailRemitente:    settings.emailRemitente,
    emailReplyTo:      settings.emailReplyTo ?? '',
    adminEmail:        settings.adminEmail ?? '',
  });
  const [errores, setErrores]           = useState<Partial<Record<keyof FormState, string>>>({});
  const [errorServidor, setErrorServidor] = useState<string | null>(null);

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
      router.refresh();
    });
  };

  return (
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
        {errorServidor && (
          <p className="duna-field__error" role="alert" style={{ margin: 0 }}>{errorServidor}</p>
        )}
      </div>
    </form>
  );
}
