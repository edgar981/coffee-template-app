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
});

export type SiteSettingsEditable = z.infer<typeof siteSettingsEditableSchema>;
