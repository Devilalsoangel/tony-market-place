import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { mockAdmins } from "@/services/mock-data";

export async function getCurrentAdmin() {
  const cookieStore = await cookies();
  const payload = verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  const prisma = await getPrisma();
  if (prisma) {
    try {
      const admin = await prisma.admin.findUnique({
        where: { id: payload.sub },
        select: { id: true, name: true, loginId: true, email: true, avatar: true, role: true, status: true },
      });
      if (!admin || admin.status !== "active") return null;
      return admin;
    } catch {
      // fall through to mock lookup
    }
  }
  const mock = mockAdmins.find((a) => a.id === payload.sub);
  if (!mock || mock.status !== "active") return null;
  return mock;
}

export async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  return admin;
}