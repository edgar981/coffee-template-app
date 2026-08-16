'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { MessageCircle, Mail, Plus } from 'lucide-react';
import { DunaSheet } from '@/components/admin/DunaSheet';
import { DateField } from '@/components/admin/DateField';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ErrorDialogo, useErrorDialogo } from '@/components/admin/ErrorDialogo';
import { formatCOP } from '@duna/core/utils';
import { scheduleDelivery } from '@/lib/api/shippings';
import { getDeliveryContext, updateOrderAddress } from '@/lib/api/orders';
import type { Shipping, ShippingZona, TipoEnvio } from '@/types/shipping';
import { TIPO_ENVIO_LABEL } from '@/types/shipping';
import type { DeliveryContext, OrderAddressResult } from '@/types/order';
import { ZONAS, SHIPPING_ESTADO_LABEL, hasScheduleData, missingToDispatch } from '@/constants/shippings';
import { problemaGuardarEntrega, hayCambiosProgramacion, type ProgramacionSnapshot } from '@/lib/pedidos/programar';
import { useAccionGuardada } from '@/hooks/useAccionGuardada';
import { useDescarteDeDrawer } from '@/hooks/useDescarteDeDrawer';
import { ConfirmDescartarDialog } from '@/components/admin/ConfirmDescartarDialog';
import { sugerirZona } from '@duna/core/zona-config';
import { COLOMBIA_DEPARTMENTS } from '@duna/core/colombia-departments';
import { customerWhatsappHref } from '@duna/core/whatsapp-link';
import { siteConfig } from '@/lib/config/site';

// The modal takes the Shipping — it fetches the order's delivery context
// (contact + address + linked customer) itself, so it behaves the same from
// Entregas, Órdenes y el detalle de la orden, y siempre refleja la última
// dirección.
export interface ScheduleTarget {
  shipping: Shipping;
  /**
   * Id de la ORDEN, explícito. Por defecto se toma de `shipping.orden_id`, que es
   * lo que tiene el board (su fuente es `/api/shippings`, donde el Shipping es la
   * fila raíz y su FK viene completa).
   *
   * Existe porque quien monta el modal desde una ORDEN sí tiene el id a la mano y
   * no debería depender de que el Shipping ANIDADO en su payload traiga la FK:
   * ése es el dato que viaja por más manos —lo reemplazan la respuesta del PATCH
   * de entregas, la del POST de pago, la del PATCH de orden— y basta que una lo
   * entregue recortado para que el modal pida `/api/orders/undefined/...` y
   * muestre "no se pudieron cargar los datos". Es el riesgo de "modal que asume
   * el contexto de su página", en su forma menos visible: no falta una prop,
   * falta un campo DENTRO de una prop.
   */
  ordenId?: string;
}

export function ScheduleDeliveryModal({ target, onClose, onSaved, onAddressAdded }: {
  target: ScheduleTarget | null;
  onClose: () => void;
  onSaved: (shipping: Shipping) => void;
  // Fired after an address is added to the order, so the parent list can reflect
  // it without a full reload.
  onAddressAdded?: (orderId: string, address: { direccion_entrega: string; ciudad_entrega: string }) => void;
}) {
  // LA GUARDA VIVE EN EL ENVOLTORIO para cerrar la TERCERA salida: sin su enVuelo,
  // Esc/clic-fuera/Cancelar cerrarían el drawer a mitad de programar, y como el
  // submit vive en el cuerpo, cerrar lo desmonta y el error se pierde.
  const guarda = useAccionGuardada();
  const descarte = useDescarteDeDrawer({ enVuelo: guarda.enVuelo, onCerrar: onClose });
  return (
    <>
      <DunaSheet
        abierto={!!target}
        onCerrar={descarte.intentarCerrar}
        anclaje="lado"
        titulo={target ? titleFor(target.shipping) : 'Programar entrega'}
        descripcion="Asigna mensajero, zona y fecha de entrega. Despachar exige mensajero Y fecha."
      >
        <div className="duna-modal__head">
          <div className="duna-title">{target ? titleFor(target.shipping) : 'Programar entrega'}</div>
        </div>
        {target && (
          <ScheduleBody
            key={target.shipping.id}
            shipping={target.shipping}
            ordenId={target.ordenId ?? target.shipping.orden_id}
            guarda={guarda}
            marcarCambios={descarte.marcarCambios}
            intentarCerrar={descarte.intentarCerrar}
            onClose={onClose}
            onSaved={onSaved}
            onAddressAdded={onAddressAdded}
          />
        )}
      </DunaSheet>
      <ConfirmDescartarDialog abierto={descarte.confirmando} onDescartar={descarte.descartar} onSeguir={descarte.seguirEditando} />
    </>
  );
}

function titleFor(shipping: Shipping): string {
  if (shipping.estado === 'fallido') return 'Reprogramar entrega';
  // Título = presentación: hay datos de programación → se está editando, aunque
  // todavía falte el mensajero para poder despachar.
  return hasScheduleData(shipping) ? 'Editar entrega' : 'Programar entrega';
}

function ScheduleBody({ shipping, ordenId, guarda, marcarCambios, intentarCerrar, onClose, onSaved, onAddressAdded }: {
  shipping: Shipping;
  ordenId: string | undefined;
  guarda: ReturnType<typeof useAccionGuardada>;
  marcarCambios: (hay: boolean) => void;
  /** Cerrar pasando por la guarda de descarte (Cancelar/Esc/scrim). */
  intentarCerrar: () => void;
  /** Cierre REAL, tras guardar con éxito. */
  onClose: () => void;
  onSaved: (shipping: Shipping) => void;
  onAddressAdded?: (orderId: string, address: { direccion_entrega: string; ciudad_entrega: string }) => void;
}) {
  const [ctx, setCtx]             = useState<DeliveryContext | null>(null);
  // Sin id de orden no hay nada que cargar, así que ni siquiera arranca en
  // "cargando": el caso se DERIVA del prop y se resuelve en el render, no con un
  // setState dentro del efecto (que dispara renders en cascada y el lint marca —
  // mismo criterio que el `loading` derivado de Analítica).
  const [loading, setLoading]     = useState(!!ordenId);
  // El MOTIVO, no un booleano. Un "no se pudieron cargar los datos" a secas es
  // indistinguible entre un 404, una sesión vencida y un campo que llegó vacío —
  // y esa indistinción es lo que vuelve caro el diagnóstico (misma regla que
  // `razonDelServidor`: un mensaje genérico borra la única frase que sirve).
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAddrForm, setShowAddrForm] = useState(false);

  // Operator-supplied scheduling fields.
  const [zona, setZona]           = useState<ShippingZona>((shipping.zona as ShippingZona) ?? 'centro');
  const [mensajero, setMensajero] = useState(shipping.mensajero ?? '');
  const [fecha, setFecha]         = useState(shipping.fecha_programada ?? '');
  const [notas, setNotas]         = useState(shipping.notas_entrega ?? '');
  // LOCAL (mensajero propio) o NACIONAL (transportadora + guía).
  const [tipoEnvio, setTipoEnvio]           = useState<TipoEnvio>(shipping.tipo_envio ?? 'LOCAL');
  const [transportadora, setTransportadora] = useState(shipping.transportadora ?? '');
  const [numeroGuia, setNumeroGuia]         = useState(shipping.numero_guia ?? '');
  const [saving, setSaving]       = useState(false);

  // Snapshot PRESENTADO al abrir, para el "no hay cambios" del botón y para la
  // guarda de descarte. Se fija en el efecto de carga, DESPUÉS de aplicar los
  // defaults inteligentes (zona sugerida, último mensajero): así "abrir sin tocar
  // nada" queda sin cambios aunque el sistema haya pre-llenado un par de campos —
  // aceptar una sugerencia sin tocarla no es una edición. Se computa con los
  // mismos valores que el efecto va a poner, no leyendo el estado (que es async).
  const [inicial, setInicial] = useState<ProgramacionSnapshot | null>(null);

  // Los valores crudos del Shipping, estables por la key del remonte. Se sacan
  // del efecto para que su dep array siga siendo booleanos estables (mismo
  // criterio que `nuncaProgramada`/`sinMensajero`) y no la lista de campos.
  const seedShipping = useMemo<ProgramacionSnapshot>(() => ({
    zona:           (shipping.zona as ShippingZona) ?? 'centro',
    mensajero:      shipping.mensajero ?? '',
    fecha:          shipping.fecha_programada ?? '',
    notas:          shipping.notas_entrega ?? '',
    tipoEnvio:      shipping.tipo_envio ?? 'LOCAL',
    transportadora: shipping.transportadora ?? '',
    numeroGuia:     shipping.numero_guia ?? '',
  }), [shipping]);

  // Zona sugerida por la dirección (heurística de texto, lib/zona-config.ts).
  // Se guarda aparte de `zona` porque viaja al servidor como auditoría: la
  // corrección del operador se deriva de `zona_sugerida !== zona`.
  const [zonaSugerida, setZonaSugerida] = useState<ShippingZona | null>(null);
  // El operador movió el Select en ESTA sesión del modal. A partir de ahí la
  // heurística no vuelve a tocar la zona (ni siquiera si cambia la dirección):
  // una elección humana no se pisa sola.
  const [zonaTouched, setZonaTouched]   = useState(false);

  // Solo se pre-selecciona cuando no hay ninguna decisión humana que pisar:
  // entrega recién auto-creada, sin zona, sin mensajero y sin fecha. NO se usa
  // `hasScheduleData` aquí: una entrega `fallido` la incumple y sin embargo fue
  // programada por una persona (por eso falló) — sugerirle encima sería
  // sobreescribir esa decisión al reprogramar.
  const nuncaProgramada =
    !shipping.zona && !shipping.mensajero?.trim() && !shipping.fecha_programada?.trim();

  // Esta entrega no trae mensajero, así que el campo puede pre-llenarse con el
  // último usado. Derivado acá arriba —como `nuncaProgramada`— para que el efecto
  // dependa de un booleano estable y no de una cadena que se lee dentro.
  const sinMensajero = !shipping.mensajero?.trim();

  useEffect(() => {
    let active = true;
    // Sin id de orden no se dispara `/api/orders/undefined/delivery-context`
    // para después traducir su 404 a un fallo de carga genérico: el caso se
    // nombra abajo, en el render.
    if (!ordenId) return;
    getDeliveryContext(ordenId)
      .then(c => {
        if (!active) return;
        setCtx(c);
        const sug = sugerirZona(c.direccion_entrega, c.ciudad_entrega);
        setZonaSugerida(sug);
        // `null` = la heurística no supo: se deja el default actual y no se
        // marca nada como sugerido.
        if (sug && nuncaProgramada) setZona(sug);

        // Default inteligente del mensajero: el último usado. Solo cuando ESTA
        // entrega no tiene uno — nunca pisa lo que hay, ni siquiera al
        // reprogramar una fallida (ahí el mensajero anterior es información, no
        // un hueco). Se decide con el prop y no con el estado, porque el estado
        // ya pudo haberlo tecleado el operador mientras cargaba la fetch.
        if (sinMensajero && c.ultimoMensajero) setMensajero(c.ultimoMensajero);

        // La línea de base contra la que se mide "¿hay cambios?": el crudo del
        // Shipping con los defaults recién aplicados encima (zona/mensajero).
        setInicial({
          ...seedShipping,
          zona:      (sug && nuncaProgramada)        ? sug             : seedShipping.zona,
          mensajero: (sinMensajero && c.ultimoMensajero) ? c.ultimoMensajero : seedShipping.mensajero,
        });
      })
      .catch((e) => {
        if (active) setLoadError(e instanceof Error && e.message ? e.message : 'No se pudieron cargar los datos de la orden.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ordenId, nuncaProgramada, sinMensajero, seedShipping]);

  const hasAddress   = !!ctx?.direccion_entrega?.trim();
  const isReschedule = shipping.estado === 'fallido';
  // Estado ORIGINAL al abrir (el prop es estable: ScheduleBody se remonta por
  // key={shipping.id}). Discrimina "programar" de "actualizar" en el toast —
  // calcularlo sobre la respuesta del servidor haría que toda primera
  // programación dijera "actualizada".
  const wasScheduled = hasScheduleData(shipping);

  // Vista previa del resultado de guardar, sobre lo que el operador está
  // escribiendo ahora: el aviso aparece/desaparece mientras edita, sin guardar.
  // Reprogramar un `fallido` lo devuelve a `preparando` (lo hace el servidor),
  // así que el borrador usa ese estado para que el aviso también aplique ahí.
  const draft = {
    estado:           isReschedule ? 'preparando' : shipping.estado,
    mensajero,
    fecha_programada: fecha,
  };
  // Solo con al menos un dato puesto: en una entrega recién creada (nada
  // diligenciado) no hay nada que reclamar todavía.
  const faltaParaDespachar = hasScheduleData(draft) ? missingToDispatch(draft) : null;

  // ¿Qué impide guardar? Sin dirección o sin cambios. `inicial ?? actual` cae en
  // "sin cambios" mientras la línea de base no está fijada (no llega a verse: el
  // botón no se renderiza durante la carga), así que nunca queda habilitado por
  // defecto. Cubre el caso reportado: abrir sin tocar nada → deshabilitado.
  const actual: ProgramacionSnapshot = { zona, mensajero, fecha, notas, tipoEnvio, transportadora, numeroGuia };
  const problema = problemaGuardarEntrega(actual, inicial ?? actual, hasAddress);

  // ¿Hay algo que descartar al cerrar? Sólo cuando la línea de base ya está
  // fijada. El formulario inline de dirección tiene su propio Cancelar y queda
  // fuera de esta guarda.
  const cambios = inicial ? hayCambiosProgramacion(actual, inicial) : false;
  useEffect(() => { marcarCambios(cambios); }, [cambios, marcarCambios]);

  // La guarda de doble-submit la aporta el ENVOLTORIO (para poder gatear el
  // cierre). La de AddressForm es aparte: es un sub-formulario con su propio envío.
  const errorProgramar  = useErrorDialogo();
  const handleSchedule = () => guarda.ejecutar(async () => {
    errorProgramar.limpiar();
    setSaving(true);
    try {
      const updated = await scheduleDelivery(shipping.id, {
        // `zona` es SIEMPRE lo que quedó en el Select; la sugerencia viaja
        // aparte y solo para auditar la heurística (nunca la reemplaza).
        zona,
        zona_sugerida:    zonaSugerida,
        mensajero:        mensajero.trim() || null,
        fecha_programada: fecha || null,
        notas_entrega:    notas.trim() || null,
        tipo_envio:       tipoEnvio,
        transportadora:   transportadora.trim() || null,
        numero_guia:      numeroGuia.trim() || null,
      });
      onSaved(updated);
      // Identifica la orden y distingue programar de actualizar. Si el
      // resultado GUARDADO todavía no alcanza para despachar, se dice — el
      // label ya pasó a "Editar entrega" y esa brecha no puede quedar muda.
      const orden = ctx?.numero_orden;
      const titulo =
        isReschedule  ? (orden ? `Orden ${orden} reprogramada para entrega` : 'Entrega reprogramada')
        : wasScheduled ? (orden ? `Orden ${orden}: entrega actualizada`     : 'Entrega actualizada')
        :                (orden ? `Orden ${orden} programada para entrega`  : 'Entrega programada');
      const falta = missingToDispatch(updated);
      toast.success(titulo, falta ? {
        description: `Falta asignar ${falta === 'mensajero' ? 'mensajero' : 'la fecha programada'} para despachar.`,
      } : undefined);
      onClose();
    } catch (e) {
      errorProgramar.mostrar(e, 'Error al programar la entrega');
    }
    setSaving(false);
  });

  const handleAddressSaved = (result: OrderAddressResult) => {
    // La dirección cambió → la sugerencia se recalcula. Si el operador ya movió
    // el Select en esta sesión, se actualiza la auditoría pero NO la selección.
    const sug = sugerirZona(result.direccion_entrega, result.ciudad_entrega);
    setZonaSugerida(sug);
    if (sug && !zonaTouched) setZona(sug);

    setCtx(c => c ? {
      ...c,
      direccion_entrega: result.direccion_entrega,
      ciudad_entrega:    result.ciudad_entrega,
      direccion_detalle: result.direccion_detalle,
      telefono:          result.cliente_telefono ?? c.telefono,
    } : c);
    setShowAddrForm(false);
    onAddressAdded?.(ordenId ?? '', {
      direccion_entrega: result.direccion_entrega ?? '',
      ciudad_entrega:    result.ciudad_entrega ?? '',
    });
  };

  if (!ordenId) {
    return (
      <div className="py-10 text-center duna-field__error">
        Esta entrega no trae la orden asociada. Recarga la página e intenta de nuevo.
      </div>
    );
  }
  if (loading) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Cargando datos de la orden…</div>;
  }
  if (loadError || !ctx) {
    return (
      <div className="py-10 text-center duna-field__error">
        {loadError ?? 'No se pudieron cargar los datos de la orden.'}
      </div>
    );
  }

  const nombre  = ctx.cliente_nombre?.trim();
  const saludo  = nombre ? `Hola ${nombre}` : 'Hola';
  const waHref  = customerWhatsappHref(
    ctx.telefono,
    `${saludo}, te escribimos de ${siteConfig.brand.nombre} por tu pedido ${ctx.numero_orden}`,
  );
  const mailHref = ctx.cliente_email
    ? `mailto:${ctx.cliente_email}?subject=${encodeURIComponent(`Tu pedido ${ctx.numero_orden} — ${siteConfig.brand.nombre}`)}`
    : null;
  const addressLine = [ctx.direccion_entrega, ctx.ciudad_entrega].filter(Boolean).join(', ') || '—';

  return (
    <>
      <div className="duna-modal__body space-y-4">
      {/* Contexto de solo lectura de la orden. SIN relleno: el fondo era
          `bg-muted/40` (utilidad shadcn, no una superficie Duna). Se separa de los
          campos editables con una regla inferior de `--duna-border` y su
          espaciado — no con un color de fondo. Padding y orden se conservan. */}
      <div className="p-3 space-y-3" style={{ borderBottom: '1px solid var(--duna-border)' }}>
        <div className="grid grid-cols-2 gap-3">
          <InfoRow label="Orden" value={ctx.numero_orden} />
          <div>
            <p className="text-xs text-muted-foreground">Cliente</p>
            {ctx.customer ? (
              // TINTA, no ámbar, y SIN ícono de enlace externo: idéntico al del
              // detalle de la orden. El destino es `?cliente=` —navegación DENTRO
              // del panel—, así que un glifo de "otra pestaña" prometía algo que no
              // pasa. `.duna-link` da la tinta y el subrayado en hover.
              <Link
                href={`/admin/clientes?cliente=${encodeURIComponent(ctx.customer.id)}`}
                className="duna-link mt-0.5 inline-block font-medium"
                title={`Ver ficha de ${nombre ?? 'cliente'}`}
              >
                {nombre ?? '—'}
              </Link>
            ) : (
              <p className="mt-0.5 font-medium">{nombre ?? '—'}</p>
            )}
          </div>
        </div>

        {/* Direct contact — only when there's data */}
        {(waHref || mailHref) && (
          <div className="flex flex-wrap gap-2">
            {waHref && (
              <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                <a href={waHref} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                </a>
              </Button>
            )}
            {mailHref && (
              <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                <a href={mailHref}>
                  <Mail className="w-3.5 h-3.5" /> Email
                </a>
              </Button>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <InfoRow label="Costo de envío" value={formatCOP(shipping.costo_envio)} />
          <InfoRow label="Estado entrega" value={SHIPPING_ESTADO_LABEL[shipping.estado] ?? shipping.estado} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Dirección</p>
          <p className="mt-0.5 font-medium">{addressLine}</p>
          {ctx.direccion_detalle?.trim() && (
            <p className="text-xs text-muted-foreground">{ctx.direccion_detalle}</p>
          )}
        </div>
      </div>

      {/* Missing address → warning + inline add form */}
      {!hasAddress && !showAddrForm && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3 text-xs text-amber-800 dark:text-amber-300">
          <span>Esta orden no tiene dirección de entrega.</span>
          <Button size="sm" variant="outline" className="h-7 shrink-0 gap-1 text-xs" onClick={() => setShowAddrForm(true)}>
            <Plus className="w-3.5 h-3.5" /> Agregar dirección
          </Button>
        </div>
      )}
      {showAddrForm && (
        <AddressForm
          orderId={ordenId ?? ''}
          initialPhone={ctx.telefono}
          onCancel={() => setShowAddrForm(false)}
          onSaved={handleAddressSaved}
        />
      )}

      {/* Operator fills only these */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <span className="duna-field__label">Tipo de envío</span>
          <select className="duna-input duna-select" value={tipoEnvio} aria-label="Tipo de envío"
                  onChange={e => setTipoEnvio(e.target.value as TipoEnvio)}>
            {(['LOCAL', 'NACIONAL'] as TipoEnvio[]).map(t => (
              <option key={t} value={t}>{TIPO_ENVIO_LABEL[t]}</option>
            ))}
          </select>
        </div>
        {tipoEnvio === 'NACIONAL' && (
          <>
            <div>
              <span className="duna-field__label">Transportadora</span>
              <input className="duna-input" value={transportadora} onChange={e => setTransportadora(e.target.value)} placeholder="Servientrega, Coordinadora…" />
            </div>
            <div>
              <span className="duna-field__label">Número de guía</span>
              <input className="duna-input" value={numeroGuia} onChange={e => setNumeroGuia(e.target.value)} placeholder="Guía de rastreo" />
            </div>
          </>
        )}
        <div>
          <span className="duna-field__label">Mensajero</span>
          <input className="duna-input" value={mensajero} onChange={e => setMensajero(e.target.value)} placeholder="Nombre del mensajero" />
        </div>
        <div>
          <span className="duna-field__label">Zona *</span>
          {/* `capitalize` va en el CONTROL y no en la opción: la lista la pinta
              el sistema operativo y no admite estilos, así que capitalizar item
              por item no tendría efecto. En el cerrado sí se ve. */}
          <select className="duna-input duna-select capitalize" value={zona} aria-label="Zona"
                  onChange={e => { setZona(e.target.value as ShippingZona); setZonaTouched(true); }}>
            {ZONAS.map(z => <option key={z} value={z}>{z}</option>)}
          </select>
          {/* Debajo del Select, no junto al Label: en esta columna (media
              rejilla) el texto al lado partía "Zona *" en dos líneas. Muted y
              sin pill — la sugerencia no es un estado ni una alerta. Se cae en
              cuanto el operador elige otra cosa. */}
          {zonaSugerida && !zonaTouched && zona === zonaSugerida && (
            <p className="mt-1 text-xs text-muted-foreground">Sugerida según la dirección</p>
          )}
        </div>
        <div className="duna-field">
          <label className="duna-field__label" htmlFor="sd-fecha">Fecha programada</label>
          {/* EL MISMO calendario que el "Rango de fechas" de Pedidos. Era un
              `<input type="date">`, y ésa era la incoherencia: dos date pickers
              distintos para la misma tarea, visibles en la misma sesión. */}
          <DateField id="sd-fecha" value={fecha} onChange={setFecha} />
        </div>
        {/* GUARDAR PARCIAL ES LEGÍTIMO: programar ahora y completar después es un
            flujo válido (mensajero y fecha son opcionales para agendar; sólo
            DESPACHAR exige ambos, § entrega-estado). Por eso el copy dice "puedes
            guardarla así" ANTES de nombrar lo que faltará: sonaba a error de
            validación al lado de un botón Guardar habilitado, y no lo es — el
            defecto era el copy, no el botón. */}
        {faltaParaDespachar && (
          <p className="col-span-2 -mt-2 text-xs text-muted-foreground">
            {faltaParaDespachar === 'mensajero'
              ? 'Puedes guardarla así; para despacharla luego también hará falta un mensajero.'
              : 'Puedes guardarla así; para despacharla luego también hará falta la fecha.'}
          </p>
        )}
        <div className="col-span-2">
          <span className="duna-field__label">Notas de entrega</span>
          <input className="duna-input" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Instrucciones especiales..." />
        </div>
      </div>

      </div>

      <div className="duna-modal__foot">
        <ErrorDialogo mensaje={errorProgramar.mensaje} className="duna-modal__aviso" />
        <div className="duna-modal__acciones">
          <button type="button" className="duna-btn duna-btn--ghost" onClick={intentarCerrar} disabled={saving}>Cancelar</button>
          <button type="button" className="duna-btn duna-btn--primary" onClick={handleSchedule} disabled={saving || !!problema}>
            {saving ? 'Guardando...' : isReschedule ? 'Reprogramar' : 'Guardar entrega'}
          </button>
        </div>
        {/* Sin cambios NO lleva mensaje: el botón deshabilitado ya lo dice y no se
            tocó nada. La validez (falta de dirección) se conserva en su propio
            aviso ámbar de arriba; esta ranura no reserva alto vacía. */}
      </div>
    </>
  );
}

// Inline add-address form — same fields the checkout uses. Saves to the ORDER
// (validated server-side to the same standard as checkout).
function AddressForm({ orderId, initialPhone, onCancel, onSaved }: {
  orderId: string;
  initialPhone: string | null;
  onCancel: () => void;
  onSaved: (result: OrderAddressResult) => void;
}) {
  const [direccion, setDireccion]       = useState('');
  const [detalle, setDetalle]           = useState('');
  const [ciudad, setCiudad]             = useState('');
  const [departamento, setDepartamento] = useState('');
  // Pre-fill the phone from the resolved order/customer phone (strip +57).
  const [tel, setTel]                   = useState((initialPhone ?? '').replace(/^\+?57/, ''));
  const [saving, setSaving]             = useState(false);

  const digits     = tel.replace(/\D/g, '');
  const phoneValid = /^3\d{9}$/.test(digits);
  const canSave    = !!direccion.trim() && !!ciudad.trim() && !!departamento && phoneValid;

  const guardaDireccion = useAccionGuardada();
  const errorDireccion  = useErrorDialogo();
  const handleSave = () => guardaDireccion.ejecutar(async () => {
    errorDireccion.limpiar();
    setSaving(true);
    try {
      const result = await updateOrderAddress(orderId, {
        direccion:         direccion.trim(),
        direccion_detalle: detalle.trim() || null,
        ciudad:            ciudad.trim(),
        departamento,
        telefono:          `+57${digits}`,  // normalize like checkout
      });
      toast.success('Dirección agregada a la orden');
      onSaved(result);
    } catch (e) {
      errorDireccion.mostrar(e, 'Error al guardar la dirección');
    }
    setSaving(false);
  });

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Agregar dirección de entrega</p>
      <div>
        <span className="duna-field__label">Dirección *</span>
        <input className="duna-input" value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Calle, Carrera, número" />
      </div>
      <div>
        <span className="duna-field__label">Detalles adicionales</span>
        <input className="duna-input" value={detalle} onChange={e => setDetalle(e.target.value)} placeholder="Apto, torre, interior, indicaciones…" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="duna-field__label">Ciudad / Municipio *</span>
          <input className="duna-input" value={ciudad} onChange={e => setCiudad(e.target.value)} />
        </div>
        <div>
          <span className="duna-field__label">Departamento *</span>
          <select className="duna-input duna-select" value={departamento} required aria-label="Departamento"
                  onChange={e => setDepartamento(e.target.value)}>
            <option value="" disabled hidden>Selecciona</option>
            {COLOMBIA_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>
      <div>
        <span className="duna-field__label">Teléfono *</span>
        <input className="duna-input"
          type="tel" inputMode="numeric" value={tel}
          onChange={e => setTel(e.target.value)} placeholder="300 000 0000"
          aria-invalid={(tel.trim() && !phoneValid) || undefined}
          aria-describedby={tel.trim() && !phoneValid ? 'sd-tel-err' : undefined}
        />
        {tel.trim() && !phoneValid && (
          <p className="duna-field__error" id="sd-tel-err">Celular colombiano inválido (10 dígitos, empieza por 3).</p>
        )}
      </div>
      <div className="flex items-center justify-end gap-2">
        <ErrorDialogo mensaje={errorDireccion.mensaje} />
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>Cancelar</Button>
        <Button size="sm" onClick={handleSave} disabled={!canSave || saving}>
          {saving ? 'Guardando…' : 'Guardar dirección'}
        </Button>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}
