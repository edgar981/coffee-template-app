import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import {
  COOKIE_MODO_EDITOR,
  MODO_EDITOR_MAX_AGE_S,
  decidirModoEditor,
  usuarioDeSesion,
} from '@/lib/config/modo-editor-gate';

// EL ENCENDIDO/APAGADO del modo editor del storefront (§ EDITOR-TIENDA-IFRAME-GATE-1). Sin UI
// todavía — este endpoint es el mecanismo que la UI del plan (slice 2 en adelante,
// `docs/editor-tienda/DISENO.md`) va a llamar al abrir/cerrar el editor.
//
//   POST   = pone la cookie — SÓLO si quien pide tiene, EN ESTE MOMENTO, sesión OWNER/MANAGER
//            activa. Reusa `decidirModoEditor`+`usuarioDeSesion` de `lib/config/modo-editor-gate`:
//            es el MISMO criterio que `modoEditorActivo()` revalida en cada request del storefront,
//            una sola definición — dos chequeos del mismo hecho es cómo terminan divergiendo
//            (§ CLAUDE.md, `razonDelServidor`/`cruzoMinimo`).
//   DELETE = la quita, SIN chequeo de sesión. Salir del modo editor tiene que poder hacerse aunque
//            la sesión ya haya vencido a mitad de la edición — es una acción inofensiva (apaga el
//            flag, no concede nada) y bloquearla dejaría al operador sin forma de cerrar el modo.

export async function POST() {
  const usuario = await usuarioDeSesion(await headers());
  if (!decidirModoEditor(true, usuario)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const jar = await cookies();
  jar.set(COOKIE_MODO_EDITOR, '1', {
    httpOnly: true,
    sameSite: 'strict',
    // Sólo PRODUCCIÓN cuenta como HTTPS garantizado — mismo criterio que `envPrefix` de
    // `lib/storage.ts`. En local/preview sin TLS, `secure:true` dejaría la cookie sin enviarse
    // nunca y el modo editor jamás se activaría.
    secure: process.env.VERCEL_ENV === 'production',
    path: '/',
    maxAge: MODO_EDITOR_MAX_AGE_S,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const jar = await cookies();
  jar.delete(COOKIE_MODO_EDITOR);
  return NextResponse.json({ ok: true });
}
