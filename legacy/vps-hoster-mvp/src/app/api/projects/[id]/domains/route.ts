import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const hostname = String(body.hostname ?? "").trim().toLowerCase();
  if (!hostname) {
    return NextResponse.json({ error: "hostname is required" }, { status: 400 });
  }

  const taken = await prisma.domain.findUnique({ where: { hostname } });
  if (taken) {
    return NextResponse.json({ error: "Domain already in use" }, { status: 409 });
  }

  const domain = await prisma.domain.create({
    data: {
      projectId: id,
      hostname,
      isPrimary: false,
    },
  });
  return NextResponse.json(domain, { status: 201 });
}
