import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/user";
import { ProjectDetail } from "@/components/ProjectDetail";
import { Project } from "@/lib/types";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function ProjectPage({ params }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      domains: true,
      addons: true,
      deployments: { orderBy: { startedAt: "desc" }, take: 10 },
    },
  });

  if (!project) notFound();

  const serialized: Project = {
    ...project,
    buildMethod: project.buildMethod,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    addons: project.addons.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
    deployments: project.deployments.map((d) => ({
      ...d,
      startedAt: d.startedAt.toISOString(),
      finishedAt: d.finishedAt?.toISOString() ?? null,
    })),
  };

  return <ProjectDetail initial={serialized} />;
}
