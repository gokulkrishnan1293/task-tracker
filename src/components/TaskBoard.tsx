"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createTask, updateTask, type TaskPatch } from "@/app/actions/tasks";
import type { ActivityItem, GoalOption, Status, TaskRow } from "@/lib/types";
import { attentionOf, cx, formatDate, localToday, pct, weekRange, weekStart } from "@/lib/util";
import { Button, inputBase, Progress } from "./ui";
import TaskPanel from "./TaskPanel";
import GoalSelect from "./GoalSelect";

export type { Person } from "./StatusSelect";
import { StatusSelect, type Person } from "./StatusSelect";

const FILTERS = [
  ["all", "All"],
  ["attention", "Attention"],
  ["review", "In Review"],
  ["open", "Open"],
  ["pending", "Pending"],
  ["done", "Done"],
] as const;
type Filter = (typeof FILTERS)[number][0];

const RANK: Record<Status, number> = { in_review: 1, in_progress: 2, blocked: 2, not_started: 3, done: 4 };

export function canEditTask(t: TaskRow, me: Person, isAdmin: boolean) {
  if (t.deleted_at) return false;
  return isAdmin || (t.owner_id === me.id && t.status !== "done");
}

export default function TaskBoard(props: {
  projectSlug: string;
  module: { id: number; name: string; description: string | null };
  tasks: TaskRow[];
  members: Person[];
  modules: Person[];
  me: Person;
  isAdmin: boolean;
  showDeleted: boolean;
  selected: TaskRow | null;
  activity: ActivityItem[];
  initialFilter?: string;
  goals: GoalOption[];
}) {
  const { tasks, members, me, isAdmin, module } = props;
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<string>();
  const [q, setQ] = useState("");
  const [owner, setOwner] = useState<string>("");
  const [goal, setGoal] = useState<string>(""); // "" any, "none", or a goal id
  const [filter, setFilterState] = useState<Filter>(
    FILTERS.some(([k]) => k === props.initialFilter) ? (props.initialFilter as Filter) : "all",
  );
  // Selection is local so the panel opens instantly; the URL follows for shareable links.
  const [selectedId, setSelectedId] = useState<number | null>(props.selected?.id ?? null);
  useEffect(() => setSelectedId(props.selected?.id ?? null), [props.selected?.id]);

  const setParams = useCallback(
    (changes: Record<string, string | null>) => {
      const p = new URLSearchParams(search.toString());
      for (const [k, v] of Object.entries(changes)) (v == null ? p.delete(k) : p.set(k, v));
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, search],
  );

  const select = useCallback(
    (id: number | null) => {
      setSelectedId(id);
      setParams({ task: id == null ? null : String(id) });
    },
    [setParams],
  );
  const setFilter = (f: Filter) => {
    setFilterState(f);
    setParams({ f: f === "all" ? null : f });
  };

  const notify = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(undefined), 4000);
  }, []);

  const save = useCallback(
    (id: number, patch: TaskPatch) =>
      start(async () => {
        const r = await updateTask(id, patch);
        if (!r.ok) {
          notify(r.error);
          router.refresh();
        }
      }),
    [notify, router],
  );

  // ── Derived rows ──
  const now = useMemo(() => new Date(), [tasks]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = useMemo(
    () =>
      tasks
        .map((t) => ({ t, attn: t.deleted_at ? null : attentionOf(t, now) }))
        .sort((a, b) => {
          if (!!a.t.deleted_at !== !!b.t.deleted_at) return a.t.deleted_at ? 1 : -1;
          const ra = a.attn ? 0 : RANK[a.t.status];
          const rb = b.attn ? 0 : RANK[b.t.status];
          return ra - rb || a.t.sort_order - b.t.sort_order || a.t.id - b.t.id;
        }),
    [tasks, now],
  );
  const live = rows.filter((r) => !r.t.deleted_at);
  const counts: Record<Filter, number> = {
    all: live.length,
    attention: live.filter((r) => r.attn).length,
    review: live.filter((r) => r.t.status === "in_review").length,
    open: live.filter((r) => r.t.status === "in_progress" || r.t.status === "blocked").length,
    pending: live.filter((r) => r.t.status === "not_started").length,
    done: live.filter((r) => r.t.status === "done").length,
  };

  const visible = rows.filter(({ t, attn }) => {
    if (t.deleted_at) return filter === "all";
    if (filter === "attention" && !attn) return false;
    if (filter === "review" && t.status !== "in_review") return false;
    if (filter === "open" && !(t.status === "in_progress" || t.status === "blocked")) return false;
    if (filter === "pending" && t.status !== "not_started") return false;
    if (filter === "done" && t.status !== "done") return false;
    if (owner === "me" && t.owner_id !== me.id) return false;
    if (owner === "none" && t.owner_id != null) return false;
    if (owner && owner !== "me" && owner !== "none" && String(t.owner_id) !== owner) return false;
    if (goal === "none" && t.goal_id != null) return false;
    if (goal && goal !== "none" && String(t.goal_id) !== goal) return false;
    if (q && !t.title.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const selectedTask = tasks.find((t) => t.id === selectedId) ?? null;
  const panelOpen = !!selectedTask;

  // ── Keyboard review: ↑/↓ or j/k move, Esc closes, n focuses the note box ──
  const step = useCallback(
    (dir: 1 | -1) => {
      if (!visible.length) return;
      const i = visible.findIndex((r) => r.t.id === selectedId);
      const next = i === -1 ? (dir === 1 ? 0 : visible.length - 1) : Math.min(visible.length - 1, Math.max(0, i + dir));
      select(visible[next].t.id);
    },
    [visible, selectedId, select],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.closest("input, textarea, select, [contenteditable]") || document.querySelector("dialog[open]");
      if (e.key === "Escape" && panelOpen && !document.querySelector("dialog[open]")) {
        if (typing) (el as HTMLElement).blur();
        else select(null);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowDown" || e.key === "j") (e.preventDefault(), step(1));
      else if (e.key === "ArrowUp" || e.key === "k") (e.preventDefault(), step(-1));
      else if (e.key === "n" && panelOpen) (e.preventDefault(), document.getElementById("note-input")?.focus());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, select, panelOpen]);

  // Keep the selected row in view while stepping.
  useEffect(() => {
    if (selectedId) document.getElementById(`row-${selectedId}`)?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  const done = counts.done;
  return (
    <div className="flex">
      <main className={cx("min-w-0 flex-1 px-4 py-6 md:px-6", panelOpen && "max-lg:hidden")}>
        <div className="mx-auto max-w-[1400px]">
          {/* Heading */}
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold">{module.name}</h1>
              {module.description && <p className="mt-0.5 text-sm text-muted">{module.description}</p>}
            </div>
            <div className="flex items-center gap-3 text-sm text-muted">
              <div className="flex w-40 items-center gap-2">
                <Progress done={done} total={counts.all} />
                <span className="tabular text-xs">{pct(done, counts.all)}%</span>
              </div>
              <span className="tabular">
                {counts.all} tasks
                {counts.attention > 0 && <span className="text-danger"> · ⚠ {counts.attention}</span>}
              </span>
            </div>
          </div>

          <AddTask
            moduleId={module.id}
            isAdmin={isAdmin}
            members={members}
            me={me}
            goals={props.goals}
            goalFilter={goal && goal !== "none" ? goal : ""}
            onError={notify}
          />

          {/* Filters */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1 rounded-lg bg-surface p-1">
              {FILTERS.map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={cx(
                    "rounded-md px-2.5 py-1 text-xs font-medium",
                    filter === key ? "bg-raised text-fg shadow-sm" : "text-muted hover:text-fg",
                    key === "attention" && counts.attention > 0 && filter !== key && "text-danger",
                    key === "review" && counts.review > 0 && filter !== key && isAdmin && "text-review",
                  )}
                >
                  {label} <span className="tabular opacity-70">{counts[key]}</span>
                </button>
              ))}
            </div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by title…" className={cx(inputBase, "w-56 min-w-40 flex-1 sm:flex-none")} />
            <select value={owner} onChange={(e) => setOwner(e.target.value)} className={cx(inputBase, "w-auto")}>
              <option value="">Anyone</option>
              <option value="me">Me</option>
              <option value="none">Unassigned</option>
              {members.filter((m) => m.id !== me.id).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            {props.goals.length > 0 && (
              <GoalSelect
                goals={props.goals}
                value={goal}
                onChange={setGoal}
                noneLabel="Any goal"
                className={cx(inputBase, "w-auto max-w-56", goal && "border-accent text-accent")}
                aria-label="Filter by goal"
              />
            )}
            {isAdmin && (
              <label className="ml-auto flex items-center gap-1.5 text-xs text-muted">
                <input type="checkbox" checked={props.showDeleted} onChange={(e) => setParams({ deleted: e.target.checked ? "1" : null })} />
                Show deleted
              </label>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[640px] border-collapse text-[13px]">
              <thead className="bg-surface text-left text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="w-14 px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Task</th>
                  <th className={cx("w-36 px-3 py-2 font-medium", panelOpen && "max-xl:hidden")}>Owner</th>
                  <th className="w-36 px-3 py-2 font-medium">Status</th>
                  <th className={cx("w-36 px-3 py-2 font-medium", panelOpen && "max-xl:hidden")}>Due</th>
                  <th className="w-10 px-2 py-2 text-center font-medium" title="Notes">💬</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(({ t, attn }) => (
                  <Row
                    key={`${t.id}-${t.updated_at}`}
                    t={t}
                    attn={attn?.reason}
                    selected={t.id === selectedId}
                    editable={canEditTask(t, me, isAdmin)}
                    isAdmin={isAdmin}
                    members={members}
                    me={me}
                    panelOpen={panelOpen}
                    onSelect={() => select(t.id === selectedId ? null : t.id)}
                    onSave={(patch) => save(t.id, patch)}
                  />
                ))}
              </tbody>
            </table>
            {visible.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-muted">
                {tasks.length === 0 ? "No tasks in this module yet. Add the first one above." : "No tasks match these filters."}
              </p>
            )}
          </div>

          <p className="mt-3 text-xs text-muted">
            <kbd className="rounded border border-line px-1">↑</kbd> <kbd className="rounded border border-line px-1">↓</kbd> move between tasks ·{" "}
            <kbd className="rounded border border-line px-1">N</kbd> add a note · <kbd className="rounded border border-line px-1">Esc</kbd> close ·{" "}
            <Link href={`/p/${props.projectSlug}`} className="hover:text-fg">
              ← back to modules
            </Link>
          </p>
        </div>
      </main>

      {selectedTask && (
        <TaskPanel
          key={selectedTask.id}
          task={selectedTask}
          activity={props.selected?.id === selectedTask.id ? props.activity : null}
          members={members}
          modules={props.modules}
          goals={props.goals}
          me={me}
          isAdmin={isAdmin}
          editable={canEditTask(selectedTask, me, isAdmin)}
          onSave={(patch) => save(selectedTask.id, patch)}
          onClose={() => select(null)}
          onStep={step}
          onError={notify}
          busy={pending}
        />
      )}

      {toast && (
        <div role="alert" className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-fg px-4 py-2 text-sm text-bg shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Row ──────────────────────────────────────────────────────────────────

function Row({
  t,
  attn,
  selected,
  editable,
  isAdmin,
  members,
  me,
  panelOpen,
  onSelect,
  onSave,
}: {
  t: TaskRow;
  attn?: string;
  selected: boolean;
  editable: boolean;
  isAdmin: boolean;
  members: Person[];
  me: Person;
  panelOpen: boolean;
  onSelect: () => void;
  onSave: (p: TaskPatch) => void;
}) {
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const overdue = !!t.due_date && t.status !== "done" && t.due_date < localToday();
  return (
    <tr
      id={`row-${t.id}`}
      onClick={onSelect}
      aria-selected={selected}
      className={cx(
        "cursor-pointer border-t border-line align-middle",
        selected ? "bg-accent-soft" : "hover:bg-surface",
        t.deleted_at && "opacity-50",
      )}
    >
      <td className="tabular px-3 py-2 text-muted">
        <span className={cx(selected && "font-medium text-accent")}>{t.id}</span>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-start gap-2">
          {attn && <span className="mt-px text-danger" title={attn}>⚠</span>}
          <div className="min-w-0">
            <span className={cx("line-clamp-2", t.status === "done" && "text-muted")}>{t.title}</span>
            <div className="mt-0.5 flex flex-wrap gap-1.5 empty:hidden">
              {attn && <span className="text-[11px] text-danger">{attn}</span>}
              {t.goal_title && t.goal_week && (
                <span className="max-w-64 truncate rounded bg-accent-soft px-1.5 text-[11px] text-accent" title={`Weekly goal · ${weekRange(t.goal_week)}`}>
                  ◎ {t.goal_title}
                  {t.goal_week !== weekStart() && <span className="opacity-70"> · {weekRange(t.goal_week)}</span>}
                </span>
              )}
              {isAdmin && !t.acknowledged_at && !t.deleted_at && (
                <span className="rounded bg-accent-soft px-1.5 text-[11px] font-medium text-accent">New · by {t.created_by_name}</span>
              )}
              {t.deleted_at && <span className="rounded bg-danger-soft px-1.5 text-[11px] text-danger">Deleted</span>}
            </div>
          </div>
        </div>
      </td>
      <td className={cx("px-2 py-1.5", panelOpen && "max-xl:hidden")} onClick={stop}>
        {isAdmin && editable ? (
          <select
            defaultValue={t.owner_id ?? ""}
            onChange={(e) => onSave({ ownerId: e.target.value ? Number(e.target.value) : null })}
            className="w-full rounded px-1 py-1 hover:bg-surface"
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        ) : (
          <span className={cx("px-1", !t.owner_name && "text-muted")}>{t.owner_id === me.id ? `${t.owner_name} (you)` : (t.owner_name ?? "Unassigned")}</span>
        )}
      </td>
      <td className="px-2 py-1.5" onClick={stop}>
        <StatusSelect status={t.status} editable={editable} isAdmin={isAdmin} onChange={(s) => onSave({ status: s })} />
      </td>
      <td className={cx("px-2 py-1.5", panelOpen && "max-xl:hidden")} onClick={stop}>
        {editable ? (
          <input
            type="date"
            defaultValue={t.due_date ?? ""}
            onChange={(e) => onSave({ dueDate: e.target.value || null })}
            className={cx("w-full rounded px-1 py-1 hover:bg-surface", overdue && "text-danger", !t.due_date && "text-muted/60")}
          />
        ) : (
          <span className={cx("px-1", overdue && "text-danger")}>{formatDate(t.due_date)}</span>
        )}
      </td>
      <td className="tabular px-2 py-2 text-center text-muted">{t.note_count || ""}</td>
    </tr>
  );
}

// ── Add task ─────────────────────────────────────────────────────────────

function AddTask({
  moduleId,
  isAdmin,
  members,
  me,
  goals,
  goalFilter,
  onError,
}: {
  moduleId: number;
  isAdmin: boolean;
  members: Person[];
  me: Person;
  goals: GoalOption[];
  goalFilter: string;
  onError: (m: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState<string>(isAdmin ? "" : String(me.id));
  const [due, setDue] = useState("");
  // Follows the goal filter, so tasks added while viewing a goal land in it.
  const [goal, setGoal] = useState(goalFilter);
  useEffect(() => setGoal(goalFilter), [goalFilter]);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLInputElement>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        start(async () => {
          const r = await createTask({
            moduleId,
            title,
            ownerId: owner ? Number(owner) : null,
            dueDate: due || null,
            goalId: goal ? Number(goal) : null,
          });
          if (!r.ok) return onError(r.error);
          setTitle("");
          setDue("");
          ref.current?.focus();
        });
      }}
      className="mb-4 flex flex-wrap gap-2 rounded-lg border border-line bg-surface p-2"
    >
      <input
        ref={ref}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={isAdmin ? "+ Add a task…" : "+ Add a task (assigned to you)…"}
        className={cx(inputBase, "min-w-60 flex-1")}
      />
      {goals.length > 0 && (
        <GoalSelect goals={goals} value={goal} onChange={setGoal} className={cx(inputBase, "w-48", !goal && "text-muted")} aria-label="Weekly goal" />
      )}
      {isAdmin && (
        <select value={owner} onChange={(e) => setOwner(e.target.value)} className={cx(inputBase, "w-36")} aria-label="Owner">
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      )}
      <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={cx(inputBase, "w-36", !due && "text-muted")} aria-label="Due date" />
      <Button variant="primary" disabled={pending || !title.trim()}>
        Add
      </Button>
    </form>
  );
}
