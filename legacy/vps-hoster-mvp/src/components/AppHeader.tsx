"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function AppHeader({
  user,
}: {
  user?: { email: string; name: string | null } | null;
}) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-zinc-800 bg-zinc-900/50">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-sm font-bold text-white">
              V
            </div>
            <span className="text-lg font-semibold text-white">VPS Hoster</span>
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/settings"
            className="text-sm text-zinc-400 hover:text-white"
          >
            Settings
          </Link>
          {user && (
            <span className="text-sm text-zinc-500">{user.email}</span>
          )}
          <button
            onClick={logout}
            className="text-sm text-zinc-400 hover:text-white"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
