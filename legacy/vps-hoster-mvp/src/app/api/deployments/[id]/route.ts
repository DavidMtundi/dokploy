import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const deployment = await prisma.deployment.findUnique({
    where: { id },
    include: { project: { select: { name: true, slug: true } } },
  });
  if (!deployment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(deployment);
}
