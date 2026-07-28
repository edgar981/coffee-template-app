import { nuevaOrden, stockBajo, ordenEntregada } from './eventos';
import {
  recordatorioPago, reporteSemanal, clienteInactivo,
  contraentregaSinCobrar, envioEstancado, resumenDiario,
} from './programadas';
import type { EventHandler, ScheduledHandler } from '../types';

// El binding key → implementación. El registry (constants/automations.ts) es
// presentación pura y client-safe; ESTO es el lado servidor: quién cumple la
// condición y qué datos lleva el mensaje. Separados a propósito — la página importa
// el registry sin arrastrar Prisma al bundle del cliente.
//
// Una key sin handler simplemente no corre (el motor la salta), así que el catálogo
// puede mostrar una automatización antes de que exista su implementación.

export const EVENT_HANDLERS: Record<string, EventHandler> = {
  nueva_orden:     nuevaOrden,
  stock_bajo:      stockBajo,
  orden_entregada: ordenEntregada,
};

export const SCHEDULED_HANDLERS: Record<string, ScheduledHandler> = {
  recordatorio_pago:        recordatorioPago,
  reporte_semanal:          reporteSemanal,
  cliente_inactivo:         clienteInactivo,
  contraentrega_sin_cobrar: contraentregaSinCobrar,
  envio_estancado:          envioEstancado,
  resumen_diario:           resumenDiario,
};
