"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  acknowledgeTask,
  addNote,
  deleteNote,
  deleteTask,
  editNote,
  restoreTask,
  sendBack,
  type TaskPatch,
} from "@/app/actions/tasks";
import type { ActivityItem, GoalOption, TaskRow } from "@/lib/types";
import GoalSelect from "./GoalSelect";
import { attentionOf, cx, formatDate, timeAgo, weekRange } from "@/lib/util";
import { Button, inputBase, textareaCls } from "./ui";
import { StatusSelect, type Person } from "./StatusSelect";

export default function TaskPanel({
  task: t,
  activity,
  members,
  modules,
  goals,
  me,
  isAdmin,
  editable,
  onSave,
  onClose,
  onStep,
  onError,
  busy,
}: {
  task: TaskRow;
  activity: ActivityItem[] | null;
  members: Person[];
  modules: Person[];
  goals: GoalOption[];
  me: Person;
  isAdmin: boolean;
  editable: boolean;
  onSave: (p: TaskPatch) => void;
  onClose: () => void;
  onStep: (dir: 1 | -1) => void;
  onError: (msg: string) => void;
  busy: boolean;
}) {
  const [pending, start] = useTransition();
  const [menu, setMenu] = useState(false);
  const attn = t.deleted_at ? null : attentionOf(t);
  const isOwner = t.owner_id === me.id;
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok && r.error) onError(r.error);
    });

  // An admin opening a member-created task clears its "New" badge.
  useEffect(() => {
    if (isAdmin && !t.acknowledged_at && !t.deleted_at) void acknowledgeTask(t.id);
  }, [isAdmin, t.id, t.acknowledged_at, t.deleted_at]);

  return (
    <aside
      className="panel-in sticky top-12 flex h-[calc(100dvh-3rem)] w-full shrink-0 flex-col border-l border-line bg-raised lg:w-[440px]"
      aria-label={`Task ${t.id}`}
    >
      {/* Top bar */}
      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-line px-3">
        <span className="tabular text-sm font-medium text-muted">#{t.id}</span>
        {(busy || pending) && <span className="ml-2 text-xs text-muted">Saving…</span>}
        <div className="ml-auto flex items-center gap-0.5">
          <IconBtn label="Previous task (↑)" onClick={() => onStep(-1)}>↑</IconBtn>
          <IconBtn label="Next task (↓)" onClick={() => onStep(1)}>↓</IconBtn>
          {(isAdmin || (isOwner && !t.deleted_at)) && (
            <div className="relative">
              <IconBtn label="More" onClick={() => setMenu((m) => !m)}>⋯</IconBtn>
              {menu && (
                <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border border-line bg-raised py-1 text-sm shadow-lg" onMouseLeave={() => setMenu(false)}>
                  {t.deleted_at ? (
                    <button className="block w-full px-3 py-1.5 text-left hover:bg-surface" onClick={() => (setMenu(false), act(() => restoreTask(t.id)))}>
                      Restore task
                    </button>
                  ) : (
                    <button
                      className="block w-full px-3 py-1.5 text-left text-danger hover:bg-surface"
                      onClick={() => {
                        setMenu(false);
                        if (confirm(`Delete task #${t.id}? An admin can restore it later.`)) act(() => deleteTask(t.id));
                      }}
                    >
                      Delete task
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          <IconBtn label="Close (Esc)" onClick={onClose}>✕</IconBtn>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
          {/* Title */}
          {editable ? (
            <textarea
              key={t.title}
              defaultValue={t.title}
              rows={2}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== t.title) onSave({ title: v });
                else e.target.value = t.title;
              }}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), e.currentTarget.blur())}
              className="w-full resize-none rounded-md border border-transparent bg-transparent p-1 -m-1 text-base font-semibold outline-none [field-sizing:content] hover:border-line focus:border-accent"
            />
          ) : (
            <h2 className="text-base font-semibold">{t.title}</h2>
          )}

          {/* Banners */}
          {t.deleted_at && <Banner tone="danger">This task is deleted.{isAdmin && " Restore it from the ⋯ menu."}</Banner>}
          {attn && <Banner tone="danger">⚠ Needs attention: {attn.reason}</Banner>}
          {t.status === "in_review" && !t.deleted_at && (isAdmin ? <ReviewBox task={t} onSave={onSave} onError={onError} /> : <Banner tone="review">Waiting for an admin to review and close.</Banner>)}

          {/* Fields */}
          <dl className="grid grid-cols-[88px_1fr] items-center gap-x-3 gap-y-2 text-sm">
            <dt className="text-muted">Status</dt>
            <dd>
              <StatusSelect key={t.status} status={t.status} editable={editable} isAdmin={isAdmin} onChange={(s) => onSave({ status: s })} className="w-auto" />
            </dd>

            <dt className="text-muted">Owner</dt>
            <dd className="flex items-center gap-2">
              {isAdmin && editable ? (
                <select
                  key={t.owner_id ?? "none"}
                  defaultValue={t.owner_id ?? ""}
                  onChange={(e) => onSave({ ownerId: e.target.value ? Number(e.target.value) : null })}
                  className={cx(inputBase, "w-auto")}
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <span className={cx(!t.owner_name && "text-muted")}>{t.owner_name ?? "Unassigned"}</span>
                  {isOwner && editable && (
                    <button
                      className="text-xs text-muted underline-offset-2 hover:text-fg hover:underline"
                      onClick={() => confirm("Unassign yourself? An admin will pick it up.") && onSave({ ownerId: null })}
                    >
                      Unassign me
                    </button>
                  )}
                </>
              )}
            </dd>

            <dt className="text-muted">Module</dt>
            <dd>
              {isAdmin && editable ? (
                <select key={t.module_id} defaultValue={t.module_id} onChange={(e) => onSave({ moduleId: Number(e.target.value) })} className={cx(inputBase, "w-auto")}>
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              ) : (
                modules.find((m) => m.id === t.module_id)?.name
              )}
            </dd>

            <dt className="text-muted">Goal</dt>
            <dd>
              {editable ? (
                <GoalSelect
                  key={t.goal_id ?? "none"}
                  goals={goals}
                  value={t.goal_id ? String(t.goal_id) : ""}
                  extra={t.goal_id && t.goal_title && t.goal_week ? { id: t.goal_id, title: t.goal_title, week_start: t.goal_week } : null}
                  onChange={(v) => onSave({ goalId: v ? Number(v) : null })}
                  className={cx(inputBase, "w-auto max-w-full", !t.goal_id && "text-muted")}
                  aria-label="Weekly goal"
                />
              ) : t.goal_title && t.goal_week ? (
                <span>
                  ◎ {t.goal_title} <span className="text-muted">· {weekRange(t.goal_week)}</span>
                </span>
              ) : (
                <span className="text-muted">None</span>
              )}
            </dd>

            <dt className="text-muted">Due</dt>
            <dd>
              {editable ? (
                <input
                  key={t.due_date ?? "none"}
                  type="date"
                  defaultValue={t.due_date ?? ""}
                  onChange={(e) => onSave({ dueDate: e.target.value || null })}
                  className={cx(inputBase, "w-auto")}
                />
              ) : (
                formatDate(t.due_date, true)
              )}
            </dd>

            <dt className="text-muted">Created</dt>
            <dd className="text-muted" suppressHydrationWarning>
              {formatDate(t.created_at.slice(0, 10), true)}
              {t.created_by_name && ` by ${t.created_by_name}`}
            </dd>
            {t.completed_at && (
              <>
                <dt className="text-muted">Closed</dt>
                <dd className="text-muted">{formatDate(t.completed_at.slice(0, 10), true)}</dd>
              </>
            )}
          </dl>
        </div>

        {/* Notes + activity */}
        <div className="border-t border-line p-4">
          {!t.deleted_at && <NoteComposer taskId={t.id} onError={onError} />}
          <Activity items={activity} me={me} isAdmin={isAdmin} onError={onError} />
        </div>
      </div>
    </aside>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button title={label} aria-label={label} onClick={onClick} className="grid size-7 place-items-center rounded text-muted hover:bg-surface hover:text-fg">
      {children}
    </button>
  );
}

function Banner({ tone, children }: { tone: "danger" | "review"; children: React.ReactNode }) {
  return (
    <div className={cx("rounded-md px-3 py-2 text-sm", tone === "danger" ? "bg-danger-soft text-danger" : "bg-review-soft text-review")}>{children}</div>
  );
}

// ── Admin review ─────────────────────────────────────────────────────────

function ReviewBox({ task, onSave, onError }: { task: TaskRow; onSave: (p: TaskPatch) => void; onError: (m: string) => void }) {
  const [mode, setMode] = useState<"idle" | "back">("idle");
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2 rounded-md border border-review/30 bg-review-soft p-3">
      <p className="text-sm font-medium text-review">Waiting for your review{task.owner_name && ` · ${task.owner_name}`}</p>
      {mode === "idle" ? (
        <div className="flex gap-2">
          <Button size="sm" variant="primary" className="bg-done" onClick={() => onSave({ status: "done" })}>
            ✓ Approve and close
          </Button>
          <Button size="sm" onClick={() => setMode("back")}>
            Send back…
          </Button>
        </div>
      ) : (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await sendBack(task.id, reason);
              if (!r.ok) return onError(r.error);
              setMode("idle");
              setReason("");
            });
          }}
        >
          <textarea
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What needs to change? This is added as a note."
            rows={3}
            className={textareaCls}
          />
          <div className="flex gap-2">
            <Button size="sm" variant="primary" disabled={pending || !reason.trim()}>
              Send back to In Progress
            </Button>
            <Button size="sm" type="button" variant="ghost" onClick={() => setMode("idle")}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Notes ────────────────────────────────────────────────────────────────

function NoteComposer({ taskId, onError }: { taskId: number; onError: (m: string) => void }) {
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const submit = () => {
    if (!body.trim()) return;
    start(async () => {
      const r = await addNote(taskId, body);
      if (!r.ok) return onError(r.error);
      setBody("");
    });
  };
  return (
    <div className="mb-5">
      <textarea
        id="note-input"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && (e.preventDefault(), submit())}
        placeholder="Add a note…"
        rows={2}
        className={cx(textareaCls, "min-h-16 resize-y [field-sizing:content]")}
      />
      <div className="mt-2 flex items-center justify-end gap-2">
        <span className="text-xs text-muted">Ctrl/⌘ + Enter</span>
        <Button size="sm" variant="primary" disabled={pending || !body.trim()} onClick={submit}>
          Add note
        </Button>
      </div>
    </div>
  );
}

function Activity({ items, me, isAdmin, onError }: { items: ActivityItem[] | null; me: Person; isAdmin: boolean; onError: (m: string) => void }) {
  const [only, setOnly] = useState<"all" | "notes">("all");
  if (!items)
    return (
      <div className="space-y-3" aria-busy>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-surface" />
        ))}
      </div>
    );
  const shown = only === "notes" ? items.filter((i) => i.kind === "note") : items;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Activity</h3>
        <div className="flex gap-0.5 rounded-md bg-surface p-0.5 text-xs">
          {(["all", "notes"] as const).map((k) => (
            <button key={k} onClick={() => setOnly(k)} className={cx("rounded px-2 py-0.5", only === k ? "bg-raised shadow-sm" : "text-muted")}>
              {k === "all" ? "All" : "Notes"}
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 && <p className="text-sm text-muted">No notes yet.</p>}
      <ol className="space-y-3">
        {shown.map((i) =>
          i.kind === "note" ? (
            <NoteItem key={`n${i.id}`} n={i} canEdit={i.actorId === me.id} canDelete={i.actorId === me.id || isAdmin} onError={onError} />
          ) : (
            <li key={`c${i.id}`} className="flex gap-2 text-[13px]">
              <span className="w-4 shrink-0 text-center text-muted" aria-hidden>
                {i.action === "created" ? "＋" : i.action === "deleted" ? "🗑" : i.action === "sent_back" ? "↩" : i.field === "goal" || i.action === "carried" ? "◎" : "↻"}
              </span>
              <div className="min-w-0 text-muted">
                <span className="font-medium text-fg">{i.actor ?? "Someone"}</span> {describeChange(i)}
                <span className="ml-1.5 text-xs" suppressHydrationWarning>
                  · {timeAgo(i.at)}
                </span>
              </div>
            </li>
          ),
        )}
      </ol>
    </div>
  );
}

function NoteItem({
  n,
  canEdit,
  canDelete,
  onError,
}: {
  n: Extract<ActivityItem, { kind: "note" }>;
  canEdit: boolean;
  canDelete: boolean;
  onError: (m: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <li className="group rounded-lg border border-line bg-surface/60 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted">
        <span aria-hidden>💬</span>
        <span className="font-medium text-fg">{n.actor ?? "Someone"}</span>
        <span suppressHydrationWarning>· {timeAgo(n.at)}</span>
        {n.edited && <span>(edited)</span>}
        <span className="ml-auto flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {canEdit && !editing && (
            <button className="hover:text-fg" onClick={() => setEditing(true)} aria-label="Edit note">
              ✎
            </button>
          )}
          {canDelete && (
            <button
              className="hover:text-danger"
              aria-label="Delete note"
              onClick={() =>
                confirm("Delete this note?") &&
                start(async () => {
                  const r = await deleteNote(n.id);
                  if (!r.ok) onError(r.error);
                })
              }
            >
              🗑
            </button>
          )}
        </span>
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea ref={ref} defaultValue={n.body} autoFocus rows={3} className={cx(textareaCls, "[field-sizing:content]")} />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="primary"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await editNote(n.id, ref.current?.value ?? "");
                  if (!r.ok) return onError(r.error);
                  setEditing(false);
                })
              }
            >
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap break-words text-[13px]">{n.body}</p>
      )}
    </li>
  );
}

function describeChange(c: Extract<ActivityItem, { kind: "change" }>): React.ReactNode {
  const b = (s: string | null) => <span className="text-fg">{s}</span>;
  const arrow = (from: string | null, to: string | null) => (
    <>
      {b(from)} → {b(to)}
    </>
  );
  switch (c.action) {
    case "created":
      return "created the task";
    case "deleted":
      return c.field === "module" ? <>deleted it with module {b(c.new_value)}</> : "deleted the task";
    case "restored":
      return c.field === "module" ? <>restored it with module {b(c.new_value)}</> : "restored the task";
    case "sent_back":
      return <>sent it back for changes ({arrow(c.old_value, c.new_value)})</>;
    case "moved":
      return <>moved it from {arrow(c.old_value, c.new_value)}</>;
    case "carried":
      return <>carried it forward to {b(c.new_value)}</>;
    case "note_edited":
      return "edited a note";
    case "note_deleted":
      return "deleted a note";
  }
  switch (c.field) {
    case "status":
      return c.new_value === "Done" ? <>closed the task ({arrow(c.old_value, c.new_value)})</> : <>changed status {arrow(c.old_value, c.new_value)}</>;
    case "owner":
      if (!c.old_value) return <>assigned it to {b(c.new_value)}</>;
      if (!c.new_value) return <>unassigned {b(c.old_value)}</>;
      return <>reassigned {arrow(c.old_value, c.new_value)}</>;
    case "due_date":
      if (!c.old_value) return <>set the due date to {b(formatDate(c.new_value, true))}</>;
      if (!c.new_value) return <>removed the due date ({formatDate(c.old_value, true)})</>;
      return <>changed the due date {arrow(formatDate(c.old_value, true), formatDate(c.new_value, true))}</>;
    case "goal":
      if (!c.old_value) return <>linked it to goal {b(c.new_value)}</>;
      if (!c.new_value) return <>unlinked it from goal {b(c.old_value)}</>;
      return <>moved it to goal {arrow(c.old_value, c.new_value)}</>;
    case "title":
      return (
        <>
          renamed it from <span className="line-through">{c.old_value}</span>
        </>
      );
    default:
      return <>updated {c.field}</>;
  }
}
