import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, isAuthError } from "@/lib/auth/guard";
import { deleteAddon } from "@/lib/addons";

type Params = { params: Promise<{ addonId: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const { addonId } = await params;
  const addon = await prisma.addon.findUnique({ where: { id: addonId } });
  if (!addon) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await deleteAddon(addonId);
  return NextResponse.json({ ok: true });
}

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const { addonId } = await params;
  const addon = await prisma.addon.findUnique({ where: { id: addonId } });
  if (!addon) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(addon);
}
