import type { EventHandler, ScheduledHandler } from '../types';

// El binding key → implementación. El registry (constants/automations.ts) es
// presentación pura y client-safe; ESTO es el lado servidor: quién cumple la
// condición y qué datos lleva el mensaje. Separados a propósito — la página importa
// el registry sin arrastrar Prisma al bundle del cliente.
//
// Una key sin handler simplemente no corre (el motor la salta). Eso permite que el
// catálogo muestre una automatización antes de que su implementación exista.

export const EVENT_HANDLERS: Record<string, EventHandler> = {
  // Fase 4: nueva_orden, stock_bajo, orden_entregada
};

export const SCHEDULED_HANDLERS: Record<string, ScheduledHandler> = {
  // Fase 4: recordatorio_pago, reporte_semanal, cliente_inactivo,
  //         contraentrega_sin_cobrar, envio_estancado, resumen_diario
};
