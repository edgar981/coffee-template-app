import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "@duna/core";
import { sendResetPasswordEmail } from "@/lib/email";

// Environment-aware base URL. Better Auth rejects sign-ins whose request origin
// doesn't match baseURL, and BETTER_AUTH_URL is registered to the PRODUCTION
// domain (serving `main`) — so on Vercel PREVIEW deploys (different origin) the
// login always failed with an invalid-origin error. Previews therefore prefer
// the deployment's own auto-provided URL; production and local keep using
// BETTER_AUTH_URL (prod domain / http://localhost:3000).
const baseURL =
  process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.BETTER_AUTH_URL;

// A preview is reachable both by its per-deploy URL (VERCEL_URL) and its
// branch-stable alias (VERCEL_BRANCH_URL) — trust both, and only them. No
// `*.vercel.app` wildcard: that would trust every Vercel-hosted app.
const trustedOrigins = [
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : null,
].filter((origin): origin is string => origin !== null);

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  baseURL,
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    // Every server-side signUpEmail call here (invites, invite acceptance) is a one-off
    // provisioning step, not a flow a browser follows up on — without this, Better Auth
    // creates a session row that never gets a cookie to go with it.
    autoSignIn: false,
    // Recuperación de contraseña. El único acceso hoy era que otro OWNER re-invitara;
    // con un solo dueño eso es quedarse fuera del propio negocio para siempre.
    //
    // MATA TODAS LAS SESIONES al resetear. Es la razón de ser del flujo: quien
    // resetea porque le robaron la clave NO debe dejar viva la sesión del ladrón.
    // A diferencia de `changePassword` (que preserva la sesión actual con
    // `revokeOtherSessions`), acá no hay sesión actual que preservar —el usuario no
    // está logueado—, así que se borran todas. Afirmado en el carril
    // (`tests/integracion/reset-revoca-sesiones.test.ts`), visto fallar sin el flag.
    revokeSessionsOnPasswordReset: true,
    // Better Auth arma el `url` (su callback `/reset-password/<token>` que valida y
    // redirige a la pantalla) y nos pasa `{ user, url, token }`. Sólo mandamos el correo.
    //
    // DECISIÓN — NO igualamos el timing entre un correo que EXISTE y uno que no.
    // Better Auth ya devuelve el MISMO cuerpo en ambos casos (simula la generación de
    // token para el correo inexistente), así que no se filtra por la respuesta. Lo que
    // difiere es la LATENCIA: el caso real espera el envío de Resend (Better Auth
    // awaitea esta función), el falso no. NO se cierra ese canal a propósito:
    //   · el atacante tendría que medir latencias contra el panel de un negocio con
    //     menos de diez usuarios, donde ya sabe cuál es el correo del dueño —no revela
    //     casi nada—;
    //   · un retardo fijo se vuelve mentira en cuanto la red varíe, y un `after()`/cola
    //     es complejidad para cerrar un canal que aquí no vale nada.
    // Awaitar el envío ADEMÁS lo hace confiable en serverless (la función no se congela
    // a mitad). DISPARADOR de reconsiderar: si el panel llega a tener muchos usuarios o
    // registro abierto, la enumeración por tiempo pasa a importar y ahí se cierra.
    sendResetPassword: async ({ user, url }) => {
      await sendResetPasswordEmail({ to: user.email, url });
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "STAFF",
        input: false,   // client can no longer set this
      },
      // Acceso al panel. Viaja en la sesión por el mismo mecanismo que `role`
      // para que el gate del layout lo lea sin una consulta extra — y como
      // `getSession` consulta la base en cada request (no hay cookieCache),
      // desactivar corta el acceso en el request siguiente, no al expirar.
      // `input: false`: jamás se acepta desde el cliente.
      activo: {
        type: "boolean",
        required: false,
        defaultValue: true,
        input: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 8,
    disableSessionRefresh: true,
    freshAge: 60 * 30,   // harmless to keep, inert until you gate routes with it
  }
});