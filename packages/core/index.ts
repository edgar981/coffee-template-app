// @duna/core — la frontera interna del template coffee-template (NO el modelo
// compartido con Carlos). Fuente única del schema/cliente Prisma y del data-access
// de dominio. Agnóstico de tenant y de presentación: aquí no vive ningún color ni
// el nombre de un negocio.
//
// El cliente generado es TS ESM crudo (import.meta.url, @prisma/client/runtime).
// La app lo transpila vía `transpilePackages: ['@duna/core']` en su next.config.

// La instancia singleton de Prisma (default, para conservar `import prisma from …`).
export { default } from './client';

// Tipos y enums del cliente generado: Prisma, MetodoPago, ComprobanteEstado,
// CondicionPago, TipoEnvio, AutomationRunEstado, y los tipos de modelo. Así los
// consumidores importan `{ Prisma, MetodoPago }` desde '@duna/core'.
export * from './src/generated/prisma/client';
