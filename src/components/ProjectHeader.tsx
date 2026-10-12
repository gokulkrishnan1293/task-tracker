import Link from "next/link";
import type { Project, Role, Stats } from "@/lib/types";
import { cx, pct } from "@/lib/util";
import { Progress } from "./ui";
import ProjectToolbar from "./ProjectToolbar";

export default function ProjectHeader({
  project,
  stats,
  role,
  siteAdmin,
  tab,
}: {
  project: Project;
  stats: Stats;
  role: Role;
  siteAdmin: boolean;
  tab: "modules" | "goals" | "members";
}) {
  const base = `/p/${project.slug}`;
  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            {project.name}
            {project.archived_at && <span className="rounded bg-surface px-1.5 py-0.5 text-xs font-normal text-muted">Archived</span>}
          </h1>
          {project.description && <p className="mt-0.5 text-sm text-muted">{project.description}</p>}
        </div>
        {role === "admin" && <ProjectToolbar project={project} siteAdmin={siteAdmin} showNewModule={tab === "modules"} />}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex w-56 items-center gap-2">
          <Progress done={stats.done} total={stats.total} />
          <span className="tabular text-xs text-muted">{pct(stats.done, stats.total)}%</span>
        </div>
        <p className="tabular text-sm text-muted">
          {stats.total} tasks · <span className="text-done">{stats.done} done</span> · <span className="text-open">{stats.open} open</span> ·{" "}
          <span className="text-review">{stats.review} in review</span> · {stats.pending} pending
          {stats.attention > 0 && (
            <>
              {" "}
              · <span className="font-medium text-danger">⚠ {stats.attention} need attention</span>
            </>
          )}
        </p>
      </div>

      <nav className="flex gap-1 border-b border-line">
        {(
          [
            ["modules", "Modules", base],
            ["goals", "Weekly goals", `${base}/goals`],
            ["members", "Members", `${base}/members`],
          ] as const
        ).map(([key, label, href]) => (
          <Link
            key={key}
            href={href}
            className={cx(
              "-mb-px border-b-2 px-3 py-2 text-sm",
              tab === key ? "border-accent font-medium text-fg" : "border-transparent text-muted hover:text-fg",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
