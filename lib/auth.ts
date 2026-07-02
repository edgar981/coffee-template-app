import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "@/lib/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
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