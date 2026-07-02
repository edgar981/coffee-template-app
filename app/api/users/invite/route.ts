import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // role is now typed correctly
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { email, name, role } = await req.json();

  const tempPassword = randomBytes(8).toString("hex"); // e.g. "a3f2b1c9"
  const hashed       = await hashPassword(tempPassword);

  const user = await prisma.user.create({
    data: {
      id:            crypto.randomUUID(),
      email,
      name,
      role,
      emailVerified: false,
      createdAt:     new Date(),
      updatedAt:     new Date(),
    },
  });

  await prisma.account.create({
    data: {
      id:         crypto.randomUUID(),
      accountId:  crypto.randomUUID(),
      providerId: "credential",
      userId:     user.id,
      password:   hashed,
      createdAt:  new Date(),
      updatedAt:  new Date(),
    },
  });

  // TODO: email tempPassword to the user via Resend

  return NextResponse.json({ ok: true, tempPassword }); // remove tempPassword from response once email is wired
}