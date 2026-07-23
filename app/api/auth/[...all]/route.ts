import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";

const handlers = toNextJsHandler(auth);

export const GET = handlers.GET;

// Public self-registration is disabled. Admin accounts are provisioned ONLY by
// the seed and by tokenized invitations (POST /api/users/accept-invite), both of
// which call `auth.api.signUpEmail` IN-PROCESS — they never pass through this
// HTTP route. Better Auth's own `emailAndPassword.disableSignUp` would also block
// those server-side calls (sign-up.mjs throws for every caller), so instead we
// reject the sign-up endpoint here at the HTTP edge and delegate everything else
// (sign-in, sign-out, session, …) to Better Auth unchanged.
export async function POST(req: NextRequest): Promise<Response> {
  const path = req.nextUrl.pathname;
  if (path.endsWith("/sign-up/email") || path.endsWith("/sign-up")) {
    return NextResponse.json(
      { error: "El registro público está deshabilitado. El acceso al panel es solo por invitación." },
      { status: 403 },
    );
  }
  return handlers.POST(req);
}
