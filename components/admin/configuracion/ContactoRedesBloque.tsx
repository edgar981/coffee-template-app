'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2, Plus } from 'lucide-react';
import { useSiteSettings } from '@/components/admin/SiteSettingsProvider';
import { siteSettingsEditableSchema } from '@/lib/config/site-settings-schema';
import { payloadBaseDesdeSettings, repartirErroresBloque } from '@/lib/admin/configuracion-partes';
import { partirTelefono, componerTelefono, INDICATIVOS } from '@/lib/config/telefono';
import { REDES_SOCIALES_ORDEN, type RedSocialTipo, type RedSocialGuardada } from '@/lib/config/site';
import { useAccionGuardada } from '@/hooks/useAccionGuardada';
import { useDescarteDeDrawer } from '@/hooks/useDescarteDeDrawer';
import { ConfirmDescartarDialog } from '@/components/admin/ConfirmDescartarDialog';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { EncabezadoBloque } from './EncabezadoBloque';
import { PieFormularioBloque } from './PieFormularioBloque';
import { useCuentaPasarela, guardadoDe } from './useCuentaPasarela';

// ─── Subsección «Contacto y redes» ────────────────────────────────────────────────────────────
//
// El WhatsApp PRIMARIO del negocio (checkout, footer) + la LISTA de redes sociales
// (§ MUESTRARIO-REDES-ADICIONALES-1: estar en la lista ES ofrecerla en el riel/footer). Movido
// tal cual desde `DatosNegocioSeccion` a su propio bloque — el MODELO no cambió, sólo gana su
// propio Editar/Cancelar/Guardar, independiente de Identidad/Correos/Pagos.

interface FormContacto {
  whatsappIndicativo: string;
  whatsappNumero:     string;
  redes:              RedSocialGuardada[];
}

function desde(whatsapp: string, redes: RedSocialGuardada[]): FormContacto {
  const wa = partirTelefono(whatsapp);
  return { whatsappIndicativo: wa.indicativo, whatsappNumero: wa.numero, redes };
}

// SÓLO PRESENTACIÓN (lectura): partir + volver a componer con el espacio de `componerTelefono`.
function telefonoDisplay(valor: string): string {
  const partido = partirTelefono(valor);
  return componerTelefono(partido.indicativo, partido.numero);
}

function redesEnOrdenCanonico(redes: RedSocialGuardada[]): RedSocialGuardada[] {
  return REDES_SOCIALES_ORDEN
    .map(t => redes.find(r => r.tipo === t))
    .filter((r): r is RedSocialGuardada => r !== undefined);
}

const LABEL_RED: Record<RedSocialTipo, string> = {
  instagram: 'Instagram',
  whatsapp:  'WhatsApp',
  facebook:  'Facebook',
  x:         'X',
  pinterest: 'Pinterest',
};

const CAMPO_RED: Record<RedSocialTipo, { label: string; hint: string }> = {
  instagram: { label: 'Usuario',        hint: 'Sin @.' },
  whatsapp:  { label: 'Número',         hint: 'Con indicativo, sólo dígitos.' },
  facebook:  { label: 'URL del perfil', hint: 'https://facebook.com/…' },
  x:         { label: 'URL del perfil', hint: 'https://x.com/…' },
  pinterest: { label: 'URL del perfil', hint: 'https://pinterest.com/…' },
};

export default function ContactoRedesBloque() {
  const settings = useSiteSettings();
  const router   = useRouter();
  const guarda   = useAccionGuardada();
  const { estado: cuentaPasarela } = useCuentaPasarela();

  const [editando, setEditando]           = useState(false);
  const [form, setForm]                   = useState<FormContacto>(() => desde(settings.whatsapp, settings.redes));
  const [errorWhatsapp, setErrorWhatsapp] = useState<string | undefined>();
  const [errorRedes, setErrorRedes]       = useState<string | undefined>();
  const [errorServidor, setErrorServidor] = useState<string | null>(null);

  const salirDeEdicion = () => { setEditando(false); setErrorWhatsapp(undefined); setErrorRedes(undefined); setErrorServidor(null); };
  const descarte = useDescarteDeDrawer({ enVuelo: guarda.enVuelo, onCerrar: salirDeEdicion });

  const actual = desde(settings.whatsapp, settings.redes);
  const sucio  = editando && JSON.stringify(form) !== JSON.stringify(actual);
  useEffect(() => { descarte.marcarCambios(sucio); }, [sucio, descarte]);

  const abrirEdicion = () => {
    setForm(desde(settings.whatsapp, settings.redes));
    setErrorWhatsapp(undefined);
    setErrorRedes(undefined);
    setErrorServidor(null);
    setEditando(true);
  };

  const redesFaltantes = REDES_SOCIALES_ORDEN.filter(t => !form.redes.some(r => r.tipo === t));

  const agregarRed = (tipo: RedSocialTipo) => {
    setForm(f => ({ ...f, redes: [...f.redes, { tipo, valor: '' }] }));
  };

  // Sin confirmación previa: una red social sin su valor no se muestra en la tienda, así que
  // quitarla nunca revierte un cobro ni deja rastro en otra tabla (a diferencia de un método de
  // pago). Mismo trato que `quitarConDeshacer` de Pagos — con Deshacer.
  const quitarRed = (r: RedSocialGuardada) => {
    setForm(f => ({ ...f, redes: f.redes.filter(x => x.tipo !== r.tipo) }));
    toast.success(`${LABEL_RED[r.tipo]} quitada.`, {
      action: {
        label: 'Deshacer',
        onClick: () => setForm(f => (
          f.redes.some(x => x.tipo === r.tipo) ? f : { ...f, redes: [...f.redes, r] }
        )),
      },
    });
  };

  const setValorRed = (tipo: RedSocialTipo, valor: string) => {
    setForm(f => ({ ...f, redes: f.redes.map(r => (r.tipo === tipo ? { ...r, valor } : r)) }));
  };

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorServidor(null);

    const payload = {
      ...payloadBaseDesdeSettings(settings, guardadoDe(cuentaPasarela)),
      whatsapp: componerTelefono(form.whatsappIndicativo, form.whatsappNumero),
      redes:    form.redes,
    };

    const parsed = siteSettingsEditableSchema.safeParse(payload);
    if (!parsed.success) {
      // Un error AJENO (nombre, remitente de correos, métodos de pago…) no puede perderse en
      // silencio — igual que Identidad/Correos, va al error general en vez de tirarse.
      const { propios, errorAjeno } = repartirErroresBloque(
        parsed.error.issues,
        campo => (campo === 'whatsapp' || campo === 'redes' ? campo : null),
      );
      setErrorWhatsapp(propios.whatsapp);
      setErrorRedes(propios.redes);
      if (errorAjeno) setErrorServidor(errorAjeno);
      return;
    }
    setErrorWhatsapp(undefined);
    setErrorRedes(undefined);

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
      toast.success('Contacto y redes guardados.');
      setEditando(false);
      router.refresh();
    });
  };

  return (
    <div className="duna-card duna-card__pad">
      <EncabezadoBloque
        titulo="Contacto y redes"
        descripcion="Aparecen en la tienda, en los correos y en el pie."
        editando={editando}
        onEditar={abrirEdicion}
      />

      {editando ? (
        <form onSubmit={guardar} className="duna-form" style={{ marginTop: 'var(--duna-space-4)' }} noValidate>
          {/* WhatsApp — indicativo (select) + número (input) en una fila. */}
          <div className="duna-field">
            <label className="duna-field__label" htmlFor="con-whatsapp-numero">WhatsApp</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-2)' }}>
              <select
                className="duna-input duna-select"
                style={{ width: '104px', flexShrink: 0 }}
                aria-label="Indicativo de WhatsApp"
                value={form.whatsappIndicativo}
                onChange={e => setForm(f => ({ ...f, whatsappIndicativo: e.target.value }))}
              >
                <option value="">—</option>
                {INDICATIVOS.map(i => (
                  <option key={i.valor} value={i.valor}>{i.valor} {i.label}</option>
                ))}
              </select>
              <input
                id="con-whatsapp-numero"
                className="duna-input"
                style={{ flex: '1 1 160px', minWidth: 0 }}
                value={form.whatsappNumero}
                onChange={e => setForm(f => ({ ...f, whatsappNumero: e.target.value }))}
                aria-invalid={errorWhatsapp ? true : undefined}
                aria-describedby={errorWhatsapp ? 'con-whatsapp-err' : 'con-whatsapp-hint'}
              />
            </div>
            {errorWhatsapp
              ? <p className="duna-field__error" id="con-whatsapp-err">{errorWhatsapp}</p>
              : <p className="duna-field__hint" id="con-whatsapp-hint">Con indicativo y número.</p>}
          </div>

          {/* Redes sociales */}
          <div className="duna-form__full">
            <p className="duna-field__label" style={{ marginBottom: 'var(--duna-space-1)' }}>Redes sociales</p>
            <p className="duna-field__hint" style={{ marginTop: 0, marginBottom: 'var(--duna-space-3)' }}>
              Agrega las redes que quieres mostrar en el riel lateral y el pie de la tienda. Una red
              sin su usuario/URL no se muestra.
            </p>

            {errorRedes && <p className="duna-field__error" style={{ marginBottom: 'var(--duna-space-3)' }}>{errorRedes}</p>}

            {form.redes.length === 0 ? (
              <div className="admin-pagos-vacio">
                <p className="duna-body" style={{ margin: 0, color: 'var(--duna-ink-2)' }}>
                  No muestras ninguna red social en la tienda.
                </p>
              </div>
            ) : (
              redesEnOrdenCanonico(form.redes).map(r => (
                <div className="admin-pagos-fila" key={r.tipo}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--duna-space-3)' }}>
                    <span className="duna-field__label" style={{ margin: 0 }}>{LABEL_RED[r.tipo]}</span>
                    <button
                      type="button"
                      className="duna-btn duna-btn--ghost duna-btn--sm"
                      aria-label={`Quitar ${LABEL_RED[r.tipo]}`}
                      onClick={() => quitarRed(r)}
                    >
                      <Trash2 />
                    </button>
                  </div>
                  <div className="duna-form duna-form--sm" style={{ marginTop: 'var(--duna-space-3)' }}>
                    <div className="duna-field">
                      <label className="duna-field__label" htmlFor={`red-${r.tipo}`}>{CAMPO_RED[r.tipo].label}</label>
                      <input
                        id={`red-${r.tipo}`}
                        className="duna-input duna-input--sm"
                        value={r.valor}
                        onChange={e => setValorRed(r.tipo, e.target.value)}
                      />
                      <p className="duna-field__hint" style={{ margin: 0 }}>{CAMPO_RED[r.tipo].hint}</p>
                    </div>
                  </div>
                </div>
              ))
            )}

            <div style={{ marginTop: 'var(--duna-space-4)', paddingTop: 'var(--duna-space-4)', borderTop: '1px solid var(--duna-border)' }}>
              {redesFaltantes.length > 0 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="duna-btn duna-btn--secondary duna-btn--sm">
                      <Plus /> Agregar red social
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    style={{
                      background:   'var(--duna-surface)',
                      borderColor:  'var(--duna-border-2)',
                      borderRadius: 'var(--duna-r-m)',
                      boxShadow:    'var(--duna-shadow-2)',
                    }}
                  >
                    {redesFaltantes.map(t => (
                      <DropdownMenuItem key={t} onSelect={() => agregarRed(t)} className="cursor-pointer">
                        {LABEL_RED[t]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <button type="button" className="duna-btn duna-btn--secondary duna-btn--sm" disabled>
                  <Plus /> Ya agregaste las cinco redes disponibles.
                </button>
              )}
            </div>
          </div>

          <PieFormularioBloque enVuelo={guarda.enVuelo} onCancelar={descarte.intentarCerrar} errorServidor={errorServidor} />
        </form>
      ) : (
        <div style={{ marginTop: 'var(--duna-space-4)' }}>
          <dl className="duna-form" style={{ margin: 0 }}>
            <div className="duna-field">
              <dt className="duna-field__label">WhatsApp</dt>
              <dd className="duna-body" style={{ margin: 0, wordBreak: 'break-word' }}>
                {settings.whatsapp.trim()
                  ? telefonoDisplay(settings.whatsapp)
                  : <span style={{ color: 'var(--duna-muted)' }}>Sin definir</span>}
              </dd>
            </div>
          </dl>

          <div style={{ marginTop: 'var(--duna-space-4)' }}>
            <p className="duna-field__label" style={{ marginBottom: 'var(--duna-space-3)' }}>Redes sociales</p>
            {settings.redes.length === 0 ? (
              <div className="admin-pagos-vacio">
                <p className="duna-body" style={{ margin: 0, color: 'var(--duna-ink-2)' }}>
                  No muestras ninguna red social en la tienda.
                </p>
              </div>
            ) : (
              redesEnOrdenCanonico(settings.redes).map(r => (
                <div className="admin-pagos-fila" key={r.tipo}>
                  <p className="duna-field__label" style={{ margin: 0 }}>{LABEL_RED[r.tipo]}</p>
                  <p className="admin-pagos-dato" style={{ marginTop: 'var(--duna-space-1)' }}>
                    {r.valor.trim() || <span style={{ color: 'var(--duna-muted)' }}>Sin definir</span>}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <ConfirmDescartarDialog
        abierto={descarte.confirmando}
        onDescartar={descarte.descartar}
        onSeguir={descarte.seguirEditando}
      />
    </div>
  );
}
