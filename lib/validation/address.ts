import { z } from 'zod';
import { COLOMBIA_DEPARTMENTS } from '@/lib/colombia-departments';

// SINGLE standard for what a valid delivery address is. Both the guest checkout
// and the admin "Agregar dirección" flow validate through these field schemas,
// so the two can never drift into a second definition of "valid address".

export const direccionField        = z.string().trim().min(1, 'La dirección es requerida');
export const direccionDetalleField = z.string().trim().max(500).nullish();
export const ciudadField           = z.string().trim().min(1, 'La ciudad es requerida');
export const departamentoField     = z
  .string()
  .trim()
  .min(1, 'El departamento es requerido')
  .refine(d => COLOMBIA_DEPARTMENTS.includes(d), 'Departamento inválido');
// Normalized WhatsApp-ready format: +57 + 10-digit mobile starting with 3.
export const telefonoColombiaField = z
  .string()
  .trim()
  .regex(/^\+573\d{9}$/, 'Teléfono inválido');

// The admin add-address payload groups the address + contact phone together
// (the checkout keeps phone under `customer`, but validates it with the same
// `telefonoColombiaField`). `departamento` is validated to the same standard as
// checkout but not persisted on the Order — it drives shipping tier at checkout
// time only, and an already-created order's cost is left untouched here.
export const deliveryAddressSchema = z.object({
  direccion:         direccionField,
  direccion_detalle: direccionDetalleField,
  ciudad:            ciudadField,
  departamento:      departamentoField,
  telefono:          telefonoColombiaField,
});

export type DeliveryAddressInput = z.infer<typeof deliveryAddressSchema>;
