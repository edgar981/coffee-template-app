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

// ─── Subsección «Negocio» — el bloque Identidad ──────────────────────────────────────────────
//
// Antes vivía como el primer tercio de `DatosNegocioSeccion`, dentro de un formulario único que
// abría TODO (identidad + contacto + redes + correos + pagos + pasarela) con un solo
// Editar/Guardar. Ahora es su propio bloque, con su propio Editar/Cancelar/Guardar — el guardado
// sigue mandando el PATCH COMPLETO (`payloadBaseDesdeSettings` + lo que este formulario cambió),
// nunca sólo estos tres campos.
//
// «Dónde estás» (ciudad, horario) del prototipo (`captura-cfg.png`) NO se construye: no hay
// columna para ese dato en `SiteSetting` hoy, y agregarla sin un escritor real sería la mina
// inerte de siempre (§ CLAUDE.md, el ex-`Product.agotado`). Queda nombrado en el reporte de
// cierre, no en el código.

interface FormIdentidad {
  nombre:            string;
  tagline:           string;
  descripcionFooter: string;
}

const CAMPOS: { name: keyof FormIdentidad; label: string; hint?: string; textarea?: boolean; full?: boolean }[] = [
  { name: 'nombre',            label: 'Nombre del negocio' },
  { name: 'tagline',           label: 'Frase corta', hint: 'La línea bajo el nombre: ciudad o lema.' },
  { name: 'descripcionFooter', label: 'Texto del pie', textarea: true, full: true, hint: 'El párrafo del footer del storefront.' },
];

function desde(nombre: string, tagline: string, descripcionFooter: string): FormIdentidad {
  return { nombre, tagline, descripcionFooter };
}

export default function IdentidadBloque() {
  const settings = useSiteSettings();
  const router   = useRouter();
  const guarda   = useAccionGuardada();
  const { estado: cuentaPasarela } = useCuentaPasarela();

  const [editando, setEditando]           = useState(false);
  const [form, setForm]                   = useState<FormIdentidad>(() =>
    desde(settings.nombre, settings.tagline, settings.descripcionFooter));
  const [errores, setErrores]             = useState<Partial<Record<keyof FormIdentidad, string>>>({});
  const [errorServidor, setErrorServidor] = useState<string | null>(null);

  const salirDeEdicion = () => { setEditando(false); setErrores({}); setErrorServidor(null); };
  const descarte = useDescarteDeDrawer({ enVuelo: guarda.enVuelo, onCerrar: salirDeEdicion });

  const actual = desde(settings.nombre, settings.tagline, settings.descripcionFooter);
  const sucio  = editando && JSON.stringify(form) !== JSON.stringify(actual);
  useEffect(() => { descarte.marcarCambios(sucio); }, [sucio, descarte]);

  const abrirEdicion = () => {
    setForm(desde(settings.nombre, settings.tagline, settings.descripcionFooter));
    setErrores({});
    setErrorServidor(null);
    setEditando(true);
  };

  const set = (name: keyof FormIdentidad) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [name]: e.target.value }));

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorServidor(null);

    const payload = { ...payloadBaseDesdeSettings(settings, guardadoDe(cuentaPasarela)), ...form };
    const parsed  = siteSettingsEditableSchema.safeParse(payload);
    if (!parsed.success) {
      // Un error de un campo que ESTE bloque no edita (p. ej. WhatsApp vacío en una fila recién
      // migrada) no puede perderse en silencio — antes, filtrar sólo `campo in form` lo tiraba al
      // suelo y Guardar se quedaba mudo. `repartirErroresBloque` lo manda al error general.
      const { propios, errorAjeno } = repartirErroresBloque(
        parsed.error.issues,
        campo => (campo in form ? campo as keyof FormIdentidad : null),
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
      toast.success('Identidad guardada.');
      setEditando(false);
      router.refresh();
    });
  };

  return (
    <div className="duna-card duna-card__pad">
      <EncabezadoBloque
        titulo="Identidad"
        descripcion="Cómo se presenta tu negocio en la tienda y en los correos."
        editando={editando}
        onEditar={abrirEdicion}
      />

      {editando ? (
        <form onSubmit={guardar} className="duna-form" style={{ marginTop: 'var(--duna-space-4)' }} noValidate>
          {CAMPOS.map(campo => {
            const err = errores[campo.name];
            const id  = `id-${campo.name}`;
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
          <PieFormularioBloque enVuelo={guarda.enVuelo} onCancelar={descarte.intentarCerrar} errorServidor={errorServidor} />
        </form>
      ) : (
        <dl className="duna-form" style={{ margin: 0, marginTop: 'var(--duna-space-4)' }}>
          {CAMPOS.map(campo => (
            <div key={campo.name} className={`duna-field${campo.full ? ' duna-form__full' : ''}`}>
              <dt className="duna-field__label">{campo.label}</dt>
              <dd className="duna-body" style={{ margin: 0, wordBreak: 'break-word' }}>
                {settings[campo.name].trim() || <span style={{ color: 'var(--duna-muted)' }}>Sin definir</span>}
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
