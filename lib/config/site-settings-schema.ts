import { z } from 'zod';

// Validación de los campos EDITABLES de SiteSetting (los planos). UNA definición que
// corren el PATCH (la que MANDA) y el editor de Configuración (aviso temprano) — como
// las reglas de producto/molienda. SIN `server-only`: el form cliente la importa.
//
// El write es COMPLETO (el editor manda todo el formulario), no parcial, así que no
// aplica la trampa del PATCH-parcial (§ El PATCH de producto es PARCIAL): acá todos los
// campos vienen siempre.

/** "a@b.com" o "Nombre <a@b.com>" — el formato de un remitente de correo. */
const REMITENTE = /^(.+\s)?<?[^\s@]+@[^\s@]+\.[^\s@]+>?$/;

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
  // Cuenta para transferencias del checkout — texto libre, vacío permitido (''→null en el server).
  // Sin regex: banco/tipo/titular son texto, y el número varía por banco (largos y separadores
  // distintos), así que restringir el formato rechazaría cuentas válidas. La guarda del checkout
  // (banco+tipo+número presentes) es lo que evita mostrar datos a medias, no una validación.
  bancoNombre:       z.string().trim().optional(),
  bancoTipoCuenta:   z.string().trim().optional(),
  bancoNumeroCuenta: z.string().trim().optional(),
  bancoTitular:      z.string().trim().optional(),
  // Métodos de pago: encender/apagar + el número de pago móvil (Nequi/Daviplata), propio (ya no
  // cuelga de whatsapp). El número es texto libre (formatos por operador), vacío permitido.
  pagoNequiActivo:         z.boolean(),
  pagoDaviplataActivo:     z.boolean(),
  pagoTransferenciaActivo: z.boolean(),
  pagoEfectivoActivo:      z.boolean(),
  pagoMovilNumero:         z.string().trim().optional(),
}).refine(
  // Al menos un método ENCENDIDO: el checkout no puede quedar sin forma de pagar. Regla del editor
  // (aviso temprano) y del server (la que MANDA) — una definición, como "al menos una molienda".
  d => d.pagoNequiActivo || d.pagoDaviplataActivo || d.pagoTransferenciaActivo || d.pagoEfectivoActivo,
  { message: 'Deja al menos un método de pago encendido', path: ['pagoNequiActivo'] },
);

export type SiteSettingsEditable = z.infer<typeof siteSettingsEditableSchema>;
