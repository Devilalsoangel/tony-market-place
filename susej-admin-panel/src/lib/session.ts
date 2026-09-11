import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

// FAIL CLOSED: a session is valid ONLY when the admin exists in the real DB
// and is active. No mock fallback — DB down means unauthenticated.
export async function getCurrentAdmin() {
  const cookieStore = await cookies();
  const payload = verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  const prisma = await getPrisma();
  if (!prisma) return null;
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, loginId: true, email: true, avatar: true, role: true, status: true },
    });
    if (!admin || admin.status !== "active") return null;
    return admin;
  } catch {
    return null;
  }
}

export async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  return admin;
}
