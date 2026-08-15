'use client';

import { useState } from 'react';
import { DunaSheet } from '@/components/admin/DunaSheet';
import { useAccionGuardada } from '@/hooks/useAccionGuardada';
import { ErrorDialogo, useErrorDialogo } from '@/components/admin/ErrorDialogo';
import { adjustInventory } from '@/lib/api/inventory';
import type { Product } from '@/types/product';
import type { InventoryLog, InventoryAdjustmentForm, InventoryMovementType } from '@/types/inventory';

// ═══ AJUSTAR STOCK · UN modal, invocable desde las dos pantallas ═════════════
//
// Vivía inline en `/admin/inventario`. Se extrae por la frontera que el owner
// aprobó: Productos responde "¿cómo está ESTE producto?" —y para eso su detalle
// tiene que poder ajustar— mientras Inventario responde "¿qué repongo?" y
// conserva el suyo. Dos pantallas, una operación, un modal.
//
// El precedente es `ScheduleDeliveryModal`, que ya es agnóstico de página entre
// Pedidos y Entregas, y trae su consecuencia: **Inventario queda idéntico en
// aspecto y conducta — sólo cambia de dónde sale su lógica— y por eso su
// REGRESIÓN entra al mismo checklist que lo nuevo.**
//
// ── LAS DOS PUERTAS DE ENTRADA, Y NO SON LA MISMA CONVERSACIÓN ──────────────
//
// Con `producto`: el producto YA está decidido y se muestra como CONTEXTO, sin
// selector. Ofrecer un selector ahí invitaría a ajustar OTRO producto desde una
// pantalla que trata de éste — y el error sería silencioso, porque el toast diría
// "inventario actualizado" igual. Es el mismo criterio con el que Registrar Pago
// oculta el adjunto cuando entra por "Verificar".
//
// Con `productos`: la lista para elegir, que es como entra desde Inventario.
//
// ── LA GUARDA NO ES OPCIONAL ACÁ ────────────────────────────────────────────
//
// `entrada`, `salida` y `devolucion` son DELTA: un doble-submit suma dos veces y
// el kardex registra dos movimientos donde hubo uno. Que `ajuste` sea idempotente
// —fija un valor absoluto— no exime al botón (§ Doble-submit). Las dos mitades
// salen del hook: el ref síncrono corta la re-entrada del mismo tick y el estado
// le pone texto intermedio al botón.

const VACIO: InventoryAdjustmentForm = { producto_id: '', tipo: 'ajuste', cantidad: '', motivo: '' };

/** Los cuatro que el operador puede registrar a mano. `venta` no está: la escribe
 *  el despacho, y ofrecerla acá sería una segunda puerta a un asiento que el
 *  sistema ya produce solo. */
const TIPOS: { value: InventoryMovementType; label: string }[] = [
  { value: 'entrada',    label: 'Entrada (sumar)' },
  { value: 'salida',     label: 'Salida (restar)' },
  { value: 'ajuste',     label: 'Ajuste (fijar cantidad)' },
  { value: 'devolucion', label: 'Devolución' },
];

export function AdjustStockModal({ open, producto, productos, onOpenChange, onAplicado }: {
  open: boolean;
  /** Entrada desde un PRODUCTO: fijo, sin selector. */
  producto?: Product | null;
  /** Entrada desde INVENTARIO: la lista para elegir. */
  productos?: Product[];
  onOpenChange: (o: boolean) => void;
  onAplicado: (r: { product: Product; log: InventoryLog }) => void;
}) {
  // LA GUARDA VIVE EN EL ENVOLTORIO, no en el cuerpo, y no es cosmético: desde
  // acá puede cerrar la TERCERA salida. `DunaSheet` delega el cierre al
  // consumidor, así que sin este gate el Esc y el clic-fuera cierran el drawer a
  // mitad de la mutación — y cerrar no cancela nada en el server, deja al operador
  // sin saber si se aplicó, y desmonta el sitio donde el error iba a aparecer.
  // Es lo mismo que hace `ConfirmDeleteDialog` con su `if (loading) return`.
  const guarda = useAccionGuardada();
  return (
    <DunaSheet
      abierto={open}
      onCerrar={() => { if (!guarda.enVuelo) onOpenChange(false); }}
      anclaje="lado"
      titulo="Ajustar inventario"
      descripcion="Registra un movimiento de stock: entrada, salida, devolución o ajuste a un valor absoluto. Queda asentado en el kardex del producto."
    >
      <div className="duna-modal__head">
        <div className="duna-title">Ajustar inventario</div>
      </div>
      {/* El cuerpo sólo existe mientras está abierto: se re-siembra en cada
          apertura sin un solo efecto, y el error inline se limpia solo al cerrar. */}
      {open && (
        <Cuerpo
          producto={producto ?? null}
          productos={productos ?? []}
          guarda={guarda}
          onClose={() => onOpenChange(false)}
          onAplicado={onAplicado}
        />
      )}
    </DunaSheet>
  );
}

function Cuerpo({ producto, productos, guarda, onClose, onAplicado }: {
  producto: Product | null;
  productos: Product[];
  guarda: ReturnType<typeof useAccionGuardada>;
  onClose: () => void;
  onAplicado: (r: { product: Product; log: InventoryLog }) => void;
}) {
  const [form, setForm] = useState<InventoryAdjustmentForm>(
    () => producto ? { ...VACIO, producto_id: producto.id } : VACIO,
  );
  const error = useErrorDialogo();

  // El producto sobre el que se va a escribir: el fijo, o el elegido en la lista.
  const objetivo = producto ?? productos.find(p => p.id === form.producto_id) ?? null;

  const aplicar = () => guarda.ejecutar(async () => {
    // Se limpia al REINTENTAR, no sólo al cerrar: un error que sobrevive a un
    // reintento exitoso afirma un fallo que ya no existe.
    error.limpiar();
    if (!form.producto_id || !form.cantidad) return;
    try {
      onAplicado(await adjustInventory(form));
      // Cierre SÓLO tras confirmación del servidor. Si falla, el drawer se queda
      // abierto con lo que el operador escribió y el motivo a la vista — que es
      // donde el 409 de "Stock insuficiente para esta salida" tiene que aparecer.
      onClose();
    } catch (e) {
      error.mostrar(e, 'No se pudo ajustar el inventario');
    }
  });

  const bloqueado = guarda.enVuelo;

  return (
    <>
      <div className="duna-modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-4)' }}>
        {/* ── El producto · CONTEXTO cuando viene fijo, SELECTOR cuando no ── */}
        {producto ? (
          <div className="duna-field">
            <span className="duna-field__label">Producto</span>
            {/* Contexto y no un campo deshabilitado: un control apagado invita a
                preguntarse cómo encenderlo. Acá no hay nada que decidir. */}
            <div className="duna-body-sm" style={{ color: 'var(--duna-ink)' }}>
              {producto.nombre}
              {producto.sku && <span className="duna-mono" style={{ marginLeft: 'var(--duna-space-2)' }}>{producto.sku}</span>}
            </div>
          </div>
        ) : (
          <div className="duna-field">
            <label className="duna-field__label" htmlFor="aj-producto">Producto</label>
            <select className="duna-input duna-select" id="aj-producto" value={form.producto_id} disabled={bloqueado}
                    onChange={e => setForm(f => ({ ...f, producto_id: e.target.value }))}>
              {/* `disabled hidden`: no elegir producto no es una respuesta válida. */}
              <option value="" disabled hidden>Seleccionar producto</option>
              {productos.map(p => (
                <option key={p.id} value={p.id}>{p.nombre} (stock: {p.stock})</option>
              ))}
            </select>
          </div>
        )}

        {/* EL STOCK ACTUAL, A LA VISTA. Es el dato contra el que el operador
            decide la cantidad —sobre todo con `ajuste`, que FIJA el valor en vez
            de moverlo— y tenerlo que recordar de la pantalla de atrás es cómo se
            teclea el número equivocado. */}
        {objetivo && (
          <div className="duna-note">
            Stock actual: <span className="duna-num" style={{ fontWeight: 'var(--duna-w-semi)' }}>{objetivo.stock}</span>
          </div>
        )}

        <div className="duna-field">
          <label className="duna-field__label" htmlFor="aj-tipo">Tipo de movimiento</label>
          <select className="duna-input duna-select" id="aj-tipo" value={form.tipo} disabled={bloqueado}
                  onChange={e => setForm(f => ({ ...f, tipo: e.target.value as InventoryMovementType }))}
                  aria-describedby="aj-tipo-hint">
            {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          {/* La diferencia que más cuesta si se ignora: `ajuste` no suma ni resta. */}
          <p className="duna-field__hint" id="aj-tipo-hint">
            {form.tipo === 'ajuste'
              ? 'Fija el stock en la cantidad que escribas — no la suma ni la resta.'
              : form.tipo === 'salida'
                ? 'Resta del stock actual.'
                : 'Suma al stock actual.'}
          </p>
        </div>

        <div className="duna-field">
          <label className="duna-field__label" htmlFor="aj-cantidad">Cantidad</label>
          <input className="duna-input" id="aj-cantidad" type="number" min={0} value={form.cantidad} disabled={bloqueado}
                 onChange={e => setForm(f => ({ ...f, cantidad: e.target.value }))} />
        </div>

        <div className="duna-field">
          <label className="duna-field__label" htmlFor="aj-motivo">Motivo</label>
          <input className="duna-input" id="aj-motivo" value={form.motivo} disabled={bloqueado}
                 onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))}
                 placeholder="Ej: Compra a proveedor" />
        </div>
      </div>

      <div className="duna-modal__foot">
        <ErrorDialogo mensaje={error.mensaje} className="duna-modal__aviso" />
        <div className="duna-modal__acciones">
          {/* Cancelar también se bloquea en vuelo: cerrar a mitad no cancela nada
              en el server y deja al operador sin saber si se aplicó. */}
          <button type="button" className="duna-btn duna-btn--ghost" onClick={onClose} disabled={bloqueado}>
            Cancelar
          </button>
          <button type="button" className="duna-btn duna-btn--primary" onClick={aplicar}
                  disabled={bloqueado || !form.producto_id || !form.cantidad}>
            {bloqueado ? 'Aplicando…' : 'Aplicar'}
          </button>
        </div>
      </div>
    </>
  );
}
