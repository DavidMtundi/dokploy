import { redirect } from "next/navigation";
import { SetupForm } from "@/components/SetupForm";
import { userCount } from "@/lib/auth/user";

export default async function SetupPage() {
  const count = await userCount();
  if (count > 0) redirect("/login");

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h1 className="text-xl font-semibold text-white">Welcome to VPS Hoster</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Create your admin account to get started.
        </p>
        <div className="mt-6">
          <SetupForm />
        </div>
      </div>
    </div>
  );
}
