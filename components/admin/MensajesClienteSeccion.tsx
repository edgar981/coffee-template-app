'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';
import { useSiteSettings } from '@/components/admin/SiteSettingsProvider';
import { siteSettingsEditableSchema } from '@/lib/config/site-settings-schema';
import {
  MOMENTOS_EDITABLES, MOMENTO_EDITABLE_LABEL, MAX_LARGO_MENSAJE_WHATSAPP,
  plantillaPorDefecto, interpolar, rastreoUrl,
  type MomentoEditable, type MensajesWhatsappGuardados,
} from '@/lib/admin/mensajes-whatsapp';
import { insertarEnCursor } from '@/lib/config/panel-controles';
import { useAccionGuardada } from '@/hooks/useAccionGuardada';
import { useDescarteDeDrawer } from '@/hooks/useDescarteDeDrawer';
import { ConfirmDescartarDialog } from '@/components/admin/ConfirmDescartarDialog';

// Sección «Mensajes al cliente» (§ PEDIDOS-WHATSAPP-MENSAJES-EDITABLES-1): el dueño o el
// administrador reemplazan el texto de WhatsApp de cada momento del pedido —el que
// `lib/admin/mensajes-whatsapp.ts` ya resuelve por los TRES llamadores del panel (detalle de
// pedido, agendar entrega, ficha del cliente)— sin tocar código. Sin editar, todo sale igual
// que con PEDIDOS-WHATSAPP-MENSAJES-1 (el texto de fábrica).
//
// MISMA cáscara lectura↔edición que `DatosNegocioSeccion` (nace en lectura; "Editar" abre el
// form; `useDescarteDeDrawer` + `ConfirmDescartarDialog` protegen la salida con cambios sin
// guardar; `useAccionGuardada` es la guarda de doble-submit).
//
// EL WRITE DE `/api/site-settings` ES COMPLETO, NO PARCIAL (§ site-settings-schema.ts) — así
// que guardar SÓLO los mensajes exige conocer el valor VIGENTE de todo lo demás para
// devolverlo intacto, incluido `metodosPasarela`, que ni siquiera viaja en
// `useSiteSettings()` (§ DatosNegocioSeccion, su propio fetch a la cuenta de pasarela). Por
// eso esta sección pide un snapshot FRESCO por `GET /api/site-settings` justo antes de
// guardar, en vez de arrastrar ese fetch durante toda la vida del componente — acota la
// ventana de "pisar un cambio ajeno" al tiempo de la propia petición, no al tiempo que la
// pantalla estuvo abierta.

type FormMensajes = Record<MomentoEditable, string>;

/** El form arranca del texto GUARDADO si existe; si no, de la plantilla de fábrica — así el
 *  textarea siempre muestra el texto que el cliente de verdad recibiría hoy. */
function desdeGuardado(guardado: MensajesWhatsappGuardados | undefined): FormMensajes {
  const out = {} as FormMensajes;
  for (const m of MOMENTOS_EDITABLES) {
    const custom = guardado?.[m];
    out[m] = custom && custom.trim() ? custom : plantillaPorDefecto(m);
  }
  return out;
}

/** El payload a mandar: SÓLO los momentos cuyo texto DIFIERE de la fábrica. Un momento sin
 *  tocar —o restaurado— queda AUSENTE, que es literalmente cómo el servidor entiende "usa el
 *  texto de fábrica" (§ el spec). Comparar contra el default, no contra un flag de "¿lo
 *  tocaste?", hace que escribir a mano el mismo texto de siempre tenga el mismo resultado que
 *  nunca haberlo tocado. */
function aOverrides(form: FormMensajes): MensajesWhatsappGuardados {
  const out: MensajesWhatsappGuardados = {};
  for (const m of MOMENTOS_EDITABLES) {
    const texto = form[m].trim();
    if (texto && texto !== plantillaPorDefecto(m).trim()) out[m] = texto;
  }
  return out;
}

// Los CINCO huecos insertables, uniformes en los cinco campos (§ el spec: "huecos
// insertables ({nombre}, {tienda}, {pedido}, {rastreo}, {pago})" es una lista única, no una
// por momento). Un hueco que no aplica al campo donde se insertó —`{pedido}` en el saludo sin
// pedido— queda LITERAL en la vista previa y en el mensaje real (§ `interpolar`): se nota en
// vez de desaparecer, así que ofrecer el mismo botón en los cinco campos es seguro.
const HUECOS_BOTON: readonly string[] = ['nombre', 'tienda', 'pedido', 'rastreo', 'pago'];

// El pedido de EJEMPLO que alimenta la vista previa — fijo, no viene de la base. Mismos
// nombres de hueco que la producción resuelve.
const EJEMPLO_NOMBRE = 'Camilo';
const EJEMPLO_NUMERO_ORDEN = 'CN-458356';

export default function MensajesClienteSeccion() {
  const settings = useSiteSettings();
  const router = useRouter();
  const guarda = useAccionGuardada();

  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<FormMensajes>(() => desdeGuardado(settings.mensajesWhatsapp));
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const refs = useRef<Partial<Record<MomentoEditable, HTMLTextAreaElement | null>>>({});

  const salirDeEdicion = () => { setEditando(false); setErrorServidor(null); };
  const descarte = useDescarteDeDrawer({ enVuelo: guarda.enVuelo, onCerrar: salirDeEdicion });

  const sucio = editando && JSON.stringify(form) !== JSON.stringify(desdeGuardado(settings.mensajesWhatsapp));
  useEffect(() => { descarte.marcarCambios(sucio); }, [sucio, descarte]);

  const abrirEdicion = () => {
    setForm(desdeGuardado(settings.mensajesWhatsapp));
    setErrorServidor(null);
    setEditando(true);
  };

  const setTexto = (m: MomentoEditable, valor: string) => setForm(f => ({ ...f, [m]: valor }));

  // Inserta el hueco en la posición del CURSOR del textarea (no al final) y le devuelve el
  // foco ahí mismo. `requestAnimationFrame` porque el valor del textarea es CONTROLADO: hay
  // que esperar a que React pinte el valor nuevo antes de mover la selección, o el navegador
  // la recorta contra el valor VIEJO (más corto).
  const insertarHueco = useCallback((m: MomentoEditable, hueco: string) => {
    const ta = refs.current[m];
    const base = form[m];
    const { valor, cursor } = insertarEnCursor(
      base,
      ta?.selectionStart ?? base.length,
      ta?.selectionEnd ?? base.length,
      `{${hueco}}`,
    );
    setTexto(m, valor);
    requestAnimationFrame(() => { ta?.focus(); ta?.setSelectionRange(cursor, cursor); });
  }, [form]);

  const restaurar = (m: MomentoEditable) => setTexto(m, plantillaPorDefecto(m));

  const origenEjemplo = typeof window !== 'undefined' ? window.location.origin : '';
  const huecosEjemplo = (m: MomentoEditable): Record<string, string> => m === 'saludo_cliente'
    ? { nombre: EJEMPLO_NOMBRE, tienda: settings.nombre }
    : {
        nombre:  EJEMPLO_NOMBRE,
        tienda:  settings.nombre,
        pedido:  EJEMPLO_NUMERO_ORDEN,
        rastreo: rastreoUrl(origenEjemplo, EJEMPLO_NUMERO_ORDEN),
        pago:    '',
      };

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorServidor(null);

    for (const m of MOMENTOS_EDITABLES) {
      if (!form[m].trim()) {
        setErrorServidor(`El mensaje de "${MOMENTO_EDITABLE_LABEL[m]}" no puede quedar vacío. Usa "Restaurar el texto por defecto" si no quieres editarlo.`);
        return;
      }
      if (form[m].trim().length > MAX_LARGO_MENSAJE_WHATSAPP) {
        setErrorServidor(`El mensaje de "${MOMENTO_EDITABLE_LABEL[m]}" supera los ${MAX_LARGO_MENSAJE_WHATSAPP} caracteres.`);
        return;
      }
    }

    guarda.ejecutar(async () => {
      // Snapshot FRESCO de todo lo demás — este endpoint no tiene write parcial (§ arriba).
      const resActual = await fetch('/api/site-settings');
      if (!resActual.ok) {
        setErrorServidor('No se pudo leer la configuración actual. Intenta de nuevo.');
        return;
      }
      const actual = await resActual.json();

      const payload = {
        nombre:            actual.nombre,
        tagline:           actual.tagline,
        descripcionFooter: actual.descripcionFooter,
        whatsapp:          actual.whatsapp,
        instagram:         actual.instagram,
        emailRemitente:    actual.emailRemitente,
        emailReplyTo:      actual.emailReplyTo,
        adminEmail:        actual.adminEmail,
        metodosPago:       actual.metodosPago,
        metodosPasarela:   actual.metodosPasarela,
        mensajesWhatsapp:  aOverrides(form),
      };

      const parsed = siteSettingsEditableSchema.safeParse(payload);
      if (!parsed.success) {
        setErrorServidor(parsed.error.issues[0]?.message ?? 'Datos inválidos.');
        return;
      }

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
      toast.success('Mensajes guardados.');
      setEditando(false);
      router.refresh();
    });
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--duna-space-4)' }}>
        <div style={{ minWidth: 0 }}>
          <h2 className="duna-title">Mensajes al cliente</h2>
          <p className="duna-sub" style={{ marginTop: '3px', maxWidth: '42rem' }}>
            El texto de WhatsApp que acompaña cada momento del pedido, y el saludo de la
            ficha del cliente. Sin editar, se usa el texto por defecto.
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
          {MOMENTOS_EDITABLES.map(m => (
            <div className="admin-bloque" key={m}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--duna-space-3)', marginBottom: 'var(--duna-space-2)' }}>
                <span className="duna-field__label">{MOMENTO_EDITABLE_LABEL[m]}</span>
                <button
                  type="button"
                  className="duna-btn duna-btn--ghost duna-btn--sm"
                  onClick={() => restaurar(m)}
                >
                  Restaurar el texto por defecto
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-4)' }}>
                <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                  <textarea
                    ref={el => { refs.current[m] = el; }}
                    className="duna-input"
                    rows={3}
                    value={form[m]}
                    onChange={e => setTexto(m, e.target.value)}
                    maxLength={MAX_LARGO_MENSAJE_WHATSAPP}
                  />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-1)', marginTop: 'var(--duna-space-2)' }}>
                    {HUECOS_BOTON.map(hueco => (
                      <button
                        key={hueco}
                        type="button"
                        className="duna-btn duna-btn--ghost duna-btn--sm"
                        onClick={() => insertarHueco(m, hueco)}
                      >
                        {`{${hueco}}`}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                  <p className="duna-field__hint" style={{ marginTop: 0, marginBottom: 'var(--duna-space-1)' }}>
                    Vista previa, con un pedido de ejemplo:
                  </p>
                  <p
                    className="duna-body"
                    style={{
                      margin: 0, padding: 'var(--duna-space-3)', borderRadius: 'var(--duna-r-m)',
                      background: 'var(--duna-surface)', border: '1px solid var(--duna-border)',
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}
                  >
                    {interpolar(form[m], huecosEjemplo(m))}
                  </p>
                </div>
              </div>
            </div>
          ))}

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
          {MOMENTOS_EDITABLES.map(m => {
            const custom = settings.mensajesWhatsapp?.[m];
            const texto = custom && custom.trim() ? custom : plantillaPorDefecto(m);
            return (
              <div className="admin-bloque" key={m}>
                <dl className="duna-form" style={{ margin: 0 }}>
                  <div className="duna-field">
                    <dt className="duna-field__label">{MOMENTO_EDITABLE_LABEL[m]}</dt>
                    <dd className="duna-body" style={{ margin: 0, wordBreak: 'break-word' }}>{texto}</dd>
                  </div>
                </dl>
              </div>
            );
          })}
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
