'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { DunaSheet } from '@/components/admin/DunaSheet';
import { toast } from 'sonner';
import { ErrorDialogo, useErrorDialogo } from '@/components/admin/ErrorDialogo';
import { useAccionGuardada } from '@/hooks/useAccionGuardada';
import { useDescarteDeDrawer } from '@/hooks/useDescarteDeDrawer';
import { ConfirmDescartarDialog } from '@/components/admin/ConfirmDescartarDialog';
import { formatCOP } from '@duna/core/utils';
import { zonedDayKey, BUSINESS_TZ } from '@duna/core/timezone';
import { registerOrderPayment } from '@/lib/api/payments';
import { subirComprobante, decidirComprobante } from '@/lib/api/comprobantes';
import { SelectorComprobante, AyudaComprobante, ComprobanteEnVerificacion } from '@/components/admin/Comprobantes';
import { DateField } from '@/components/admin/DateField';
import { formatearTamano } from '@/lib/comprobante';
import type { Comprobante } from '@/types/comprobante';
import type { Order } from '@/types/order';
import type { Payment, MetodoPago } from '@/types/payment';
import { METODOS_PAGO, METODO_PAGO_LABEL } from '@/types/payment';

// Registrar pago desde una orden. Cliente y monto son de SOLO LECTURA (vienen de
// la orden, no se digitan); el admin elige método y opcionalmente referencia y
// notas. El monto real se snapshotea server-side desde order.total.
export interface RegisterPaymentTarget {
  id:      string;
  numero:  string;
  cliente: string | null;
  monto:   number;
}

// Preselect the payment method from the order's declared method when it maps to
// an enum value (nequi → NEQUI); otherwise default to Nequi (the common case).
function defaultMetodo(declared?: string | null): MetodoPago {
  const up = (declared ?? '').toUpperCase();
  return (METODOS_PAGO as string[]).includes(up) ? (up as MetodoPago) : 'NEQUI';
}

export function RegisterPaymentModal({ target, declaredMetodo, verificando, onClose, onSaved }: {
  target: RegisterPaymentTarget | null;
  declaredMetodo?: string | null;
  /**
   * El modal es CONSCIENTE de por dónde entró.
   *
   * Con un comprobante acá, se llegó por "Verificar": el soporte ya existe y lo
   * que falta es la plata (§3.1 — la verificación crea el pago, no al revés). Se
   * muestra CUÁL se está verificando y **se oculta el campo Adjuntar**: ofrecer
   * adjuntar otro en ese momento invita a subir un segundo soporte de la misma
   * plata, y deja al operador decidiendo algo que no tiene que decidir.
   *
   * `null`/ausente = se entró directo por "Registrar pago", y el adjunto
   * opcional se ofrece como siempre.
   */
  verificando?: Comprobante | null;
  onClose: () => void;
  /**
   * DIRECTO trae `{ payment, order, comprobante? }` (la orden ya viene actualizada).
   * VERIFICAR trae sólo `{ comprobante }`: la orden se movió a `pagado` server-side
   * en esa misma llamada, así que quien recibe REFRESCA la orden en vez de empalmar.
   */
  onSaved: (result: { payment?: Payment; order?: Order; comprobante?: Comprobante }) => void;
}) {
  // LA GUARDA VIVE EN EL ENVOLTORIO para cerrar la TERCERA salida: sin su enVuelo,
  // Esc/clic-fuera/Cancelar cerrarían el drawer a mitad de registrar el pago, y
  // como el submit vive en el cuerpo, cerrar lo desmonta y el error se pierde.
  const guarda = useAccionGuardada();
  const descarte = useDescarteDeDrawer({ enVuelo: guarda.enVuelo, onCerrar: onClose });
  return (
    <>
      <DunaSheet
        abierto={!!target}
        onCerrar={descarte.intentarCerrar}
        anclaje="lado"
        titulo="Registrar pago"
        descripcion="Cliente y monto vienen de la orden y no se digitan. Elige el método y, si aplica, la referencia."
      >
        <div className="duna-modal__head">
          <div className="duna-title">Registrar pago</div>
        </div>
        {target && (
          <RegisterForm
            key={target.id}
            target={target}
            declaredMetodo={declaredMetodo}
            verificando={verificando ?? null}
            guarda={guarda}
            marcarCambios={descarte.marcarCambios}
            intentarCerrar={descarte.intentarCerrar}
            onClose={onClose}
            onSaved={onSaved}
          />
        )}
      </DunaSheet>
      <ConfirmDescartarDialog abierto={descarte.confirmando} onDescartar={descarte.descartar} onSeguir={descarte.seguirEditando} />
    </>
  );
}

function RegisterForm({ target, declaredMetodo, verificando, guarda, marcarCambios, intentarCerrar, onClose, onSaved }: {
  target: RegisterPaymentTarget;
  declaredMetodo?: string | null;
  verificando: Comprobante | null;
  guarda: ReturnType<typeof useAccionGuardada>;
  marcarCambios: (hay: boolean) => void;
  /** Cerrar pasando por la guarda de descarte (Cancelar/Esc/scrim). */
  intentarCerrar: () => void;
  /** Cierre REAL, tras registrar con éxito. */
  onClose: () => void;
  onSaved: (result: { payment?: Payment; order?: Order; comprobante?: Comprobante }) => void;
}) {
  // EFECTIVO es imposible con un comprobante de por medio (§3.b): un comprobante
  // existe porque hubo transferencia. Con comprobante en el flujo, el declarado sólo
  // preselecciona si es de transferencia; si era efectivo, no hay preselección ('')
  // y el operador elige. Sin comprobante, EFECTIVO es válido y de primera clase.
  const metodoInicial: MetodoPago | '' = (() => {
    const d = defaultMetodo(declaredMetodo);
    return verificando && d === 'EFECTIVO' ? '' : d;
  })();
  const [metodo, setMetodo]         = useState<MetodoPago | ''>(metodoInicial);
  const [referencia, setReferencia] = useState('');
  const [notas, setNotas]           = useState('');
  const [saving, setSaving]         = useState(false);
  // La fecha en que ENTRÓ la plata (no la de hoy por defecto sin pensar). Clave de
  // día; el server la ancla a Bogotá. Default hoy, tope hoy (una fecha futura afirma
  // una plata que aún no entró — guarda también en el server).
  const hoy = zonedDayKey(new Date(), BUSINESS_TZ);
  const [fecha, setFecha]           = useState(hoy);
  // Soporte OPCIONAL (sólo en el flujo directo). Se elige acá y se sube DESPUÉS del
  // pago: el comprobante es evidencia sobre una plata que primero tiene que existir.
  const [archivo, setArchivo]       = useState<File | null>(null);

  // Con un comprobante en el flujo —el de "Verificar", o uno adjuntado acá— EFECTIVO
  // sale de las opciones. Reactivo: si se adjunta un archivo y el método era efectivo,
  // se limpia para forzar una elección válida.
  const hayComprobante = !!verificando || !!archivo;
  const opcionesMetodo = hayComprobante ? METODOS_PAGO.filter(m => m !== 'EFECTIVO') : METODOS_PAGO;

  // ¿Hay algo que descartar al cerrar? Método distinto del sugerido, referencia o
  // notas escritas, o un soporte adjunto. (Registrar pago no lleva guarda de
  // "sin cambios" en el botón —siempre hace algo—, pero cerrarlo a medias sí
  // debe preguntar.)
  useEffect(() => {
    marcarCambios(
      metodo !== metodoInicial || fecha !== hoy || referencia.trim() !== '' || notas.trim() !== '' || archivo !== null,
    );
  }, [metodo, metodoInicial, fecha, hoy, referencia, notas, archivo, marcarCambios]);

  // La guarda de doble-submit la aporta el ENVOLTORIO (para poder gatear el
  // cierre). Su mitad síncrona sigue siendo la única que corta dos clicks del
  // mismo tick — y ahora importa el doble, porque el camino de Verificar MUEVE
  // DINERO en una sola llamada. El server además es idempotente (SELECT … FOR
  // UPDATE + chequeo de estado → 409/sellar al segundo), pero la guarda es del botón.
  const error  = useErrorDialogo();
  const handleSave = () => guarda.ejecutar(async () => {
    error.limpiar();
    if (metodo === '') { error.mostrar(new Error('Elige el método de pago.'), 'Falta el método'); return; }
    setSaving(true);
    try {
      if (verificando) {
        // COLAPSADO A UNA SOLA LLAMADA: verificar el comprobante CREA el Payment y
        // pasa la orden a `pagado` server-side (§ Decisión). No hay pago-y-luego-
        // sello en dos requests. Devuelve el comprobante; la orden la refresca quien
        // recibe (`onSaved` sin `order` → refetch).
        const sellado = await decidirComprobante(verificando.id, 'verificar', {
          metodo, fecha, referencia: referencia.trim() || null,
        });
        onSaved({ comprobante: sellado });
        toast.success('Pago registrado — comprobante verificado');
        onClose();
        setSaving(false);
        return;
      }

      // DIRECTO: registrar el pago. El monto lo snapshotea el server.
      const result = await registerOrderPayment(target.id, {
        metodo,
        fecha,
        referencia: referencia.trim() || undefined,
        notas:      notas.trim() || undefined,
      });

      // PRIMERO la plata, DESPUÉS la evidencia. Si la subida falla, el pago YA quedó
      // registrado y se avisa; el operador lo adjunta desde el detalle. Y el adjunto
      // NACE VERIFICADO: adjuntar acá documenta un pago que el operador YA afirmó, así
      // que se sella tras subirlo (la orden ya está pagada → verificar cae en 'sellar',
      // sin segundo Payment). Si el sello falla, queda RECIBIDO — no peor que antes.
      let comprobante: Comprobante | undefined;
      if (archivo) {
        try {
          const subido = await subirComprobante(target.id, archivo);
          try { comprobante = await decidirComprobante(subido.id, 'verificar'); }
          catch { comprobante = subido; }
        } catch (e) {
          toast.error(
            e instanceof Error ? e.message : 'No se pudo subir el comprobante',
            { description: 'El pago SÍ quedó registrado. Adjunta el soporte desde el detalle de la orden.' },
          );
        }
      }

      onSaved({ payment: result.payment, order: result.order, comprobante });
      toast.success(
        'Pago registrado — orden marcada como pagada',
        comprobante ? { description: 'Comprobante verificado.' } : undefined,
      );
      onClose();
    } catch (e) {
      error.mostrar(e, verificando ? 'No se pudo verificar el comprobante' : 'Error al registrar el pago');
    }
    setSaving(false);
  });

  return (
    <>
      <div className="duna-modal__body space-y-4">
      {/* Read-only — pulled from the order, never re-typed by the operator */}
      <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3">
        <InfoRow label="Orden"   value={target.numero} />
        <InfoRow label="Cliente" value={target.cliente ?? '—'} />
        <div className="col-span-2">
          <InfoRow label="Monto a registrar" value={formatCOP(target.monto)} strong />
        </div>
      </div>

      {/* Operator fills only these */}
      <div className="space-y-4">
        <div>
          <span className="duna-field__label">Método de pago *</span>
          <select className="duna-input duna-select" id="rp-metodo" value={metodo}
                  aria-invalid={metodo === '' || undefined}
                  onChange={e => setMetodo(e.target.value as MetodoPago)}>
            {/* Placeholder sólo cuando no hay preselección (declarado efectivo con
                comprobante): no elegir NO es válido, así que va disabled+hidden. */}
            {metodo === '' && <option value="" disabled hidden>Elige el método</option>}
            {opcionesMetodo.map(m => <option key={m} value={m}>{METODO_PAGO_LABEL[m]}</option>)}
          </select>
          {hayComprobante && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Un comprobante implica transferencia — el efectivo no aparece.
            </p>
          )}
        </div>
        <div>
          <label className="duna-field__label" htmlFor="rp-fecha">Fecha en que entró el pago</label>
          <DateField id="rp-fecha" value={fecha} onChange={setFecha} maxDia={hoy} />
          <p className="mt-1 text-[11px] text-muted-foreground">
            La fecha de la transferencia, no la de hoy.
          </p>
        </div>
        <div>
          <span className="duna-field__label">Referencia / Comprobante</span>
          <input className="duna-input"
            value={referencia}
            onChange={e => setReferencia(e.target.value)}
            placeholder="Número de transacción (opcional)"
          />
        </div>
        <div>
          <span className="duna-field__label">Notas</span>
          <input className="duna-input"
            value={notas}
            onChange={e => setNotas(e.target.value)}
            placeholder="Opcional"
          />
        </div>

        {/* DOS PUERTAS, dos renders. Por "Verificar" el soporte ya existe: se
            muestra cuál y no se ofrece adjuntar. Directo, el adjunto opcional. */}
        {verificando ? (
          <div>
            <span className="duna-field__label">Comprobante</span>
            <div className="mt-1">
              <ComprobanteEnVerificacion comprobante={verificando} />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Al registrar el pago, este comprobante queda verificado con tu nombre y la fecha.
            </p>
          </div>
        ) : (
        <div>
          <span className="duna-field__label">Comprobante</span>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {archivo ? (
              <span className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs">
                <span className="max-w-[12rem] truncate font-medium">{archivo.name}</span>
                <span className="shrink-0 text-muted-foreground">{formatearTamano(archivo.size)}</span>
                <button
                  type="button"
                  onClick={() => setArchivo(null)}
                  disabled={saving}
                  aria-label="Quitar comprobante"
                  className="shrink-0 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-40"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ) : (
              <SelectorComprobante
                onArchivo={(f) => { setArchivo(f); if (metodo === 'EFECTIVO') setMetodo(''); }}
                disabled={saving} label="Adjuntar" />
            )}
            <AyudaComprobante />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Opcional. Se sube después de registrar el pago.
          </p>
        </div>
        )}
      </div>

      </div>

      {/* El error comparte la fila de los botones: ocupa el espacio libre de la
          izquierda, así que aparecer no los mueve. La ranura del sistema decide
          cuándo baja a su renglón en vez de aplastarse. */}
      <div className="duna-modal__foot">
        <ErrorDialogo mensaje={error.mensaje} className="duna-modal__aviso" />
        <div className="duna-modal__acciones">
          <button type="button" className="duna-btn duna-btn--ghost" onClick={intentarCerrar} disabled={saving}>Cancelar</button>
          <button type="button" className="duna-btn duna-btn--primary" onClick={handleSave} disabled={saving || metodo === ''}>
            {saving ? (verificando ? 'Verificando...' : 'Registrando...') : (verificando ? 'Verificar y registrar pago' : 'Registrar pago')}
          </button>
        </div>
      </div>
    </>
  );
}

function InfoRow({ label, value, strong }: { label: string; value?: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-medium ${strong ? 'text-base font-bold' : ''}`}>{value}</p>
    </div>
  );
}
