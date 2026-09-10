import { z } from 'zod';
import { METODOS_PAGO_ORDEN, type MetodoPagoTipo } from '../checkout/metodos-pago';

// Validación de los campos EDITABLES de SiteSetting (los planos). UNA definición que
// corren el PATCH (la que MANDA) y el editor de Configuración (aviso temprano) — como
// las reglas de producto/molienda. SIN `server-only`: el form cliente la importa.
//
// El write es COMPLETO (el editor manda todo el formulario), no parcial, así que no
// aplica la trampa del PATCH-parcial (§ El PATCH de producto es PARCIAL): acá todos los
// campos vienen siempre.

/** "a@b.com" o "Nombre <a@b.com>" — el formato de un remitente de correo. */
const REMITENTE = /^(.+\s)?<?[^\s@]+@[^\s@]+\.[^\s@]+>?$/;

// Un método guardado: su tipo (dentro del set cerrado) + sus datos, texto libre. Sin regex sobre
// los VALORES de `datos` — un número de Nequi, una llave Bre-B o un número de cuenta varían de
// forma por operador/banco, así que restringir el formato rechazaría datos válidos. La guarda de
// "¿se muestra?" (§ metodos-pago) es la que evita un método a medias, no una validación acá.
const metodoPagoSchema = z.object({
  tipo:  z.enum(METODOS_PAGO_ORDEN as [MetodoPagoTipo, ...MetodoPagoTipo[]]),
  datos: z.record(z.string(), z.string()),
});

export const siteSettingsEditableSchema = z.object({
  nombre:            z.string().trim().min(1, 'El nombre del negocio es obligatorio'),
  tagline:           z.string().trim().min(1, 'El tagline es obligatorio'),
  descripcionFooter: z.string().trim().min(1, 'La descripción del footer es obligatoria'),
  whatsapp:          z.string().trim().regex(/^\+?\d[\d\s]{6,}$/, 'Teléfono inválido'),
  instagram:         z.string().trim().min(1, 'El usuario de Instagram es obligatorio'),
  emailRemitente:    z.string().trim().regex(REMITENTE, 'Remitente inválido (usa "a@b.com" o "Nombre <a@b.com>")'),
  // Opcionales: '' se normaliza a null en el server. `.email()` sólo si hay valor.
  emailReplyTo:      z.union([z.literal(''), z.string().trim().email('Correo inválido')]).nullable().optional(),
  adminEmail:        z.union([z.literal(''), z.string().trim().email('Correo inválido')]).nullable().optional(),
  // Los métodos de pago — LISTA (§ PAGOS-METODOS-MODELO-1), SIN tipos repetidos (un elemento por
  // tipo). Un método INCOMPLETO no bloquea el guardado (ámbar, no rojo): se guarda y simplemente
  // no se muestra en la tienda — las dos validaciones DURAS de este bloque son los refines de abajo.
  metodosPago: z.array(metodoPagoSchema),
}).refine(
  d => new Set(d.metodosPago.map(m => m.tipo)).size === d.metodosPago.length,
  { message: 'No puedes repetir un método de pago', path: ['metodosPago'] },
).refine(
  // La lista no puede quedar VACÍA: sin ningún método el checkout no puede cobrar. Regla del
  // editor (aviso temprano) y del server (la que MANDA) — una definición, como "al menos una
  // molienda".
  d => d.metodosPago.length > 0,
  { message: 'Deja al menos un método de pago', path: ['metodosPago'] },
);

export type SiteSettingsEditable = z.infer<typeof siteSettingsEditableSchema>;
