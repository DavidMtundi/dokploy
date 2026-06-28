import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, isAuthError } from "@/lib/auth/guard";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      domains: true,
      addons: true,
      deployments: { orderBy: { startedAt: "desc" }, take: 20 },
    },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(project);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const body = await request.json();

  const data: Record<string, unknown> = {};
  const fields = [
    "name",
    "description",
    "repoUrl",
    "branch",
    "rootDir",
    "framework",
    "buildMethod",
    "buildCommand",
    "startCommand",
    "port",
    "autoDeploy",
  ] as const;

  for (const field of fields) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  if (body.envVars !== undefined) {
    data.envVars = JSON.stringify(body.envVars);
  }

  const project = await prisma.project.update({
    where: { id },
    data,
    include: { domains: true },
  });
  return NextResponse.json(project);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { stopProject } = await import("@/lib/deploy");
  const { deleteAddon } = await import("@/lib/addons");
  await stopProject(id).catch(() => undefined);
  const addons = await prisma.addon.findMany({ where: { projectId: id } });
  for (const addon of addons) {
    await deleteAddon(addon.id).catch(() => undefined);
  }
  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
