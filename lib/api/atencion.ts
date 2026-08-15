import type { MapaAtencion } from '@/lib/atencion/registro';

// ¿Qué secciones piden atención? Lo consume el PUNTO SOL del nav, que se ve desde
// cualquier pantalla del panel.
//
// Vive en su propio archivo y no en `lib/api/orders`: desde que responde por más
// de una sección dejó de ser un asunto de pedidos, y dejarlo ahí habría hecho que
// agregar Productos al punto sol tocara el cliente de órdenes.
//
// NO lanza: devuelve un mapa vacío ante cualquier fallo. Es la excepción
// deliberada a la regla de propagar el motivo del servidor, y va con su razón:
// esto vive en el CHROME y se poletea solo, así que no hay ninguna acción del
// operador a la que reportarle un error ni un diálogo donde ponerlo. Ante un
// fallo, los puntos se apagan — que es lo mismo que decir "no me consta que haya
// algo que atender". La alternativa, dejarlos encendidos por las dudas, sería un
// aviso que no se puede resolver.
export async function getAtencion(): Promise<MapaAtencion> {
  try {
    const res = await fetch('/api/atencion');
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}
