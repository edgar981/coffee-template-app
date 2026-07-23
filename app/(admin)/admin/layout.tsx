import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import AdminChrome from "@/components/admin/AdminChrome";

// AUTHORITATIVE access gate for the admin panel (/admin/*). proxy.ts already
// bounces requests with no session cookie to /login; here we do the full
// server-side check — a valid Better Auth session AND a panel role (OWNER or
// MANAGER). STAFF and everyone else are sent back to /login. The access decision
// always happens on the server. Each sensitive /api/* handler re-checks session
// + role independently (defense in depth).
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session) redirect("/login");
  if (role !== "OWNER" && role !== "MANAGER") redirect("/login");

  return <AdminChrome>{children}</AdminChrome>;
}
