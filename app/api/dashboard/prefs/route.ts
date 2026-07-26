import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import { DEFAULT_WIDGET_KEYS, sanitizeWidgetKeys } from '@/constants/dashboard-widgets';

// Per-admin dashboard layout: the ordered list of visible widget keys. No stored
// row → the registry default. Every read AND write is filtered through
// `sanitizeWidgetKeys` (keep only real registry keys, dedupe, preserve order), so
// a retired widget or a malformed payload never reaches the grid.

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) };
  }
  return { userId: session.user.id };
}

export async function GET() {
  const { error, userId } = await requireAdmin();
  if (error) return error;

  // Reading the layout must NEVER 500 the dashboard. Any DB error (e.g. the table
  // not yet migrated in some environment) degrades to the registry default so the
  // panel still renders. Stored keys are re-sanitized: a widget retired since it
  // was saved is dropped rather than crashing. Empty stored array is a valid
  // choice (the user hid everything) — only a MISSING row falls back to default.
  let widgets: string[] = DEFAULT_WIDGET_KEYS;
  try {
    const pref = await prisma.dashboardPreference.findUnique({ where: { userId } });
    if (pref) widgets = sanitizeWidgetKeys(pref.widgets);
  } catch (e) {
    console.error('dashboard prefs read failed; using default layout:', e);
  }
  return NextResponse.json({ widgets });
}

// Lenient on shape (unknown keys are filtered, not rejected) so the endpoint stays
// forward-compatible as the catalog grows or shrinks. Only the outer type is
// enforced; `sanitizeWidgetKeys` does the real validation against the registry.
const putSchema = z.object({ widgets: z.array(z.string()) });

export async function PUT(req: NextRequest) {
  const { error, userId } = await requireAdmin();
  if (error) return error;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 }); }

  const parsed = putSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  // Filter to real registry keys BEFORE persisting — a malicious/stale client
  // can't store junk. Order is preserved; the stored array IS the render order.
  const widgets = sanitizeWidgetKeys(parsed.data.widgets);

  await prisma.dashboardPreference.upsert({
    where:  { userId },
    update: { widgets },
    create: { userId, widgets },
  });

  return NextResponse.json({ widgets });
}
