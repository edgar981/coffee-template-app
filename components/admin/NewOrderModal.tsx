'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DunaSheet } from '@/components/admin/DunaSheet';
import { toast } from 'sonner';
import { useAccionGuardada } from '@/hooks/useAccionGuardada';
import { ErrorDialogo, useErrorDialogo } from '@/components/admin/ErrorDialogo';
import { createOrder } from '@/lib/api/orders';
import { getCatalog } from '@/lib/api/products';
import { lookupCustomers, type CustomerMatch } from '@/lib/api/customers';
import { problemaDeNuevaOrden, lineasConProducto } from '@/lib/pedidos/nueva-orden';
import { formatCOP } from '@duna/core/utils';
import { COLOMBIA_DEPARTMENTS } from '@duna/core/colombia-departments';
import { METODOS_PAGO, METODO_PAGO_LABEL } from '@/types/payment';
import { CANALES as CANAL_LABEL } from '@/constants/customer';
import type { Order, OrderForm, OrderLineForm, OrderChannel } from '@/types/order';
import type { Product } from '@/types/product';

// ─── CREAR UN PEDIDO A MANO ──────────────────────────────────────────────────
//
// Vivía EMBEBIDO en `app/(admin)/admin/ordenes/page.tsx`: cuatro constantes,
// doce piezas de estado, catorce handlers y ~295 líneas de JSX, nada exportado.
// Sale acá por el mismo motivo que `useControlComprobantes` y que
// `ScheduleDeliveryModal`: la segunda pantalla que opera pedidos lo necesita, y
// la alternativa era una segunda implementación del mismo flujo — que es cómo
// este repo ya pagó tres divergencias (`razonDelServidor`, `cruzoMinimo`, el
// "Confirmado" fósil).
//
// El movimiento es MECÁNICO salvo dos cosas, y las dos están dichas donde pasan:
// el cuerpo se desmonta al cerrar (para que el formulario nazca limpio sin un
// efecto que lo resetee), y la validación ahora sale de la regla pura compartida.
//
// El chrome es shadcn, reusado tal cual: el design-system no tiene primitiva de
// diálogo y construirla ahora dejaría dos implementaciones conviviendo hasta que
// las pantallas viejas mueran (H6).

const CANALES: OrderChannel[] = ['whatsapp', 'instagram', 'directo', 'referido'];

// Radix Select prohíbe `value=""`, así que los dos "sin valor" necesitan un
// centinela. Se traducen a '' al escribir en el formulario.
const POR_DEFINIR = '__por_definir__';
const NINGUN_DEPARTAMENTO = '__ninguno__';

const EMPTY_FORM: OrderForm = {
  cliente_nombre:    '',
  cliente_email:     '',
  cliente_telefono:  '',
  canal:             'whatsapp',
  costo_envio:       '0',
  direccion_entrega: '',
  ciudad_entrega:    '',
  departamento:      '',
  notas_internas:    '',
  items:             [{ slug: '', cantidad: 1, molienda: '' }],
  metodoPagoPrevisto: '',
  pagoRecibido:       false,
};

export interface NewOrderModalProps {
  open: boolean;
  onClose: () => void;
  /** El pedido recién creado. Quien lo monta decide qué hacer con él. */
  onCreated: (order: Order) => void;
}

export function NewOrderModal({ open, onClose, onCreated }: NewOrderModalProps) {
  // El catálogo vive en el COMPONENTE EXTERNO, que está siempre montado, y no en
  // el cuerpo: así se pide una sola vez al cargar la página —igual que antes de
  // la extracción— y no en cada apertura del diálogo.
  const [catalog, setCatalog] = useState<Product[]>([]);
  useEffect(() => { getCatalog().then(setCatalog).catch(() => setCatalog([])); }, []);

  return (
    <DunaSheet
      abierto={open}
      onCerrar={onClose}
      anclaje="lado"
      titulo="Nuevo pedido"
      descripcion="Crea un pedido manual: cliente, productos, costo de envío y método de pago previsto."
    >
      <div className="duna-modal__head">
        <div className="duna-title">Nuevo pedido</div>
      </div>
        {/* EL CUERPO SÓLO EXISTE MIENTRAS EL DIÁLOGO ESTÁ ABIERTO, y eso es lo que
            hace que el formulario nazca limpio —form vacío, sin decisión de
            cliente, con clave de idempotencia nueva— sin un efecto que lo
            resetee. Es el patrón que ya usan `CustomerFormModal` y el editar de
            Clientes. Antes de la extracción lo hacía `openNewOrder()`, que había
            que acordarse de llamar desde cada botón que abría el diálogo. */}
      {open && <Cuerpo catalog={catalog} onClose={onClose} onCreated={onCreated} />}
    </DunaSheet>
  );
}

function Cuerpo({ catalog, onClose, onCreated }: {
  catalog: Product[];
  onClose: () => void;
  onCreated: (order: Order) => void;
}) {
  const [form, setForm] = useState<OrderForm>(EMPTY_FORM);

  // UNA clave de idempotencia por formulario abierto. Resuelve algo distinto de
  // la guarda de doble-submit: la guarda evita el segundo click, y la clave cubre
  // el caso en que el click no fue el problema (un reintento de red, un submit
  // que falló y se repite). El servidor dedupea por ella.
  const idemKeyRef = useRef<string>('');

  // Detección proactiva de cliente duplicado. `matches` son los clientes que
  // estos datos empatarían (un teléfono puede ser compartido → varios) y
  // `decision` es la elección EXPLÍCITA del operador.
  const [matches, setMatches]   = useState<CustomerMatch[]>([]);
  const [decision, setDecision] = useState<{ tipo: 'usar'; clienteId: string } | { tipo: 'nuevo' } | null>(null);
  const [gateBlocked, setGateBlocked] = useState(false);
  const [gatePulse, setGatePulse]     = useState(false);
  const bannerRef      = useRef<HTMLDivElement | null>(null);
  const firstActionRef = useRef<HTMLButtonElement | null>(null);

  const guarda = useAccionGuardada();
  const error  = useErrorDialogo();

  const resetDeteccion = () => { setMatches([]); setDecision(null); setGateBlocked(false); setGatePulse(false); };

  // Read-only y nunca bloquea. Se salta una vez que hay decisión tomada.
  const detectCustomer = async () => {
    if (decision) return;
    setMatches(await lookupCustomers({
      telefono: form.cliente_telefono || undefined,
      email:    form.cliente_email || undefined,
    }));
  };

  // Adoptar un match: el pedido viaja con su `cliente_id` (sin upsert) y su
  // nombre llena el formulario.
  const chooseUsar = (m: CustomerMatch) => {
    setDecision({ tipo: 'usar', clienteId: m.id });
    setForm(f => ({ ...f, cliente_nombre: m.nombre }));
    setGateBlocked(false); setGatePulse(false);
  };

  // Duplicado CONSCIENTE: `forzarClienteNuevo` es una decisión que el servidor
  // honra, para que el upsert no pueda re-empatar en silencio. Los teléfonos
  // compartidos son legales (§ matching de clientes).
  const chooseNuevo = () => {
    setDecision({ tipo: 'nuevo' });
    setGateBlocked(false); setGatePulse(false);
  };

  // Tocar un campo de identidad invalida la detección y la decisión: ya no
  // hablan del mismo cliente.
  const onIdentityChange = () => { if (decision || matches.length) resetDeteccion(); };

  const reduceMotion = () =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Hay matches y no hay decisión: no se envía. Se trae el banner a la vista, se
  // enfoca su primera acción y se marca el anillo. El pulso es breve y se salta
  // con `prefers-reduced-motion` (el anillo estático se queda).
  const nudgeToDecide = () => {
    setGateBlocked(true);
    bannerRef.current?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' });
    firstActionRef.current?.focus();
    if (!reduceMotion()) {
      setGatePulse(true);
      setTimeout(() => setGatePulse(false), 1200);
    }
  };

  // ── Líneas ────────────────────────────────────────────────────────────────
  const productBySlug = (slug: string) => catalog.find(p => p.slug === slug);
  /** Primera molienda disponible — espeja la selección por defecto del storefront. */
  const defaultMolienda = (slug: string) =>
    (productBySlug(slug)?.moliendasOpciones ?? []).find(o => o.disponible)?.nombre ?? '';
  const setLines = (items: OrderLineForm[]) => setForm(f => ({ ...f, items }));
  const addLine = () => setLines([...form.items, { slug: '', cantidad: 1, molienda: '' }]);
  const removeLine = (i: number) =>
    setLines(form.items.length > 1 ? form.items.filter((_, idx) => idx !== i) : form.items);
  const updateLine = (i: number, patch: Partial<OrderLineForm>) =>
    setLines(form.items.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  // Totales de PRESENTACIÓN. El servidor recalcula desde el catálogo al crear —
  // el admin nunca teclea el total.
  const itemsSubtotal = form.items.reduce((sum, l) => {
    const p = productBySlug(l.slug);
    return sum + (p ? p.precio * l.cantidad : 0);
  }, 0);
  const calcTotal = itemsSubtotal + (Number(form.costo_envio) || 0);

  // LA MISMA regla que deshabilita el botón y que explica por qué. Mientras
  // fueron dos afirmaciones, divergían (§ lib/pedidos/nueva-orden).
  const problema = problemaDeNuevaOrden(form, catalog);

  const handleSave = () => guarda.ejecutar(async () => {
    error.limpiar();
    // El botón está deshabilitado con un problema pendiente, pero la guarda va
    // igual: el submit también llega por Enter, y ahí no hay `disabled` que valga.
    if (problema) return;

    // Puerta de DECISIÓN (de experiencia, nunca de venta): hay clientes que
    // empatan y el operador no eligió. No se envía; se lo lleva al banner.
    if (matches.length > 0 && decision === null) { nudgeToDecide(); return; }

    if (!idemKeyRef.current) idemKeyRef.current = crypto.randomUUID();

    try {
      const created = await createOrder({
        cliente_nombre:    form.cliente_nombre,
        cliente_email:     form.cliente_email || undefined,
        cliente_telefono:  form.cliente_telefono || undefined,
        cliente_id:         decision?.tipo === 'usar' ? decision.clienteId : undefined,
        forzarClienteNuevo: decision?.tipo === 'nuevo' ? true : undefined,
        canal:             form.canal,
        costo_envio:       Number(form.costo_envio) || 0,
        direccion_entrega: form.direccion_entrega || undefined,
        // Opcionales: se omiten vacíos para no romper la creación rápida (el
        // servidor los valida sólo si llegan).
        ciudad_entrega:    form.ciudad_entrega || undefined,
        departamento:      form.departamento || undefined,
        notas_internas:    form.notas_internas || undefined,
        metodoPagoPrevisto: form.metodoPagoPrevisto || undefined,
        pagoRecibido:      form.pagoRecibido,
        items: lineasConProducto(form).map(l => ({
          slug: l.slug, cantidad: l.cantidad, molienda: l.molienda || null,
        })),
        idempotencyKey:    idemKeyRef.current,
      });
      onCreated(created);
      toast.success(created.estado === 'pagado' ? 'Pedido creado y pago registrado' : 'Pedido creado');
      onClose();
    } catch (e) {
      // El diálogo se queda ABIERTO con lo que el operador escribió, y el motivo
      // del servidor va INLINE — es donde está mirando (§ toast = éxito).
      error.mostrar(e, 'No se pudo crear el pedido');
    }
  });

  const field = (key: Exclude<keyof OrderForm, 'items' | 'canal' | 'metodoPagoPrevisto' | 'pagoRecibido'>) => ({
    value:    form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value })),
  });

  return (
    <>
      <div className="duna-modal__body space-y-4">
        {/* Cliente */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <span className="duna-field__label">Nombre del cliente *</span>
            <input className="duna-input" {...field('cliente_nombre')} />
          </div>
          <div>
            <span className="duna-field__label">Correo electrónico</span>
            <input className="duna-input"
              type="email"
              value={form.cliente_email}
              onChange={e => { setForm(f => ({ ...f, cliente_email: e.target.value })); onIdentityChange(); }}
              onBlur={detectCustomer}
              placeholder="Opcional"
            />
          </div>
          <div>
            <span className="duna-field__label">Teléfono</span>
            <input className="duna-input"
              value={form.cliente_telefono}
              onChange={e => { setForm(f => ({ ...f, cliente_telefono: e.target.value })); onIdentityChange(); }}
              onBlur={detectCustomer}
              placeholder="300 000 0000"
            />
          </div>
          <p className="col-span-2 -mt-1 text-xs text-muted-foreground">* Ingresa al menos un teléfono o correo del cliente.</p>

          {/* Detección proactiva de duplicado — el banner NO bloquea, pero el
              submit exige elegir. Lista TODOS los que comparten estos datos. */}
          {matches.length > 0 && !decision && (
            <div
              ref={bannerRef}
              className={`col-span-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-900/20 ${gateBlocked ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-background' : ''} ${gatePulse ? 'animate-pulse' : ''}`}
            >
              <p className="mb-2 text-amber-900 dark:text-amber-200">
                {matches.length === 1
                  ? <>Estos datos ya pertenecen a un cliente:</>
                  : <>Estos datos pertenecen a <strong>{matches.length} clientes</strong>:</>}
              </p>
              <ul className="space-y-1.5">
                {matches.map((m, i) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 rounded-md bg-background/60 px-2.5 py-1.5">
                    <span className="min-w-0 truncate">
                      <strong className="font-medium">{m.nombre}</strong>
                      <span className="text-muted-foreground"> · {m.ordenes} {m.ordenes === 1 ? 'pedido' : 'pedidos'}</span>
                    </span>
                    <Button ref={i === 0 ? firstActionRef : undefined} type="button" size="sm" className="shrink-0" onClick={() => chooseUsar(m)}>Usar</Button>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex justify-end">
                <Button type="button" size="sm" variant="ghost" onClick={chooseNuevo}>Crear cliente nuevo</Button>
              </div>
            </div>
          )}

          {decision?.tipo === 'usar' && (
            <div className="col-span-2 flex items-center justify-between gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-800 dark:bg-emerald-900/20">
              <span className="text-emerald-900 dark:text-emerald-200">
                Vinculado a <strong>{form.cliente_nombre}</strong> — el pedido se adjunta a este cliente.
              </span>
              <button type="button" onClick={() => setDecision(null)} aria-label="Cambiar decisión" className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-300">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {decision?.tipo === 'nuevo' && (
            <div className="col-span-2 flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Se creará un <strong className="text-foreground">cliente nuevo</strong> (duplicado consciente).</span>
              <button type="button" onClick={() => setDecision(null)} aria-label="Cambiar decisión" className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="duna-field col-span-2">
            <label className="duna-field__label" htmlFor="no-canal">Canal</label>
            <select className="duna-input duna-select" id="no-canal" value={form.canal}
                    onChange={e => setForm(f => ({ ...f, canal: e.target.value as OrderChannel }))}>
              {CANALES.map(c => <option key={c} value={c}>{CANAL_LABEL[c] ?? c}</option>)}
            </select>
          </div>
        </div>

        {/* Productos — líneas reales; el total lo calcula el servidor */}
        <div className="border-t border-border pt-3">
          <span className="duna-field__label">Productos *</span>
          <div className="mt-2 space-y-2">
            {form.items.map((line, i) => {
              const product = productBySlug(line.slug);
              const opciones = product?.moliendasOpciones ?? [];
              const lineSubtotal = product ? product.precio * line.cantidad : 0;
              return (
                <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg border border-border/60 bg-muted/20 p-2">
                  <div className="min-w-[180px] flex-1">
                    <span className="duna-caption">Producto</span>
                    {/* La opción vacía ES el placeholder: `disabled hidden` para
                        que no se pueda volver a elegir "nada". El label dice qué
                        es el campo; esto dice que aún no elegiste. */}
                    <select className="duna-input duna-select" style={{ marginTop: '2px' }} required
                            value={line.slug} aria-label="Producto"
                            onChange={e => updateLine(i, { slug: e.target.value, molienda: defaultMolienda(e.target.value) })}>
                      <option value="" disabled hidden>Selecciona…</option>
                      {catalog.map(p => (
                        <option key={p.slug} value={p.slug} disabled={p.disponible === false}>
                          {p.nombre}{p.disponible === false ? ' (Agotado)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-16">
                    <span className="text-xs text-muted-foreground">Cant.</span>
                    <input className="duna-input"
                      type="number" min={1}
                      value={line.cantidad}
                      onChange={e => updateLine(i, { cantidad: Math.max(1, Number(e.target.value) || 1) })}
                      style={{ marginTop: '2px' }}
                    />
                  </div>
                  {opciones.length > 0 && (
                    <div className="min-w-[130px]">
                      <span className="duna-caption">Molienda</span>
                      <select className="duna-input duna-select" style={{ marginTop: '2px' }} required
                              value={line.molienda} aria-label="Molienda"
                              onChange={e => updateLine(i, { molienda: e.target.value })}>
                        <option value="" disabled hidden>Molienda</option>
                        {opciones.map(o => (
                          <option key={o.nombre} value={o.nombre} disabled={!o.disponible}>
                            {o.nombre}{!o.disponible ? ' (Próximamente)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="ml-auto flex items-center gap-2 pb-1">
                    <span className="text-sm font-medium tabular-nums">{formatCOP(lineSubtotal)}</span>
                    <button
                      type="button"
                      onClick={() => removeLine(i)}
                      disabled={form.items.length === 1}
                      className="text-muted-foreground hover:text-destructive disabled:opacity-30"
                      aria-label="Quitar producto"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <Button variant="outline" size="sm" onClick={addLine} className="mt-2 gap-1">
            <Plus className="w-3.5 h-3.5" /> Agregar producto
          </Button>
        </div>

        {/* Envío (manual) + total calculado (solo lectura) */}
        <div className="grid grid-cols-2 gap-4 border-t border-border pt-3">
          <div>
            <span className="duna-field__label">Costo de envío</span>
            <input className="duna-input" type="number" min={0} {...field('costo_envio')} />
          </div>
          <div className="self-end space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">{formatCOP(itemsSubtotal)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Envío</span><span className="tabular-nums">{formatCOP(Number(form.costo_envio) || 0)}</span></div>
            <div className="flex justify-between border-t border-border pt-1 font-bold"><span>Total</span><span className="tabular-nums">{formatCOP(calcTotal)}</span></div>
          </div>
        </div>

        {/* Pago previsto — método DECLARADO (opcional). No cobra ni marca pagado
            por sí solo: el pedido nace pendiente. La CONDICIÓN de pago se DERIVA
            del método (Efectivo ⇒ contraentrega). El checkbox registra el pago en
            el mismo acto y exige un método que NO sea Efectivo. */}
        <div className="space-y-3 border-t border-border pt-3">
          <div className="duna-field">
            <label className="duna-field__label" htmlFor="no-metodo">Método de pago</label>
            {/* "Por definir" es una opción REAL y no el placeholder: no elegir
                método es una decisión válida acá —el pedido nace pendiente— así
                que tiene que poder re-elegirse. Por eso no va `disabled hidden`. */}
            <select className="duna-input duna-select" id="no-metodo"
                    value={form.metodoPagoPrevisto || POR_DEFINIR}
                    onChange={e => {
                      const metodo = (e.target.value === POR_DEFINIR ? '' : e.target.value) as OrderForm['metodoPagoPrevisto'];
                      setForm(f => ({ ...f, metodoPagoPrevisto: metodo, pagoRecibido: metodo && metodo !== 'EFECTIVO' ? f.pagoRecibido : false }));
                    }}>
              <option value={POR_DEFINIR}>Por definir</option>
              {METODOS_PAGO.map(m => <option key={m} value={m}>{METODO_PAGO_LABEL[m]}</option>)}
            </select>
          </div>
          {form.metodoPagoPrevisto === 'EFECTIVO' && (
            <p className="text-xs text-muted-foreground">
              Efectivo = contraentrega: el envío podrá prepararse y despacharse con el pedido pendiente; el pago se registra al entregar.
            </p>
          )}
          {/* La FILA es el control: montado como `<label>`, el texto entero
              amplía el área de toque. El estado deshabilitado lo pinta el sistema
              (`:has(:disabled)`), no una clase condicional acá. */}
          <label className="duna-check">
            <input
              type="checkbox"
              className="duna-check__box"
              checked={form.pagoRecibido}
              disabled={!form.metodoPagoPrevisto || form.metodoPagoPrevisto === 'EFECTIVO'}
              onChange={e => setForm(f => ({ ...f, pagoRecibido: e.target.checked }))}
            />
            <span>
              El pago ya fue recibido
              {!form.metodoPagoPrevisto && (
                <span className="block text-xs text-muted-foreground">
                  Selecciona un método de pago para poder marcarlo.
                </span>
              )}
              {form.metodoPagoPrevisto === 'EFECTIVO' && (
                <span className="block text-xs text-muted-foreground">
                  No aplica en efectivo (contraentrega) — el pago se registra al entregar.
                </span>
              )}
            </span>
          </label>
        </div>

        {/* Dirección + notas */}
        <div className="space-y-4 border-t border-border pt-3">
          <div>
            <span className="duna-field__label">Dirección de entrega</span>
            <input className="duna-input" {...field('direccion_entrega')} />
          </div>
          {/* Ciudad y departamento OPCIONALES — el pedido manual se sigue creando
              sin ellos. La ciudad no es decorativa: sin ella el modal de
              "Programar entrega" no puede sugerir zona. */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="duna-field__label">Ciudad / municipio</span>
              <input className="duna-input" {...field('ciudad_entrega')} placeholder="Opcional" />
            </div>
            <div>
              <label className="duna-field__label" htmlFor="no-depto">Departamento</label>
              <select className="duna-input duna-select" id="no-depto"
                      value={form.departamento || NINGUN_DEPARTAMENTO}
                      onChange={e => setForm(f => ({ ...f, departamento: e.target.value === NINGUN_DEPARTAMENTO ? '' : e.target.value }))}>
                <option value={NINGUN_DEPARTAMENTO}>Sin especificar</option>
                {COLOMBIA_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          {form.ciudad_entrega.trim() === '' && form.direccion_entrega.trim() !== '' && (
            <p className="text-xs text-muted-foreground">
              Sin ciudad no se podrá sugerir la zona al programar la entrega.
            </p>
          )}
          <div>
            <span className="duna-field__label">Notas internas</span>
            <textarea {...field('notas_internas')} className="duna-input" rows={3} />
          </div>
        </div>
      </div>

      {/* LOS AVISOS DE GATE VAN EN EL PIE, no flotando entre el formulario y los
          botones: el pie es lo único que queda quieto mientras el cuerpo
          scrollea, y un motivo que explica por qué el botón está apagado tiene
          que verse DONDE está el botón. `flex-wrap` del sistema los deja en su
          propio renglón cuando no caben. */
      }
      <div className="duna-modal__foot">
        {gateBlocked && (
          <p className="duna-caption" style={{ flexBasis: '100%', margin: 0, color: 'var(--duna-sol-ink)' }}>
            Elige el cliente antes de crear el pedido.
          </p>
        )}
        {/* EL BOTÓN DESHABILITADO DICE QUÉ FALTA. Es la única forma en que este
            repo admite un control deshabilitado (§ "Marcar en ruta" sin
            mensajero): esconder el motivo obliga a adivinar cuál de los campos
            es. Sale de la MISMA regla que apaga el botón, así que no pueden
            discrepar — antes eran dos afirmaciones y ya divergían. */}
        {problema && !gateBlocked && (
          <p className="duna-caption" style={{ flexBasis: '100%', margin: 0 }}>{problema.mensaje}</p>
        )}
        <ErrorDialogo mensaje={error.mensaje} className="duna-modal__aviso" />
        <div className="duna-modal__acciones">
          <button type="button" className="duna-btn duna-btn--ghost" onClick={onClose} disabled={guarda.enVuelo}>Cancelar</button>
          <button type="button" className="duna-btn duna-btn--primary" onClick={handleSave} disabled={guarda.enVuelo || !!problema}>
            {guarda.enVuelo ? 'Creando…' : 'Crear pedido'}
          </button>
        </div>
      </div>
    </>
  );
}
