import prisma from '@duna/core';
import {
  ESTADOS_HISTORIAL, CAP_HISTORIAL, entradaHistorial, type EntradaHistorial,
} from './historial';

// LA CONSULTA del historial de una automatización. Aparte de las reglas puras
// (historial.ts) porque importa prisma; extraída del route handler para poder
// afirmar el CORTE y el CAP contra una base real —el carril—: un test con mocks
// pasaría en verde aunque la consulta trajera DUPLICADO y OMITIDO, porque el
// defecto estaría en el `where`, no en el mapeo.

export interface Historial {
  entradas: EntradaHistorial[];
  /** Hay más de CAP: la pantalla lo declara ("mostrando las últimas 50"). */
  hayMas:   boolean;
}

export async function historialDe(automationKey: string): Promise<Historial> {
  const runs = await prisma.automationRun.findMany({
    // EL CORTE (§ historial.ts): sólo lo que cambió algo. Quitar este `where` es
    // lo que el carril ve fallar —devuelve DUPLICADO y OMITIDO de más—.
    where:   { automationKey, estado: { in: [...ESTADOS_HISTORIAL] } },
    orderBy: { createdAt: 'desc' },
    // +1 para saber si hay más SIN una segunda consulta de conteo.
    take:    CAP_HISTORIAL + 1,
    select:  { estado: true, canal: true, targetType: true, targetId: true, payload: true, createdAt: true },
  });
  return {
    entradas: runs.slice(0, CAP_HISTORIAL).map(entradaHistorial),
    hayMas:   runs.length > CAP_HISTORIAL,
  };
}

/**
 * El último run que CUENTA (ENVIADO/FALLIDO) de cada automatización, en UNA
 * consulta (`distinct` por key sobre el orden desc). Es el insumo de la señal de
 * vida —`estadoDeVida`— y del "hace X" de la tarjeta. No trae los DUPLICADO, así
 * que un silencio reciente no se lee como actividad.
 */
export async function ultimosRelevantes(): Promise<Map<string, { estado: string; createdAt: Date }>> {
  const filas = await prisma.automationRun.findMany({
    where:    { estado: { in: [...ESTADOS_HISTORIAL] } },
    orderBy:  [{ automationKey: 'asc' }, { createdAt: 'desc' }],
    distinct: ['automationKey'],
    select:   { automationKey: true, estado: true, createdAt: true },
  });
  return new Map(filas.map(f => [f.automationKey, { estado: f.estado, createdAt: f.createdAt }]));
}
