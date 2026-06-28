import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, isAuthError } from "@/lib/auth/guard";
import { provisionAddon } from "@/lib/addons";
import { AddonType } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const addons = await prisma.addon.findMany({ where: { projectId: id } });
  return NextResponse.json(addons);
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const body = await request.json();
  const type = body.type as AddonType;

  if (!["POSTGRES", "REDIS"].includes(type)) {
    return NextResponse.json({ error: "Invalid addon type" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await provisionAddon(id, type);
  const addon = await prisma.addon.findUnique({ where: { id: result.id } });
  return NextResponse.json(addon, { status: 201 });
}
