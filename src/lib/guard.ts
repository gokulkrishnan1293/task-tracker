import "server-only";
import { ZodError } from "zod";
import { db } from "./db";
import { requireUser } from "./auth";
import { roleIn } from "./queries";
import type { Role, Status, User } from "./types";
import { weekRange } from "./util";

export class Denied extends Error {}

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** Runs an action body, turning permission/validation failures into a message for the UI. */
export async function run<T extends object>(fn: () => Promise<T> | T): Promise<Result<T>> {
  try {
    return { ok: true, ...(await fn()) };
  } catch (e) {
    if (e instanceof Denied) return { ok: false, error: e.message };
    if (e instanceof ZodError) return { ok: false, error: e.issues[0]?.message ?? "Invalid input." };
    // Next.js redirects/notFound are thrown errors too; let them through.
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error(e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export function check(cond: unknown, message = "You don't have permission to do that."): asserts cond {
  if (!cond) throw new Denied(message);
}

export type TaskCtx = {
  user: User;
  role: Role;
  projectId: number;
  task: {
    id: number;
    module_id: number;
    title: string;
    status: Status;
    owner_id: number | null;
    due_date: string | null;
    deleted_at: string | null;
    acknowledged_at: string | null;
    goal_id: number | null;
  };
};

export async function taskCtx(taskId: number): Promise<TaskCtx> {
  const user = await requireUser();
  const task = db
    .prepare(
      `SELECT t.id, t.module_id, t.title, t.status, t.owner_id, t.due_date, t.deleted_at, t.acknowledged_at, t.goal_id, m.project_id
         FROM tasks t JOIN modules m ON m.id = t.module_id WHERE t.id = ?`,
    )
    .get(taskId) as (TaskCtx["task"] & { project_id: number }) | undefined;
  check(task, "Task not found.");
  const role = roleIn(user, task.project_id);
  check(role);
  return { user, role, projectId: task.project_id, task };
}

export async function projectCtx(projectId: number, need: Role = "member") {
  const user = await requireUser();
  const role = roleIn(user, projectId);
  check(role && (need === "member" || role === "admin"));
  return { user, role };
}

export function isProjectMember(projectId: number, userId: number) {
  return !!db.prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?").get(projectId, userId);
}

export function logChange(
  taskId: number,
  actorId: number,
  action: string,
  field: string | null = null,
  oldValue: string | null = null,
  newValue: string | null = null,
) {
  db.prepare(
    "INSERT INTO task_changes (task_id, actor_id, action, field, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(taskId, actorId, action, field, oldValue, newValue);
}

export const userName = (id: number | null) =>
  id == null ? null : ((db.prepare("SELECT name FROM users WHERE id = ?").get(id) as { name: string } | undefined)?.name ?? null);

export const moduleName = (id: number) =>
  (db.prepare("SELECT name FROM modules WHERE id = ?").get(id) as { name: string } | undefined)?.name ?? null;

export function uniqueSlug(base: string, exists: (s: string) => boolean) {
  let slug = base;
  for (let i = 2; exists(slug); i++) slug = `${base}-${i}`;
  return slug;
}

/** Goal name for history, with its week, since a carried-forward goal keeps its title. */
export function goalTitle(id: number | null) {
  if (id == null) return null;
  const g = db.prepare("SELECT title, week_start FROM goals WHERE id = ?").get(id) as { title: string; week_start: string } | undefined;
  return g ? `${g.title} (${weekRange(g.week_start)})` : null;
}

/** A live goal in this project, or a permission error. */
export function goalInProject(goalId: number, projectId: number) {
  const g = db.prepare("SELECT id, project_id FROM goals WHERE id = ? AND deleted_at IS NULL").get(goalId) as
    | { id: number; project_id: number }
    | undefined;
  check(g?.project_id === projectId, "Pick a goal in this project.");
}
