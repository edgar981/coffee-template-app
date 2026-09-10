'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Pencil, Trash2, Plus } from 'lucide-react';
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
import { ConfirmDeleteDialog } from '@/components/admin/ConfirmDeleteDialog';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
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
// aparte. La FORMA de esta lista es el mockup adoptado (§ PAGOS-METODOS-UI-1, sobre esta
// misma rama): dos grupos ("Pagan antes"/"Pagan al recibir") con su nota y un divisor
// punteado entre ellos, filas separadas por un divisor simple (sin barra de tinta — no es
// "esto está puesto", es sólo cuál método es), el "+ Agregar" como botón-con-menú que sólo
// ofrece los tipos que faltan, y "Quitar" que confirma (con los datos que se pierden,
// nombrados) sólo cuando el método TIENE datos que perder — y siempre con Deshacer en el
// toast. El MODELO (la lista, los cinco tipos, la validación) no se tocó en esta tanda.
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

// ── LA FORMA DEL BLOQUE PAGOS (§ PAGOS-METODOS-UI-1) ──────────────────────────────────────
// Dos grupos por NATURALEZA del pago, no por tipo: los cuatro primeros los paga el cliente
// ANTES de que salga el pedido (con comprobante de por medio); Contra entrega cambia la RUTA
// del dinero (la orden nace contraentrega, cobra el mensajero). El orden de `tipos` en cada
// grupo es un sub-tramo de `METODOS_PAGO_ORDEN`, así que agrupar nunca reordena la lista.
const GRUPOS_PAGO: { titulo: string; nota: string; tipos: MetodoPagoTipo[] }[] = [
  { titulo: 'Pagan antes',      nota: 'El cliente envía la plata y su comprobante',       tipos: ['nequi', 'daviplata', 'breb', 'transferencia'] },
  { titulo: 'Pagan al recibir', nota: 'Cambia la ruta del dinero, no sólo la instrucción', tipos: ['efectivo'] },
];

// Lo que cada tipo le pide al dueño — para el menú de "+ Agregar", que no debe hacer elegir
// a ciegas. No es un tercer lugar que declare los campos (siguen siendo `CAMPOS_METODO`,
// § lib/checkout/metodos-pago): es la frase HUMANA de qué se va a pedir, no una lista de
// nombres de campo.
const PIDE_METODO: Record<MetodoPagoTipo, string> = {
  nequi:         'El número donde recibes',
  daviplata:     'El número donde recibes',
  breb:          'Tu llave',
  transferencia: 'Banco, tipo y número de cuenta',
  efectivo:      'Nada que configurar',
};

// Contra entrega no tiene CAMPOS_METODO (nada que el dueño edite): su fila muestra esta
// regla como DATO fijo, en las dos superficies — nunca un campo, nunca "Sin definir".
const NOTA_CONTRAENTREGA = 'Solo Bogotá · el cliente paga al recibir, la orden nace contraentrega.';

/** Los valores no vacíos de los campos de un método, unidos en UNA línea — la línea MONO de
 *  la fila ("Bancolombia · Ahorros · 512 8834 1120 · …"). Contra entrega no tiene campos:
 *  su línea es `NOTA_CONTRAENTREGA`, no esto. */
function datosMetodoTexto(m: MetodoPagoGuardado): string {
  return CAMPOS_METODO[m.tipo]
    .map(c => (m.datos[c.name] ?? '').trim())
    .filter(Boolean)
    .join(' · ');
}

/** ¿Hay algo que se pierda si se quita este método? Determina si "Quitar" confirma
 *  (§ PAGOS-METODOS-UI-1 3.2): sin datos —Contra entrega, o uno recién agregado— no hay
 *  trabajo que destruir. */
function metodoTieneDatos(m: MetodoPagoGuardado): boolean {
  return datosMetodoTexto(m).length > 0;
}

export default function DatosNegocioSeccion() {
  const settings = useSiteSettings();
  const router   = useRouter();
  const guarda   = useAccionGuardada();

  const [editando, setEditando]           = useState(false);
  const [form, setForm]                   = useState<FormState>(() => desdeSettings(settings));
  const [errores, setErrores]             = useState<Partial<Record<keyof FormState, string>>>({});
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  // El método pendiente de confirmar "Quitar" — sólo cuando TIENE datos que perder
  // (§ metodoTieneDatos). Sin datos, quitar no pasa por acá.
  const [confirmarQuitar, setConfirmarQuitar] = useState<MetodoPagoGuardado | null>(null);

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

  // Quita el método del form y avisa con Deshacer — el precedente vivo es el
  // `action: { label: 'Reintentar' }` de Automatizaciones y del Dashboard. El chequeo de
  // duplicado en Deshacer es la red: si el operador ya volvió a agregar el mismo tipo antes
  // de pulsar Deshacer, no lo vuelve a meter.
  const quitarConDeshacer = (m: MetodoPagoGuardado) => {
    setForm(f => ({ ...f, metodosPago: f.metodosPago.filter(x => x.tipo !== m.tipo) }));
    toast.success(`${labelMetodo(m.tipo)} quitado.`, {
      action: {
        label: 'Deshacer',
        onClick: () => setForm(f => (
          f.metodosPago.some(x => x.tipo === m.tipo) ? f : { ...f, metodosPago: [...f.metodosPago, m] }
        )),
      },
    });
  };

  // Con datos, confirma primero (nombrando lo que se pierde); sin datos —Contra entrega, o
  // un método recién agregado sin llenar— no hay nada que destruir, así que quita directo.
  const onQuitarClick = (m: MetodoPagoGuardado) => {
    if (metodoTieneDatos(m)) setConfirmarQuitar(m);
    else quitarConDeshacer(m);
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

          {/* Pagos — LISTA en dos grupos (§ PAGOS-METODOS-UI-1): estar acá ES ofrecerlo, sin
              encendido/apagado aparte. El error de lista vacía va AL TOPE, antes del contenido —
              es la validación dura (`metodosPago` del schema), sólo tras el primer intento de
              guardar. El estado vacío (abajo) es descriptivo y no depende de ese intento. */}
          <div className="admin-bloque">
            {renderEncabezadoBloque('Pagos', { marginBottom: 'var(--duna-space-1)' })}
            <p className="duna-field__hint" style={{ marginTop: 0, marginBottom: 'var(--duna-space-3)' }}>
              Agrega los métodos que ofreces; cada uno pide sus datos aquí mismo. Un método sin sus
              datos no se muestra en la tienda.
            </p>

            {errores.metodosPago && (
              <p className="duna-field__error" style={{ marginBottom: 'var(--duna-space-3)' }}>{errores.metodosPago}</p>
            )}

            {renderGruposPago(form.metodosPago, m => renderFilaMetodoEdicion(m, onQuitarClick, setDatoMetodo))}

            {/* "+ Agregar" es un botón con menú, no un diálogo: crea una fila vacía que se llena
                ahí mismo. Sólo ofrece los tipos que FALTAN, cada uno con lo que va a pedir — para
                que el dueño no elija a ciegas. Con los cinco puestos, el botón se queda
                deshabilitado y dice por qué (desaparecer dejaría buscando una acción que no existe). */}
            <div style={{ marginTop: 'var(--duna-space-4)', paddingTop: 'var(--duna-space-4)', borderTop: '1px solid var(--duna-border)' }}>
              {faltantes.length > 0 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="duna-btn duna-btn--secondary duna-btn--sm">
                      <Plus /> Agregar método de pago
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
                    {faltantes.map(t => (
                      <DropdownMenuItem key={t} onSelect={() => agregarMetodo(t)} className="cursor-pointer">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span>{labelMetodo(t)}</span>
                          <span className="duna-field__hint">{PIDE_METODO[t]}</span>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <button type="button" className="duna-btn duna-btn--secondary duna-btn--sm" disabled>
                  <Plus /> Ya ofreces los cinco métodos que Duna soporta.
                </button>
              )}
            </div>
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

          {/* Pagos — MISMO esqueleto que edición (grupos + filas), sin los controles de
              agregar/quitar. Un método en la lista sin sus datos muestra el mismo chip ámbar que
              en edición: el estado sale SIEMPRE de `metodoIncompleto`, nunca reimplementado acá. */}
          <div className="admin-bloque">
            {renderEncabezadoBloque('Pagos', { marginBottom: 'var(--duna-space-1)' })}
            <p className="duna-field__hint" style={{ marginTop: 0, marginBottom: 'var(--duna-space-3)' }}>
              Los métodos que ofreces en el checkout. Un método sin sus datos no se muestra en la
              tienda.
            </p>

            {renderGruposPago(settings.metodosPago, renderFilaMetodoLectura)}
          </div>
        </div>
      )}

      <ConfirmDescartarDialog
        abierto={descarte.confirmando}
        onDescartar={descarte.descartar}
        onSeguir={descarte.seguirEditando}
      />

      {/* Quitar un método CON datos confirma, nombrando lo que se pierde — sin datos
          (§ metodoTieneDatos) `onQuitarClick` no llega hasta acá. */}
      <ConfirmDeleteDialog
        open={!!confirmarQuitar}
        onOpenChange={(o) => { if (!o) setConfirmarQuitar(null); }}
        title={confirmarQuitar ? `Quitar ${labelMetodo(confirmarQuitar.tipo)}` : 'Quitar método de pago'}
        entityLabel={confirmarQuitar ? labelMetodo(confirmarQuitar.tipo) : ''}
        consequence={confirmarQuitar
          ? `Se borran sus datos (${datosMetodoTexto(confirmarQuitar)}) y deja de aparecer en tu checkout. Si lo vuelves a agregar, tienes que escribirlos otra vez.`
          : ''}
        confirmLabel={confirmarQuitar ? `Quitar ${labelMetodo(confirmarQuitar.tipo)}` : 'Quitar'}
        busyLabel="Quitando…"
        onConfirm={async () => { if (confirmarQuitar) quitarConDeshacer(confirmarQuitar); }}
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

// ── PAGOS · grupos + filas (§ PAGOS-METODOS-UI-1) ──────────────────────────────────────────
// Los DOS GRUPOS ("Pagan antes" / "Pagan al recibir") + el estado vacío, compartidos por
// lectura y edición — sólo cambia CÓMO se pinta cada fila (`renderFila`). Un grupo sin
// métodos presentes no se renderiza (con un solo método no puede verse ni vacío ni
// sobre-estructurado).
function renderGruposPago(metodos: MetodoPagoGuardado[], renderFila: (m: MetodoPagoGuardado) => React.ReactNode) {
  if (metodos.length === 0) {
    return (
      <div className="admin-pagos-vacio">
        <p className="duna-body" style={{ margin: 0, color: 'var(--duna-ink-2)' }}>
          No ofreces ningún método de pago · Tu checkout no puede cobrar hasta que agregues al
          menos uno.
        </p>
      </div>
    );
  }
  const ordenado = enOrdenCanonico(metodos);
  return GRUPOS_PAGO.map(grupo => {
    const enGrupo = ordenado.filter(m => grupo.tipos.includes(m.tipo));
    if (enGrupo.length === 0) return null;
    return (
      <div className="admin-pagos-grupo" key={grupo.titulo}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--duna-space-2)', flexWrap: 'wrap', marginBottom: 'var(--duna-space-2)' }}>
          <span className="duna-field__label">{grupo.titulo}</span>
          <span className="duna-field__hint">{grupo.nota}</span>
        </div>
        {enGrupo.map(renderFila)}
      </div>
    );
  });
}

// LECTURA: nombre + su línea de dato en UNA línea (mono, --duna-ink-2 — lo que el cliente lee
// en el checkout), o la regla fija de Contra entrega, o "Sin definir" si no tiene nada aún. El
// aviso son sus DOS mitades: el chip (QUÉ falta) y la frase (la CONSECUENCIA), complementarias.
function renderFilaMetodoLectura(m: MetodoPagoGuardado) {
  const falta = metodoIncompleto(m);
  const esEfectivo = m.tipo === 'efectivo';
  const datos = datosMetodoTexto(m);
  return (
    <div className="admin-pagos-fila" key={m.tipo}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--duna-space-3)' }}>
        <div style={{ minWidth: 0 }}>
          <p className="duna-field__label" style={{ margin: 0 }}>{labelMetodo(m.tipo)}</p>
          {esEfectivo ? (
            <p className="admin-pagos-dato admin-pagos-dato--regla" style={{ marginTop: 'var(--duna-space-1)' }}>{NOTA_CONTRAENTREGA}</p>
          ) : datos ? (
            <p className="admin-pagos-dato" style={{ marginTop: 'var(--duna-space-1)' }}>{datos}</p>
          ) : (
            <p className="duna-body" style={{ margin: 'var(--duna-space-1) 0 0', color: 'var(--duna-muted)' }}>Sin definir</p>
          )}
          {falta && (
            <p style={{
              margin: 'var(--duna-space-1) 0 0', fontSize: 'var(--duna-text-caption)',
              fontWeight: 'var(--duna-w-semi)', color: 'var(--duna-sol-ink)',
            }}>
              No se muestra en la tienda hasta que lo completes.
            </p>
          )}
        </div>
        {falta && (
          <span className="duna-badge duna-badge--attention" style={{ flexShrink: 0 }}>
            <span className="duna-badge__dot" />{falta}
          </span>
        )}
      </div>
    </div>
  );
}

// EDICIÓN: mismo nombre a la izquierda; a la derecha, el MISMO chip (aparece también acá,
// depende sólo de `metodoIncompleto`, no del modo) + Quitar. Abajo, sus campos editables (o la
// regla fija de Contra entrega, que no es un campo). El tipo de cuenta de Transferencia es un
// select nativo con las dos opciones — el único campo del set que no es texto libre.
function renderFilaMetodoEdicion(
  m: MetodoPagoGuardado,
  onQuitarClick: (m: MetodoPagoGuardado) => void,
  setDatoMetodo: (tipo: MetodoPagoTipo, campo: string, valor: string) => void,
) {
  const falta = metodoIncompleto(m);
  const esEfectivo = m.tipo === 'efectivo';
  const campos = CAMPOS_METODO[m.tipo];
  return (
    <div className="admin-pagos-fila" key={m.tipo}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--duna-space-3)' }}>
        <span className="duna-field__label" style={{ margin: 0 }}>{labelMetodo(m.tipo)}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', flexShrink: 0 }}>
          {falta && (
            <span className="duna-badge duna-badge--attention">
              <span className="duna-badge__dot" />{falta}
            </span>
          )}
          <button
            type="button"
            className="duna-btn duna-btn--ghost duna-btn--sm"
            aria-label={`Quitar ${labelMetodo(m.tipo)}`}
            onClick={() => onQuitarClick(m)}
          >
            <Trash2 />
          </button>
        </div>
      </div>
      {esEfectivo ? (
        <p className="admin-pagos-dato admin-pagos-dato--regla" style={{ marginTop: 'var(--duna-space-2)' }}>{NOTA_CONTRAENTREGA}</p>
      ) : campos.length > 0 && (
        <div className="duna-form duna-form--sm" style={{ marginTop: 'var(--duna-space-3)' }}>
          {campos.map(c => {
            const id = `met-${m.tipo}-${c.name}`;
            const esTipoCuenta = m.tipo === 'transferencia' && c.name === 'tipoCuenta';
            return (
              <div className="duna-field" key={c.name}>
                <label className="duna-field__label" htmlFor={id}>{c.label}</label>
                {esTipoCuenta ? (
                  <select
                    id={id}
                    className="duna-input duna-select duna-input--sm"
                    value={m.datos[c.name] ?? ''}
                    onChange={e => setDatoMetodo(m.tipo, c.name, e.target.value)}
                  >
                    <option value="">—</option>
                    <option value="Ahorros">Ahorros</option>
                    <option value="Corriente">Corriente</option>
                  </select>
                ) : (
                  <input
                    id={id}
                    className="duna-input duna-input--sm"
                    value={m.datos[c.name] ?? ''}
                    onChange={e => setDatoMetodo(m.tipo, c.name, e.target.value)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
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
