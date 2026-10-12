import Link from "next/link";
import type { ProjectSummary } from "@/lib/queries";
import { pct, timeAgo } from "@/lib/util";
import { Progress, Stat } from "./ui";

export default function ProjectCard({ p }: { p: ProjectSummary }) {
  return (
    <Link
      href={`/p/${p.slug}`}
      className="group flex flex-col rounded-xl border border-line bg-raised p-4 transition-colors hover:border-accent/50 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold group-hover:text-accent">{p.name}</h3>
          {p.description && <p className="mt-0.5 line-clamp-1 text-sm text-muted">{p.description}</p>}
        </div>
        {p.attention > 0 ? (
          <span className="shrink-0 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">⚠ {p.attention}</span>
        ) : p.total > 0 ? (
          <span className="shrink-0 rounded-full bg-done-soft px-2 py-0.5 text-xs font-medium text-done">✓ on track</span>
        ) : null}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Progress done={p.done} total={p.total} />
        <span className="tabular w-9 text-right text-xs text-muted">{pct(p.done, p.total)}%</span>
      </div>

      <div className="mt-4 grid grid-cols-5 gap-2">
        <Stat n={p.done} label="done" tone="done" />
        <Stat n={p.open} label="open" tone="open" />
        <Stat n={p.review} label="review" tone="review" />
        <Stat n={p.pending} label="pending" />
        <Stat n={p.attention} label="attention" tone="danger" />
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3 text-xs text-muted">
        <span className="truncate">
          {p.module_count} module{p.module_count === 1 ? "" : "s"}
          {p.people && <> · {p.people}</>}
        </span>
        {p.last_activity && <span className="shrink-0">Updated {timeAgo(p.last_activity)}</span>}
      </div>
    </Link>
  );
}
