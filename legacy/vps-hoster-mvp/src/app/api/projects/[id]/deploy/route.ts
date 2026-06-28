import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runDeployment } from "@/lib/deploy";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!project.repoUrl) {
    return NextResponse.json(
      { error: "Configure a repository URL first" },
      { status: 400 }
    );
  }

  const deploymentId = await runDeployment(id, "manual");
  return NextResponse.json({ deploymentId }, { status: 202 });
}
