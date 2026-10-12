import Link from "next/link";
import type { ModuleSummary } from "@/lib/queries";
import { attentionOf, pct } from "@/lib/util";
import { Progress } from "./ui";
import ModuleMenu from "./ModuleMenu";

export default function ModuleCard({ m, href, isAdmin }: { m: ModuleSummary; href: string; isAdmin: boolean }) {
  const complete = m.total > 0 && m.done === m.total;
  const shown = m.attention_tasks.slice(0, 2);
  return (
    <div className="group relative flex flex-col rounded-xl border border-line bg-raised p-4 transition-colors hover:border-accent/50 hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 truncate text-[15px] font-semibold group-hover:text-accent">
          <Link href={href} className="after:absolute after:inset-0 after:rounded-xl">
            {m.name}
          </Link>
        </h3>
        <div className="relative z-10 flex shrink-0 items-center gap-1">
          {isAdmin && m.fresh > 0 && (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent" title="Tasks added by members you haven't opened yet">
              {m.fresh} new
            </span>
          )}
          {m.attention > 0 ? (
            <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">⚠ {m.attention}</span>
          ) : complete ? (
            <span className="rounded-full bg-done-soft px-2 py-0.5 text-xs font-medium text-done">✓</span>
          ) : null}
          {isAdmin && <ModuleMenu id={m.id} name={m.name} description={m.description} taskCount={m.total} />}
        </div>
      </div>
      {m.description && <p className="mt-0.5 line-clamp-1 text-sm text-muted">{m.description}</p>}

      <div className="mt-3 flex items-center gap-3">
        <Progress done={m.done} total={m.total} />
        <span className="tabular w-9 text-right text-xs text-muted">{pct(m.done, m.total)}%</span>
      </div>

      <p className="tabular mt-2 text-xs text-muted">
        {m.total === 0 ? (
          "No tasks yet"
        ) : (
          <>
            <span className="text-fg">{m.total}</span> tasks · <span className="text-done">{m.done} done</span> ·{" "}
            <span className="text-open">{m.open} open</span>
            {m.review > 0 && (
              <>
                {" "}
                · <span className="text-review">{m.review} review</span>
              </>
            )}{" "}
            · {m.pending} pending
          </>
        )}
      </p>

      {shown.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
          {shown.map((t) => (
            <li key={t.id} className="text-xs">
              <span className="line-clamp-1">
                <span className="text-danger">⚠</span> {t.title}
              </span>
              <span className="pl-4 text-danger">{attentionOf(t)?.reason}</span>
            </li>
          ))}
          {m.attention_tasks.length > shown.length && (
            <li className="pl-4 text-xs text-muted">+{m.attention_tasks.length - shown.length} more</li>
          )}
        </ul>
      )}

      {m.owners && <p className="mt-auto truncate pt-3 text-xs text-muted">👤 {m.owners}</p>}
    </div>
  );
}
