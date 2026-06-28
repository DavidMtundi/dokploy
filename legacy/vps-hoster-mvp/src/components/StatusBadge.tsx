"use client";

import { STATUS_COLORS, STATUS_LABELS, ProjectStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-200">
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_COLORS[status]}`} />
      {STATUS_LABELS[status]}
    </span>
  );
}
