import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { config } from "@/lib/config";
import { slugify, defaultSubdomain } from "@/lib/slug";
import { Framework, BuildMethod } from "@prisma/client";
import { requireAuth, isAuthError } from "@/lib/auth/guard";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      domains: { where: { isPrimary: true }, take: 1 },
      deployments: { orderBy: { startedAt: "desc" }, take: 1 },
      addons: true,
    },
  });
  return NextResponse.json(projects);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const body = await request.json();
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  let slug = slugify(body.slug ?? name);
  const existing = await prisma.project.findUnique({ where: { slug } });
  if (existing) slug = `${slug}-${Date.now().toString(36)}`;

  const project = await prisma.project.create({
    data: {
      name,
      slug,
      description: body.description ?? null,
      repoUrl: body.repoUrl ?? null,
      branch: body.branch ?? "main",
      rootDir: body.rootDir ?? ".",
      framework: (body.framework as Framework) ?? "UNKNOWN",
      buildMethod: (body.buildMethod as BuildMethod) ?? "AUTO",
      buildCommand: body.buildCommand ?? null,
      startCommand: body.startCommand ?? null,
      port: Number(body.port) || 3000,
      envVars: JSON.stringify(body.envVars ?? {}),
      autoDeploy: body.autoDeploy !== false,
    },
  });

  const hostname = defaultSubdomain(slug, config.baseDomain);
  await prisma.domain.create({
    data: {
      projectId: project.id,
      hostname,
      isPrimary: true,
    },
  });

  const full = await prisma.project.findUnique({
    where: { id: project.id },
    include: { domains: true },
  });

  return NextResponse.json(full, { status: 201 });
}
