"use client";

import { useTransition } from "react";
import { restoreModule } from "@/app/actions/admin";
import { timeAgo } from "@/lib/util";
import { Button } from "./ui";

export default function DeletedModules({ items }: { items: { id: number; name: string; deleted_at: string; task_count: number }[] }) {
  const [pending, start] = useTransition();
  return (
    <details className="mt-10">
      <summary className="cursor-pointer text-sm text-muted hover:text-fg">Deleted modules ({items.length})</summary>
      <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
        {items.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <span>
              {m.name}
              <span className="ml-2 text-xs text-muted" suppressHydrationWarning>
                {m.task_count} task{m.task_count === 1 ? "" : "s"} · deleted {timeAgo(m.deleted_at)}
              </span>
            </span>
            <Button size="sm" disabled={pending} onClick={() => start(async () => void (await restoreModule(m.id)))}>
              Restore
            </Button>
          </li>
        ))}
      </ul>
    </details>
  );
}
