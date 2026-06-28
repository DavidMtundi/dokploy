import { NextResponse } from "next/server";
import { getContainerLogs } from "@/lib/deploy";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const logs = await getContainerLogs(project.slug);
  return NextResponse.json({ logs });
}
