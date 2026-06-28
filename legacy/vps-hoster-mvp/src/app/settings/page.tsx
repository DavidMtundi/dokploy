import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/user";
import { AppHeader } from "@/components/AppHeader";
import { ApiKeysPanel } from "@/components/ApiKeysPanel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const keys = await prisma.apiKey.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });

  const serialized = keys.map((k) => ({
    ...k,
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
  }));

  return (
    <div className="min-h-screen bg-zinc-950">
      <AppHeader user={user} />
      <main className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Account and API access for automation.
        </p>
        <div className="mt-8 space-y-6">
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h2 className="text-sm font-medium text-zinc-300">Account</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Email</dt>
                <dd className="text-zinc-200">{user.email}</dd>
              </div>
              {user.name && (
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Name</dt>
                  <dd className="text-zinc-200">{user.name}</dd>
                </div>
              )}
            </dl>
          </section>
          <ApiKeysPanel initial={serialized} />
        </div>
      </main>
    </div>
  );
}
