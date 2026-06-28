"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { Project, ProjectStatus, Deployment, BuildMethod, AddonType, BUILD_METHOD_LABELS } from "@/lib/types";

export function ProjectDetail({ initial }: { initial: Project }) {
  const [project, setProject] = useState(initial);
  const [deploying, setDeploying] = useState(false);
  const [activeDeployment, setActiveDeployment] = useState<Deployment | null>(
    null
  );
  const [containerLogs, setContainerLogs] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [domainError, setDomainError] = useState("");
  const [addonLoading, setAddonLoading] = useState<AddonType | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/projects/${project.id}`);
    if (res.ok) setProject(await res.json());
  }, [project.id]);

  useEffect(() => {
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function handleDeploy() {
    setDeploying(true);
    const res = await fetch(`/api/projects/${project.id}/deploy`, {
      method: "POST",
    });
    if (res.ok) {
      const { deploymentId } = await res.json();
      pollDeployment(deploymentId);
    }
    setDeploying(false);
    refresh();
  }

  async function pollDeployment(id: string) {
    const poll = async () => {
      const res = await fetch(`/api/deployments/${id}`);
      if (!res.ok) return;
      const dep: Deployment = await res.json();
      setActiveDeployment(dep);
      if (!["SUCCESS", "FAILED"].includes(dep.status)) {
        setTimeout(poll, 2000);
      } else {
        refresh();
      }
    };
    poll();
  }

  async function handleStop() {
    await fetch(`/api/projects/${project.id}/stop`, { method: "POST" });
    refresh();
  }

  async function loadContainerLogs() {
    const res = await fetch(`/api/projects/${project.id}/logs`);
    if (res.ok) {
      const { logs } = await res.json();
      setContainerLogs(logs);
    }
  }

  async function addDomain(e: React.FormEvent) {
    e.preventDefault();
    setDomainError("");
    const res = await fetch(`/api/projects/${project.id}/domains`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostname: newDomain }),
    });
    if (!res.ok) {
      const data = await res.json();
      setDomainError(data.error ?? "Failed");
      return;
    }
    setNewDomain("");
    refresh();
  }

  async function updateBuildMethod(method: BuildMethod) {
    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buildMethod: method }),
    });
    if (res.ok) refresh();
  }

  async function provisionAddon(type: AddonType) {
    setAddonLoading(type);
    const res = await fetch(`/api/projects/${project.id}/addons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
    setAddonLoading(null);
    if (res.ok) refresh();
  }

  async function removeAddon(addonId: string) {
    await fetch(`/api/addons/${addonId}`, { method: "DELETE" });
    refresh();
  }

  function parseAddonConfig(config: string) {
    try {
      return JSON.parse(config) as { connectionUrl?: string };
    } catch {
      return {};
    }
  }

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/webhooks/github/${project.slug}`
      : `/api/webhooks/github/${project.slug}`;

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-zinc-400 hover:text-white">
              ← Projects
            </Link>
            <h1 className="text-lg font-semibold text-white">{project.name}</h1>
            <StatusBadge status={project.status as ProjectStatus} />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleStop}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              Stop
            </button>
            <button
              onClick={handleDeploy}
              disabled={deploying || !project.repoUrl}
              className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {deploying ? "Deploying…" : "Deploy"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <section className="grid gap-4 md:grid-cols-2">
          <Card title="Repository">
            <dl className="space-y-2 text-sm">
              <Row label="URL" value={project.repoUrl ?? "—"} />
              <Row label="Branch" value={project.branch} />
              <Row label="Framework" value={project.framework} />
              <Row label="Port" value={String(project.port)} />
            </dl>
            <label className="mt-4 block">
              <span className="text-xs font-medium text-zinc-400">Build method</span>
              <select
                value={project.buildMethod ?? "AUTO"}
                onChange={(e) =>
                  updateBuildMethod(e.target.value as BuildMethod)
                }
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
              >
                {(Object.keys(BUILD_METHOD_LABELS) as BuildMethod[]).map(
                  (m) => (
                    <option key={m} value={m}>
                      {BUILD_METHOD_LABELS[m]}
                    </option>
                  )
                )}
              </select>
            </label>
          </Card>

          <Card title="Auto-deploy webhook">
            <p className="text-xs text-zinc-500">
              Add this URL in GitHub → Settings → Webhooks (push events).
              Secret: <code className="text-zinc-300">{project.webhookSecret}</code>
            </p>
            <code className="mt-2 block break-all rounded bg-zinc-950 p-2 text-xs text-violet-300">
              {webhookUrl}
            </code>
          </Card>
        </section>

        <Card title="Domains">
          <ul className="space-y-2">
            {project.domains?.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between rounded-lg bg-zinc-950 px-3 py-2 text-sm"
              >
                <a
                  href={`https://${d.hostname}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-violet-400 hover:underline"
                >
                  {d.hostname}
                </a>
                {d.isPrimary && (
                  <span className="text-xs text-zinc-500">primary</span>
                )}
              </li>
            ))}
          </ul>
          <form onSubmit={addDomain} className="mt-3 flex gap-2">
            <input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="api.yourdomain.com"
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-lg bg-zinc-800 px-3 py-2 text-sm text-white hover:bg-zinc-700"
            >
              Add
            </button>
          </form>
          {domainError && (
            <p className="mt-1 text-xs text-red-400">{domainError}</p>
          )}
          <p className="mt-2 text-xs text-zinc-500">
            Point DNS A record to your VPS IP. Redeploy after adding domains.
          </p>
        </Card>

        <Card title="Add-ons">
          <p className="text-xs text-zinc-500">
            Managed databases injected as env vars on deploy (DATABASE_URL,
            REDIS_URL).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {!project.addons?.some((a) => a.type === "POSTGRES") && (
              <button
                onClick={() => provisionAddon("POSTGRES")}
                disabled={addonLoading === "POSTGRES"}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
              >
                {addonLoading === "POSTGRES" ? "Provisioning…" : "+ PostgreSQL"}
              </button>
            )}
            {!project.addons?.some((a) => a.type === "REDIS") && (
              <button
                onClick={() => provisionAddon("REDIS")}
                disabled={addonLoading === "REDIS"}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
              >
                {addonLoading === "REDIS" ? "Provisioning…" : "+ Redis"}
              </button>
            )}
          </div>
          <ul className="mt-4 space-y-2">
            {project.addons?.map((addon) => {
              const cfg = parseAddonConfig(addon.config);
              return (
                <li
                  key={addon.id}
                  className="rounded-lg bg-zinc-950 px-3 py-3 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-zinc-200">
                      {addon.name}
                    </span>
                    <span
                      className={
                        addon.status === "RUNNING"
                          ? "text-emerald-400"
                          : addon.status === "FAILED"
                            ? "text-red-400"
                            : "text-amber-400"
                      }
                    >
                      {addon.status}
                    </span>
                  </div>
                  {cfg.connectionUrl && (
                    <code className="mt-1 block truncate text-xs text-zinc-500">
                      {cfg.connectionUrl}
                    </code>
                  )}
                  <button
                    onClick={() => removeAddon(addon.id)}
                    className="mt-2 text-xs text-red-400 hover:underline"
                  >
                    Remove
                  </button>
                </li>
              );
            })}
            {(!project.addons || project.addons.length === 0) && (
              <li className="text-sm text-zinc-500">No add-ons provisioned.</li>
            )}
          </ul>
        </Card>

        {activeDeployment && (
          <Card title={`Deployment ${activeDeployment.status}`}>
            <LogViewer logs={activeDeployment.logs} />
          </Card>
        )}

        <Card
          title="Container logs"
          action={
            <button
              onClick={loadContainerLogs}
              className="text-xs text-violet-400 hover:underline"
            >
              Refresh
            </button>
          }
        >
          {containerLogs ? (
            <LogViewer logs={containerLogs} />
          ) : (
            <p className="text-sm text-zinc-500">Click refresh to load logs.</p>
          )}
        </Card>

        <Card title="Recent deployments">
          <ul className="divide-y divide-zinc-800">
            {project.deployments?.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between py-3 text-sm"
              >
                <div>
                  <span
                    className={
                      d.status === "SUCCESS"
                        ? "text-emerald-400"
                        : d.status === "FAILED"
                          ? "text-red-400"
                          : "text-amber-400"
                    }
                  >
                    {d.status}
                  </span>
                  <span className="ml-2 text-zinc-500">
                    {d.commitSha?.slice(0, 7)} — {d.triggeredBy}
                  </span>
                </div>
                <span className="text-xs text-zinc-600">
                  {new Date(d.startedAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </main>
    </div>
  );
}

function Card({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-300">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="truncate text-right text-zinc-200">{value}</dd>
    </div>
  );
}

function LogViewer({ logs }: { logs: string }) {
  return (
    <pre className="max-h-64 overflow-auto rounded-lg bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-400">
      {logs || "No logs yet."}
    </pre>
  );
}
