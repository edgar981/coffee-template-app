'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useSiteSettings } from '@/components/admin/SiteSettingsProvider';
import { siteSettingsEditableSchema } from '@/lib/config/site-settings-schema';
import { payloadBaseDesdeSettings, repartirErroresBloque } from '@/lib/admin/configuracion-partes';
import { useAccionGuardada } from '@/hooks/useAccionGuardada';
import { useDescarteDeDrawer } from '@/hooks/useDescarteDeDrawer';
import { ConfirmDescartarDialog } from '@/components/admin/ConfirmDescartarDialog';
import { EncabezadoBloque } from './EncabezadoBloque';
import { PieFormularioBloque } from './PieFormularioBloque';
import { useCuentaPasarela, guardadoDe } from './useCuentaPasarela';

// ─── Subsección «Correos» ─────────────────────────────────────────────────────────────────────
//
// El rótulo de `emailReplyTo` cambió de "Reply-To (opcional)" a «Responder a», sin «(opcional)»
// —§ diagnóstico, el spec lo pide explícito—: el vacío ya lo explica el hint ("cada reporte usa
// los suyos"), así que la etiqueta no necesita repetirlo.

interface FormCorreos {
  emailRemitente: string;
  emailReplyTo:   string;
  adminEmail:     string;
}

const CAMPOS: { name: keyof FormCorreos; label: string; hint: string; full?: boolean }[] = [
  { name: 'emailRemitente', label: 'Remitente de correos', full: true, hint: 'Cómo firman los correos de la tienda: "Nombre <correo@dominio>".' },
  { name: 'emailReplyTo',   label: 'Responder a',    hint: 'A dónde responden los clientes. Vacío = sin reply-to propio.' },
  { name: 'adminEmail',     label: 'Correo donde llegan los reportes del equipo', hint: 'Destinatario por defecto del resumen diario y el reporte semanal. Vacío = cada reporte usa los suyos.' },
];

function desde(emailRemitente: string, emailReplyTo: string | null, adminEmail: string | null): FormCorreos {
  return { emailRemitente, emailReplyTo: emailReplyTo ?? '', adminEmail: adminEmail ?? '' };
}

export default function CorreosBloque() {
  const settings = useSiteSettings();
  const router   = useRouter();
  const guarda   = useAccionGuardada();
  const { estado: cuentaPasarela } = useCuentaPasarela();

  const [editando, setEditando]           = useState(false);
  const [form, setForm]                   = useState<FormCorreos>(() =>
    desde(settings.emailRemitente, settings.emailReplyTo, settings.adminEmail));
  const [errores, setErrores]             = useState<Partial<Record<keyof FormCorreos, string>>>({});
  const [errorServidor, setErrorServidor] = useState<string | null>(null);

  const salirDeEdicion = () => { setEditando(false); setErrores({}); setErrorServidor(null); };
  const descarte = useDescarteDeDrawer({ enVuelo: guarda.enVuelo, onCerrar: salirDeEdicion });

  const actual = desde(settings.emailRemitente, settings.emailReplyTo, settings.adminEmail);
  const sucio  = editando && JSON.stringify(form) !== JSON.stringify(actual);
  useEffect(() => { descarte.marcarCambios(sucio); }, [sucio, descarte]);

  const abrirEdicion = () => {
    setForm(desde(settings.emailRemitente, settings.emailReplyTo, settings.adminEmail));
    setErrores({});
    setErrorServidor(null);
    setEditando(true);
  };

  const set = (name: keyof FormCorreos) =>
    (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [name]: e.target.value }));

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorServidor(null);

    const payload = { ...payloadBaseDesdeSettings(settings, guardadoDe(cuentaPasarela)), ...form };
    const parsed  = siteSettingsEditableSchema.safeParse(payload);
    if (!parsed.success) {
      // Mismo riesgo que Identidad: un campo AJENO inválido (p. ej. WhatsApp vacío) no puede
      // perderse en silencio — va al error general, no se tira.
      const { propios, errorAjeno } = repartirErroresBloque(
        parsed.error.issues,
        campo => (campo in form ? campo as keyof FormCorreos : null),
      );
      setErrores(propios);
      if (errorAjeno) setErrorServidor(errorAjeno);
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
      toast.success('Correos guardados.');
      setEditando(false);
      router.refresh();
    });
  };

  return (
    <div className="duna-card duna-card__pad">
      <EncabezadoBloque
        titulo="Correos"
        descripcion="Desde dónde salen y a dónde llegan las respuestas."
        editando={editando}
        onEditar={abrirEdicion}
      />

      {editando ? (
        <form onSubmit={guardar} className="duna-form" style={{ marginTop: 'var(--duna-space-4)' }} noValidate>
          {CAMPOS.map(campo => {
            const err = errores[campo.name];
            const id  = `cor-${campo.name}`;
            const describedBy = err ? `${id}-err` : `${id}-hint`;
            return (
              <div key={campo.name} className={`duna-field${campo.full ? ' duna-form__full' : ''}`}>
                <label className="duna-field__label" htmlFor={id}>{campo.label}</label>
                <input
                  id={id} className="duna-input"
                  value={form[campo.name]} onChange={set(campo.name)}
                  aria-invalid={err ? true : undefined} aria-describedby={describedBy}
                />
                {err
                  ? <p className="duna-field__error" id={`${id}-err`}>{err}</p>
                  : <p className="duna-field__hint" id={`${id}-hint`}>{campo.hint}</p>}
              </div>
            );
          })}
          <PieFormularioBloque enVuelo={guarda.enVuelo} onCancelar={descarte.intentarCerrar} errorServidor={errorServidor} />
        </form>
      ) : (
        <dl className="duna-form" style={{ margin: 0, marginTop: 'var(--duna-space-4)' }}>
          {CAMPOS.map(campo => (
            <div key={campo.name} className={`duna-field${campo.full ? ' duna-form__full' : ''}`}>
              <dt className="duna-field__label">{campo.label}</dt>
              <dd className="duna-body" style={{ margin: 0, wordBreak: 'break-word' }}>
                {settings[campo.name]?.trim?.() || <span style={{ color: 'var(--duna-muted)' }}>Sin definir</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <ConfirmDescartarDialog
        abierto={descarte.confirmando}
        onDescartar={descarte.descartar}
        onSeguir={descarte.seguirEditando}
      />
    </div>
  );
}
