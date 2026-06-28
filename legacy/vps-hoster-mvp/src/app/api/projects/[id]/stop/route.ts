import { NextRequest, NextResponse } from "next/server";
import { stopProject, getContainerLogs } from "@/lib/deploy";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await stopProject(id);
  return NextResponse.json({ ok: true });
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const logs = await getContainerLogs(project.slug);
  return NextResponse.json({ logs });
}
