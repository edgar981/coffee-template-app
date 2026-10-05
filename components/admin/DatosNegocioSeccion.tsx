// ─── RETIRADO (§ PANEL-CONFIG-BLOQUES-1) ─────────────────────────────────────────────────────
//
// Esta era la ÚNICA sección de Configuración: identidad + contacto + redes + correos + pagos +
// pasarela, los seis detrás de un solo "Editar". El rediseño por bloques los separó en CINCO
// bloques independientes, cada uno con su propio Editar/Cancelar/Guardar, repartidos en
// `components/admin/configuracion/`:
//
//   - Identidad            → `components/admin/configuracion/IdentidadBloque.tsx`
//   - Contacto + Redes     → `components/admin/configuracion/ContactoRedesBloque.tsx`
//   - Correos              → `components/admin/configuracion/CorreosBloque.tsx`
//   - Pagos + Pasarela     → `components/admin/configuracion/PagosCobrosBloque.tsx`
//
// Este archivo NO SE BORRÓ DEL ÁRBOL DE TRABAJO — la sesión de este slice no tenía `rm`/`git rm`
// concedidos (sólo `checkout`/`switch`/`branch`/`add`/`commit`), así que borrar un archivo
// trackeado no era una operación disponible. Queda como RE-EXPORT del bloque más cercano a lo
// que este archivo hacía (Pagos y cobros, el último en moverse), para que ningún import viejo —
// si quedó alguno fuera de `touches:` de este slice— se rompa en silencio. Reportado como
// deviation en el cierre del slice; el próximo que toque `components/admin/` con `rm` concedido
// puede borrarlo de verdad.

export { default } from '@/components/admin/configuracion/PagosCobrosBloque';
