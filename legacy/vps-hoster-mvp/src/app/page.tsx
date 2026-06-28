import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser, userCount } from "@/lib/auth/user";
import { StatusBadge } from "@/components/StatusBadge";
import { NewProjectButton } from "@/components/NewProjectButton";
import { AppHeader } from "@/components/AppHeader";
import { ProjectStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const count = await userCount();
  if (count === 0) redirect("/setup");

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      domains: { where: { isPrimary: true }, take: 1 },
    },
  });

  return (
    <div className="min-h-screen bg-zinc-950">
      <AppHeader user={user} />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Projects</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Deploy apps to your VPS — one click, auto-deploy on push.
            </p>
          </div>
          <NewProjectButton />
        </div>

        {projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/30 px-8 py-16 text-center">
            <p className="text-zinc-400">No projects yet.</p>
            <p className="mt-1 text-sm text-zinc-500">
              Create your first project to start deploying.
            </p>
            <div className="mt-6 flex justify-center">
              <NewProjectButton />
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition hover:border-violet-500/50 hover:bg-zinc-900"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-medium text-white group-hover:text-violet-300">
                    {project.name}
                  </h2>
                  <StatusBadge status={project.status as ProjectStatus} />
                </div>
                <p className="mt-2 truncate text-sm text-zinc-500">
                  {project.domains[0]?.hostname ?? project.slug}
                </p>
                {project.repoUrl && (
                  <p className="mt-1 truncate text-xs text-zinc-600">
                    {project.repoUrl.replace(/^https?:\/\//, "")}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
