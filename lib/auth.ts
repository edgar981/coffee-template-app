import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "@/lib/prisma";

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
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "STAFF",
        input: false,   // client can no longer set this
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 8,
    disableSessionRefresh: true,
    freshAge: 60 * 30,   // harmless to keep, inert until you gate routes with it
  }
});