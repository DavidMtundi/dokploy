import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, isAuthError } from "@/lib/auth/guard";
import { createApiKey } from "@/lib/auth/api-key";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const keys = await prisma.apiKey.findMany({
    where: { userId: auth.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json(keys);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const body = await request.json();
  const name = String(body.name ?? "").trim() || "Default";

  const { record, rawKey } = await createApiKey(auth.id, name);

  return NextResponse.json(
    {
      id: record.id,
      name: record.name,
      prefix: record.prefix,
      key: rawKey,
      createdAt: record.createdAt,
    },
    { status: 201 }
  );
}
