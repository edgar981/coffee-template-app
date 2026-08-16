'use client';

import { useEffect, useMemo, useState } from 'react';
import { DunaSheet } from '@/components/admin/DunaSheet';
import { useAccionGuardada } from '@/hooks/useAccionGuardada';
import { useDescarteDeDrawer } from '@/hooks/useDescarteDeDrawer';
import { ConfirmDescartarDialog } from '@/components/admin/ConfirmDescartarDialog';
import { ErrorDialogo, useErrorDialogo } from '@/components/admin/ErrorDialogo';
import { createCustomer, updateCustomer } from '@/lib/api/customers';
import { problemaGuardarCliente, hayCambiosCliente } from '@/lib/clientes/guardar';
import { CANALES, EMPTY_CUSTOMER_FORM } from '@/constants/customer';
import type { Customer, CustomerForm } from '@/types/customer';
import type { OrderChannel } from '@/types/order';

// ─── ALTA Y EDICIÓN DE CLIENTE ───────────────────────────────────────────────
//
// DRAWER de Duna (H6). La superficie, la cabecera y el pie salen del
// design-system; el foco atrapado, Escape, click-fuera y el bloqueo de scroll los
// pone Radix a través de `DunaSheet`.
//
// LOS CAMPOS SIGUEN SIENDO SHADCN, y es una mezcla DECLARADA: el sistema todavía
// no tiene select ni textarea (§ el hueco de controles de formulario). Migrar el
// envoltorio sin ellos es lo que se puede hacer sin inventar valores.
//
// ── SE MONTA EN LA PÁGINA, NUNCA EN EL PANEL ─────────────────────────────────
//
// El panel de detalle se desmonta al cambiar de cliente, y una mutación montada
// ahí puede perder su continuación — es el incidente del 2026-08-06 con los
// comprobantes. Acá arriba el peor caso es que el panel reabra ya con el cambio
// aplicado.
//
// ── EL FORMULARIO VIVE EN UN HIJO QUE SÓLO EXISTE MIENTRAS ESTÁ ABIERTO ──────
//
// Así se re-siembra del cliente actual en cada apertura sin un solo efecto, y el
// error inline se limpia solo al cerrar (§ toast = éxito, inline = error). El
// patrón es el de `EditCustomerDialog` de la pantalla vieja, que ya lo hacía así.

const buildForm = (c: Customer): CustomerForm => ({
  nombre:    c.nombre,
  email:     c.email     ?? '',
  telefono:  c.telefono  ?? '',
  ciudad:    c.ciudad    ?? '',
  direccion: c.direccion ?? '',
  canal:     c.canal     ?? 'directo',
  notas:     c.notas     ?? '',
  activo:    c.activo,
});

export function CustomerFormModal({ open, customer, onOpenChange, onSaved }: {
  open: boolean;
  /** `null` = alta. Con cliente, edición. */
  customer: Customer | null;
  onOpenChange: (o: boolean) => void;
  onSaved: (c: Customer, modo: 'creado' | 'actualizado') => void;
}) {
  const titulo = customer ? 'Editar cliente' : 'Nuevo cliente';
  // LA GUARDA VIVE EN EL ENVOLTORIO para cerrar la TERCERA salida: sin su enVuelo,
  // Esc/clic-fuera/Cancelar cierran el drawer a mitad del guardado, y como el
  // submit vive en el CUERPO, cerrar lo desmonta y el `catch` escribe sobre un
  // componente muerto — el error desaparece en silencio. Mismo reparto que
  // ProductFormModal.
  const guarda = useAccionGuardada();
  const descarte = useDescarteDeDrawer({ enVuelo: guarda.enVuelo, onCerrar: () => onOpenChange(false) });
  return (
    <>
      <DunaSheet
        abierto={open}
        onCerrar={descarte.intentarCerrar}
        anclaje="lado"
        titulo={titulo}
        // Dice qué se puede HACER, no qué es. Va al nombre accesible; lo que se ve
        // es la cabecera de abajo.
        descripcion="Datos de contacto del cliente: nombre, correo, teléfono, ciudad, origen, dirección y notas. No modifica sus pedidos."
      >
        <div className="duna-modal__head">
          <div className="duna-title">{titulo}</div>
        </div>
        {/* El cuerpo sólo existe mientras está abierto, así que se re-siembra del
            cliente actual en cada apertura sin un solo efecto. */}
        {open && (
          <Cuerpo
            customer={customer}
            guarda={guarda}
            marcarCambios={descarte.marcarCambios}
            intentarCerrar={descarte.intentarCerrar}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        )}
      </DunaSheet>
      <ConfirmDescartarDialog abierto={descarte.confirmando} onDescartar={descarte.descartar} onSeguir={descarte.seguirEditando} />
    </>
  );
}

function Cuerpo({ customer, guarda, marcarCambios, intentarCerrar, onClose, onSaved }: {
  customer: Customer | null;
  guarda: ReturnType<typeof useAccionGuardada>;
  marcarCambios: (hay: boolean) => void;
  /** Cerrar pasando por la guarda de descarte (Cancelar/Esc/scrim). */
  intentarCerrar: () => void;
  /** Cierre REAL, tras guardar con éxito. */
  onClose: () => void;
  onSaved: (c: Customer, modo: 'creado' | 'actualizado') => void;
}) {
  const [form, setForm] = useState<CustomerForm>(() => customer ? buildForm(customer) : EMPTY_CUSTOMER_FORM);
  // Se INTENTÓ guardar. El error del campo no aparece antes: marcar en rojo un
  // formulario recién abierto le echa en cara al operador algo que todavía no
  // hizo mal. Aparece con el primer intento y desaparece al corregir.
  const [intentado, setIntentado] = useState(false);
  const faltaNombre = intentado && !form.nombre.trim();

  // El cliente con el que abrió, para el "no hay cambios". `null` en alta: ahí el
  // estado inicial vacío es legítimo y el obligatorio ya bloquea. Se recomputa
  // por render, y no importa: `problemaGuardarCliente` compara por valor.
  const inicial = useMemo(() => (customer ? buildForm(customer) : null), [customer]);
  const problema = problemaGuardarCliente(form, inicial);

  // ¿Hay algo que descartar al cerrar? En alta se compara contra el form vacío
  // (escribir algo ya es "sucio"); en edición, contra el cliente que abrió.
  useEffect(() => {
    marcarCambios(hayCambiosCliente(form, inicial ?? EMPTY_CUSTOMER_FORM));
  }, [form, inicial, marcarCambios]);

  // La guarda de doble-submit ahora la aporta el ENVOLTORIO (para poder gatear el
  // cierre): sus dos mitades siguen intactas —el ref síncrono corta la re-entrada
  // del mismo tick y el estado le pone texto intermedio al botón—, sólo que vive
  // un nivel arriba.
  const error  = useErrorDialogo();

  const campo = (key: keyof CustomerForm) => ({
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value })),
  });

  const guardar = () => guarda.ejecutar(async () => {
    // Se limpia al REINTENTAR, no sólo al cerrar: un error que sobrevive a un
    // reintento exitoso afirma un fallo que ya no existe.
    error.limpiar();
    // EL ERROR DE CAMPO ES INLINE, NO UN TOAST. Un toast aparece lejos del campo,
    // tapa otra cosa y se va solo; el inline vive al lado del problema y persiste
    // hasta que se corrige. Es la misma división que ya regía los errores de
    // servidor (§ toast = éxito, inline = error) — la validación previa era la
    // última que seguía usando el vehículo equivocado.
    setIntentado(true);
    if (!form.nombre.trim()) return;
    try {
      if (customer) {
        onSaved(await updateCustomer(customer.id, form), 'actualizado');
      } else {
        onSaved(await createCustomer(form), 'creado');
      }
      // Cierre SÓLO tras confirmación del servidor. Si falla, el diálogo se queda
      // abierto con lo que el operador escribió y el motivo a la vista.
      onClose();
    } catch (e) {
      error.mostrar(e, 'No se pudo guardar el cliente');
    }
  });

  return (
    <>
      {/* `.duna-form--sm`: la rejilla de grupos con el ritmo CORTO (gap 12px). Es
          un formulario de 7 campos; el gap de 16px de un form largo lo leía
          disperso (§ .duna-form, ritmo por token). */}
      <div className="duna-modal__body duna-form duna-form--sm">
        <div className="duna-field duna-form__full">
          <label className="duna-field__label" htmlFor="cf-nombre">Nombre *</label>
          {/* `aria-invalid` es a la vez el hook de estilo y el anuncio: no se
              puede pintar el campo de inválido sin que un lector lo sepa. */}
          <input className="duna-input" id="cf-nombre" {...campo('nombre')}
                 aria-invalid={faltaNombre || undefined}
                 aria-describedby={faltaNombre ? 'cf-nombre-err' : undefined} />
          {/* Sin mensaje NO se renderiza: un contenedor vacío que reserva su hueco
              empuja el resto del formulario justo cuando el error aparece. */}
          {faltaNombre && <p className="duna-field__error" id="cf-nombre-err">El nombre es requerido.</p>}
        </div>
        <div className="duna-field">
          <span className="duna-field__label">Correo</span>
          <input className="duna-input" {...campo('email')} />
        </div>
        <div className="duna-field">
          <span className="duna-field__label">Teléfono</span>
          <input className="duna-input" {...campo('telefono')} />
        </div>
        <div className="duna-field">
          <span className="duna-field__label">Ciudad</span>
          <input className="duna-input" {...campo('ciudad')} />
        </div>
        <div className="duna-field">
          {/* "Origen" y no "Canal" — UNA sola etiqueta, declarada. Las dos
              pantallas viejas la llaman distinto (la lista "Canal", el perfil
              "Origen") para el MISMO campo. Se elige "Origen" porque para una
              PERSONA el campo dice de dónde llegó; "canal" en el resto del panel
              es cómo entró un PEDIDO. Son dos objetos distintos, y darles la misma
              palabra es lo que los hace parecer el mismo dato. */}
          <label className="duna-field__label" htmlFor="cf-origen">Origen</label>
          <select className="duna-input duna-select" id="cf-origen" value={form.canal}
                  onChange={e => setForm(f => ({ ...f, canal: e.target.value as OrderChannel }))}>
            {(Object.entries(CANALES) as [OrderChannel, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="duna-field duna-form__full">
          <span className="duna-field__label">Dirección</span>
          <input className="duna-input" {...campo('direccion')} />
        </div>
        <div className="duna-field duna-form__full">
          <span className="duna-field__label">Notas</span>
          <textarea {...campo('notas')} className="duna-input" rows={3} />
        </div>
      </div>
      <div className="duna-modal__foot">
        {/* El error INLINE, a la izquierda de los botones y no como banner encima:
            un banner que aparece al fallar empuja el layout y mueve el botón que
            se acaba de clickear. La ranura del sistema es la que decide cuándo
            baja a su propio renglón en vez de aplastarse. */}
        <ErrorDialogo mensaje={error.mensaje} className="duna-modal__aviso" />
        <div className="duna-modal__acciones">
          <button type="button" className="duna-btn duna-btn--ghost" onClick={intentarCerrar} disabled={guarda.enVuelo}>
            Cancelar
          </button>
          <button type="button" className="duna-btn duna-btn--primary" onClick={guardar}
                  disabled={guarda.enVuelo || !!problema}>
            {guarda.enVuelo ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
        {/* Sin cambios NO lleva mensaje: el botón deshabilitado ya lo dice y el
            operador no escribió nada. La validez (nombre) se anuncia en su propio
            campo tras el primer intento; ésta ranura no reserva alto vacía. */}
      </div>
    </>
  );
}
