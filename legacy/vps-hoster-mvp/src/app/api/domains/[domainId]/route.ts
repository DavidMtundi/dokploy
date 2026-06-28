import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ domainId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { domainId } = await params;
  const domain = await prisma.domain.findUnique({ where: { id: domainId } });
  if (!domain) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (domain.isPrimary) {
    return NextResponse.json(
      { error: "Cannot delete primary subdomain" },
      { status: 400 }
    );
  }
  await prisma.domain.delete({ where: { id: domainId } });
  return NextResponse.json({ ok: true });
}
