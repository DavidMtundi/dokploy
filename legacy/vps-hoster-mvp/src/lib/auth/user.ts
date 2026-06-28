import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifySessionToken, SESSION_COOKIE } from "./session";
import { verifyApiKey } from "./api-key";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
};

export async function getUserFromRequest(
  request: NextRequest
): Promise<AuthUser | null> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const key = authHeader.slice(7);
    const verified = await verifyApiKey(key);
    if (verified) {
      const user = await prisma.user.findUnique({
        where: { id: verified.userId },
        select: { id: true, email: true, name: true },
      });
      return user;
    }
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const userId = await verifySessionToken(token);
  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const userId = await verifySessionToken(token);
  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
}

export async function userCount(): Promise<number> {
  return prisma.user.count();
}
