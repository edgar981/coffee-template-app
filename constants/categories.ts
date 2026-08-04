export const CATEGORIA_LABELS = {
  cafe_bolsa: 'Café en Bolsa', cafe_grano: 'Café en Grano', cafe_molido: 'Café Molido',
  cold_brew: 'Cold Brew', caja_regalo: 'Caja Regalo', suscripcion: 'Suscripción',
};

// Acá vivía una lista `MOLIENDAS` global que nadie importaba. Se borró: las
// moliendas son POR PRODUCTO (`Product.moliendasOpciones`, sembradas en
// prisma/seed-products.ts) y sus nombres reales no coincidían con los de esa
// lista. Una constante muerta que describe una semántica inexistente no es código
// sobrante: es documentación falsa, y ya costó una sesión de diagnóstico.
// La regla que las interpreta vive en lib/moliendas-opciones.ts.