import { z } from 'zod';
import { METODOS_PAGO_ORDEN, type MetodoPagoTipo } from '../checkout/metodos-pago';
import { checkoutSabeDibujar, esNoCobrable } from '../pagos/metodos-pasarela';
import { REDES_SOCIALES_ORDEN, type RedSocialTipo } from './site';

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

// Una red guardada: su tipo (dentro del set cerrado de `REDES_SOCIALES_ORDEN`) + su valor. Sin
// regex sobre `valor` — un handle de Instagram, un número de WhatsApp o una URL de Facebook/X/
// Pinterest varían de forma, y la guarda de "¿se muestra?" vive en el RENDER (una red vacía se
// omite), no acá.
const redSocialSchema = z.object({
  tipo:  z.enum(REDES_SOCIALES_ORDEN as [RedSocialTipo, ...RedSocialTipo[]]),
  valor: z.string(),
});

export const siteSettingsEditableSchema = z.object({
  nombre:            z.string().trim().min(1, 'El nombre del negocio es obligatorio'),
  tagline:           z.string().trim().min(1, 'El tagline es obligatorio'),
  descripcionFooter: z.string().trim().min(1, 'La descripción del footer es obligatoria'),
  whatsapp:          z.string().trim().regex(/^\+?\d[\d\s]{6,}$/, 'Teléfono inválido'),
  // `instagram` DEJÓ DE SER OBLIGATORIO (§ MUESTRARIO-REDES-ADICIONALES-1): era la única "vía de
  // contacto" que este schema garantizaba además de `whatsapp` — pero `whatsapp` YA es obligatorio
  // arriba (el regex lo exige, siempre), así que relajar `instagram` NO deja al negocio sin ninguna
  // vía de contacto: sigue habiendo una garantizada (whatsapp), la misma de antes. Lo que cambia es
  // que Instagram deja de ser LA ÚNICA red editable desde el panel — pasa a ser una entrada más,
  // opcional, de la lista `redes` de abajo; la columna se queda como fuente CONGELADA del backfill
  // (§ el docstring de `SiteSetting.redes`, schema.prisma), y este campo compuesto se sigue
  // aceptando (y reenviando tal cual) porque el write es COMPLETO, no parcial.
  instagram:         z.string().trim(),
  emailRemitente:    z.string().trim().regex(REMITENTE, 'Remitente inválido (usa "a@b.com" o "Nombre <a@b.com>")'),
  // Opcionales: '' se normaliza a null en el server. `.email()` sólo si hay valor.
  emailReplyTo:      z.union([z.literal(''), z.string().trim().email('Correo inválido')]).nullable().optional(),
  adminEmail:        z.union([z.literal(''), z.string().trim().email('Correo inválido')]).nullable().optional(),
  // Los métodos de pago — LISTA (§ PAGOS-METODOS-MODELO-1), SIN tipos repetidos (un elemento por
  // tipo). Un método INCOMPLETO no bloquea el guardado (ámbar, no rojo): se guarda y simplemente
  // no se muestra en la tienda — las dos validaciones DURAS de este bloque son los refines de abajo.
  metodosPago: z.array(metodoPagoSchema),
  // Los métodos de PASARELA (§ API-DIRECTA-PANEL-METODOS-1) — sólo los IDENTIFICADORES que el
  // proveedor devolvió como habilitados para la cuenta del tenant, sin `datos` (un método de
  // pasarela no guarda nada del dueño). SIN el refine de "al menos uno": la pasarela es una
  // capacidad de DESPLIEGUE que puede estar apagada, y `[]` es un estado legítimo — a
  // diferencia de `metodosPago`, el checkout no depende de que esta lista tenga algo.
  metodosPasarela: z.array(z.string().trim().min(1)),
  // Las redes sociales — LISTA (§ MUESTRARIO-REDES-ADICIONALES-1), SIN tipos repetidos (un
  // elemento por tipo). `[]` es un estado LEGÍTIMO (a diferencia de `metodosPago`): el riel ya se
  // oculta solo sin ninguna red configurada — no hay refine de "al menos una".
  redes: z.array(redSocialSchema),
}).refine(
  d => new Set(d.metodosPago.map(m => m.tipo)).size === d.metodosPago.length,
  { message: 'No puedes repetir un método de pago', path: ['metodosPago'] },
).refine(
  // La lista no puede quedar VACÍA: sin ningún método el checkout no puede cobrar. Regla del
  // editor (aviso temprano) y del server (la que MANDA) — una definición, como "al menos una
  // molienda".
  d => d.metodosPago.length > 0,
  { message: 'Deja al menos un método de pago', path: ['metodosPago'] },
).refine(
  d => new Set(d.metodosPasarela).size === d.metodosPasarela.length,
  { message: 'No puedes repetir un tipo de método de pasarela', path: ['metodosPasarela'] },
).refine(
  // § PANEL-FILTRA-IMPLEMENTADOS-1: "la validación del guardado es la que manda" — que el panel
  // no deje marcar el checkbox no alcanza, porque un tipo YA guardado antes de este slice viaja
  // en el payload aunque el dueño no lo haya tocado (el write es COMPLETO, no parcial). Sin este
  // refine, guardar cualquier otro cambio re-persistiría un tipo que el checkout no sabe dibujar.
  // Reusa `checkoutSabeDibujar` — la MISMA función que decide el estado "Disponible pronto" del
  // panel — para que las dos capas nunca puedan discrepar sobre qué es dibujable.
  d => d.metodosPasarela.every(tipo => checkoutSabeDibujar(tipo)),
  {
    // TEXTO PROVISIONAL — PENDIENTE DE TEXTO DEL OWNER, mismo criterio que el resto de los
    // mensajes nuevos de esta cadena de trabajo (§ metodos-pasarela.ts).
    message: 'Hay un método de pasarela que el checkout todavía no sabe ofrecer. Quítalo de Pasarela para poder guardar.',
    path: ['metodosPasarela'],
  },
).refine(
  // Mismo argumento que el refine de arriba, para "no cobrable" en vez de "no dibujable" — las
  // dos mitades de la misma regla del owner (§ PANEL-FILTRA-IMPLEMENTADOS-1).
  d => d.metodosPasarela.every(tipo => !esNoCobrable(tipo)),
  {
    message: 'Hay un método de pasarela que tu cuenta no puede cobrar. Quítalo de Pasarela para poder guardar.',
    path: ['metodosPasarela'],
  },
).refine(
  d => new Set(d.redes.map(r => r.tipo)).size === d.redes.length,
  { message: 'No puedes repetir una red social', path: ['redes'] },
);

export type SiteSettingsEditable = z.infer<typeof siteSettingsEditableSchema>;
