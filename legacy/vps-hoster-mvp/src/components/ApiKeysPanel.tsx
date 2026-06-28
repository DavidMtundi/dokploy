"use client";

import { useState } from "react";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export function ApiKeysPanel({ initial }: { initial: ApiKey[] }) {
  const [keys, setKeys] = useState(initial);
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName || "Default" }),
    });
    if (res.ok) {
      const data = await res.json();
      setRevealedKey(data.key);
      setKeys((k) => [
        {
          id: data.id,
          name: data.name,
          prefix: data.prefix,
          lastUsedAt: null,
          createdAt: data.createdAt,
        },
        ...k,
      ]);
      setNewKeyName("");
    }
    setLoading(false);
  }

  async function revoke(id: string) {
    await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
    setKeys((k) => k.filter((x) => x.id !== id));
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <h2 className="text-sm font-medium text-zinc-300">API Keys</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Use with{" "}
        <code className="text-zinc-400">Authorization: Bearer vph_…</code>
      </p>

      {revealedKey && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="text-xs text-amber-200">
            Copy this key now — it won&apos;t be shown again:
          </p>
          <code className="mt-1 block break-all text-sm text-amber-100">
            {revealedKey}
          </code>
          <button
            onClick={() => setRevealedKey(null)}
            className="mt-2 text-xs text-amber-300 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={createKey} className="mt-4 flex gap-2">
        <input
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          placeholder="Key name"
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-500 disabled:opacity-50"
        >
          Create
        </button>
      </form>

      <ul className="mt-4 divide-y divide-zinc-800">
        {keys.map((k) => (
          <li
            key={k.id}
            className="flex items-center justify-between py-3 text-sm"
          >
            <div>
              <span className="text-zinc-200">{k.name}</span>
              <span className="ml-2 font-mono text-xs text-zinc-500">
                {k.prefix}
              </span>
            </div>
            <button
              onClick={() => revoke(k.id)}
              className="text-xs text-red-400 hover:underline"
            >
              Revoke
            </button>
          </li>
        ))}
        {keys.length === 0 && (
          <li className="py-3 text-sm text-zinc-500">No API keys yet.</li>
        )}
      </ul>
    </section>
  );
}
