"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { carryForwardGoal, createGoal, deleteGoal, renameGoal } from "@/app/actions/goals";
import type { GoalSummary } from "@/lib/types";
import { addDays, cx, parseUtc, pct, weekName, weekRange, weekStart, ymd } from "@/lib/util";
import Modal from "./Modal";
import { STATUS_STYLE, Button, ErrorText, Field, inputCls, Progress } from "./ui";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function GoalsStrip({
  projectId,
  projectSlug,
  week,
  goals,
  meId,
  isAdmin,
}: {
  projectId: number;
  projectSlug: string;
  week: string;
  goals: GoalSummary[];
  meId: number;
  isAdmin: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const current = weekStart();
  const href = (w: string) => `/p/${projectSlug}${w === current ? "" : `?week=${w}`}`;
  const isPast = week < current;

  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted">Weekly goals</h2>
        <div className="ml-2 flex items-center gap-1 text-sm">
          <Link href={href(addDays(week, -7))} className="grid size-7 place-items-center rounded text-muted hover:bg-surface hover:text-fg" aria-label="Previous week">
            ‹
          </Link>
          <span className="min-w-36 text-center" suppressHydrationWarning>
            <span className="font-medium">{weekName(week)}</span> <span className="text-muted">· {weekRange(week)}</span>
          </span>
          <Link href={href(addDays(week, 7))} className="grid size-7 place-items-center rounded text-muted hover:bg-surface hover:text-fg" aria-label="Next week">
            ›
          </Link>
          {week !== current && (
            <Link href={href(current)} className="ml-1 rounded px-2 py-0.5 text-xs text-accent hover:bg-accent-soft">
              Today
            </Link>
          )}
        </div>
        <Button size="sm" className="ml-auto" onClick={() => (setError(undefined), setAdding(true))}>
          + Goal
        </Button>
      </div>

      {goals.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-5 text-sm text-muted">
          No goals for {weekName(week).toLowerCase()}. Add one, then link tasks to it from any module.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {goals.map((g) => (
            <GoalCard key={g.id} g={g} projectSlug={projectSlug} isPast={isPast} canManage={isAdmin || g.created_by === meId} />
          ))}
        </div>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title={`New goal · ${weekRange(week)}`}>
        <form
          className="space-y-3"
          action={(fd) =>
            start(async () => {
              const r = await createGoal(projectId, { title: String(fd.get("title")), weekStart: week });
              if (!r.ok) return setError(r.error);
              setAdding(false);
            })
          }
        >
          <Field label="Goal" hint="Link tasks to it from any module in this project. Progress updates as they're done.">
            <input name="title" required autoFocus className={inputCls} placeholder="Claim validation ready for UAT" />
          </Field>
          <ErrorText>{error}</ErrorText>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={pending}>
              Add goal
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

function GoalCard({ g, projectSlug, isPast, canManage }: { g: GoalSummary; projectSlug: string; isPast: boolean; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const met = g.total > 0 && g.done === g.total;
  const modules = [...new Set(g.tasks.map((t) => t.module_name))];
  // Tasks linked on a later day than the goal was set were added mid-week.
  const goalDay = ymd(parseUtc(g.created_at));

  return (
    <div className={cx("rounded-xl border bg-raised p-4", met ? "border-done/40" : "border-line")}>
      <div className="flex items-start gap-2">
        <span className={cx("mt-0.5", met ? "text-done" : "text-accent")} aria-hidden>
          ◎
        </span>
        <h3 className="min-w-0 flex-1 font-medium leading-snug">{g.title}</h3>
        {met ? (
          <span className="shrink-0 rounded-full bg-done-soft px-2 py-0.5 text-xs font-medium text-done">✓ Met</span>
        ) : g.carried_to_week ? (
          <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-xs text-muted">Carried → {weekRange(g.carried_to_week)}</span>
        ) : isPast ? (
          <span className="shrink-0 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">Missed</span>
        ) : null}
        {canManage && <GoalMenu g={g} carried={!!g.carried_to_week} />}
      </div>
      {g.carried_from_week && <p className="mt-1 pl-6 text-xs text-muted">↩ Carried from {weekRange(g.carried_from_week)}</p>}

      <div className="mt-3 flex items-center gap-3 pl-6">
        <Progress done={g.done} total={g.total} />
        <span className="tabular w-9 text-right text-xs text-muted">{pct(g.done, g.total)}%</span>
      </div>
      <p className="tabular mt-1.5 pl-6 text-xs text-muted">
        {g.total === 0 ? "No tasks linked yet" : `${g.done} of ${g.total} tasks done`}
        {modules.length > 0 && <> · {modules.join(", ")}</>}
      </p>

      {g.total > 0 && (
        <>
          <button onClick={() => setOpen((o) => !o)} className="mt-2 pl-6 text-xs text-accent hover:underline">
            {open ? "Hide tasks" : "Show tasks"}
          </button>
          {open && (
            <ul className="mt-2 space-y-1.5 border-t border-line pt-2 pl-6">
              {g.tasks.map((t) => {
                const linked = t.goal_linked_at ? parseUtc(t.goal_linked_at) : null;
                const midWeek = linked && ymd(linked) > goalDay;
                return (
                  <li key={t.id} className="text-[13px]">
                    <Link href={`/p/${projectSlug}/m/${t.module_slug}?task=${t.id}`} className="flex items-start gap-1.5 hover:text-accent">
                      <span className={cx("shrink-0", t.status === "done" ? "text-done" : "text-muted")} aria-hidden>
                        {STATUS_STYLE[t.status].icon}
                      </span>
                      <span className={cx("line-clamp-1", t.status === "done" && "text-muted line-through")}>{t.title}</span>
                    </Link>
                    <p className="pl-5 text-[11px] text-muted" suppressHydrationWarning>
                      {t.module_name}
                      {t.owner_name && ` · ${t.owner_name}`}
                      {midWeek && linked && (
                        <span className="text-open">
                          {" "}
                          · added {DAYS[linked.getDay()]} {linked.getDate()}
                        </span>
                      )}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function GoalMenu({ g, carried }: { g: GoalSummary; carried: boolean }) {
  const [menu, setMenu] = useState(false);
  const [dialog, setDialog] = useState<"rename" | "delete" | "carry" | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const openTasks = g.total - g.done;
  const next = addDays(g.week_start, 7);

  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const show = (d: typeof dialog) => (setError(undefined), setMenu(false), setDialog(d));

  return (
    <div ref={ref} className="relative shrink-0">
      <button onClick={() => setMenu((m) => !m)} className="rounded px-1.5 text-muted hover:bg-surface hover:text-fg" aria-label="Goal options">
        ⋯
      </button>
      {menu && (
        <div className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-lg border border-line bg-raised py-1 text-sm shadow-lg">
          <button className="block w-full px-3 py-1.5 text-left hover:bg-surface" onClick={() => show("rename")}>
            Rename
          </button>
          <button
            className="block w-full px-3 py-1.5 text-left hover:bg-surface disabled:text-muted"
            disabled={carried}
            onClick={() => show("carry")}
          >
            {carried ? "Already carried forward" : "Carry forward to next week"}
          </button>
          <button className="block w-full px-3 py-1.5 text-left text-danger hover:bg-surface" onClick={() => show("delete")}>
            Delete
          </button>
        </div>
      )}

      <Modal open={dialog === "rename"} onClose={() => setDialog(null)} title="Rename goal">
        <form
          className="space-y-3"
          action={(fd) =>
            start(async () => {
              const r = await renameGoal(g.id, String(fd.get("title")));
              if (!r.ok) return setError(r.error);
              setDialog(null);
            })
          }
        >
          <input name="title" defaultValue={g.title} required autoFocus className={inputCls} />
          <ErrorText>{error}</ErrorText>
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={pending}>
              Save
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={dialog === "carry"} onClose={() => setDialog(null)} title="Carry forward to next week?">
        <p className="text-sm text-muted">
          Creates &ldquo;{g.title}&rdquo; for {weekRange(next)}
          {openTasks > 0
            ? ` and moves its ${openTasks} unfinished task${openTasks === 1 ? "" : "s"} there. The ${g.done} done stay counted for ${weekRange(g.week_start)}.`
            : ". It has no unfinished tasks to move."}
        </p>
        <ErrorText>{error}</ErrorText>
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={() => setDialog(null)}>Cancel</Button>
          <Button
            variant="primary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await carryForwardGoal(g.id);
                if (!r.ok) return setError(r.error);
                setDialog(null);
                router.push(`?week=${r.weekStart}`);
              })
            }
          >
            Carry forward
          </Button>
        </div>
      </Modal>

      <Modal open={dialog === "delete"} onClose={() => setDialog(null)} title={`Delete "${g.title}"?`}>
        <p className="text-sm text-muted">
          {g.total > 0 ? `Its ${g.total} linked task${g.total === 1 ? "" : "s"} will be unlinked (the tasks themselves stay).` : "No tasks are linked to it."}
        </p>
        <ErrorText>{error}</ErrorText>
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={() => setDialog(null)}>Cancel</Button>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await deleteGoal(g.id);
                if (!r.ok) return setError(r.error);
                setDialog(null);
              })
            }
          >
            Delete goal
          </Button>
        </div>
      </Modal>
    </div>
  );
}
