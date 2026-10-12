import "server-only";
import { notFound } from "next/navigation";
import { db } from "./db";
import { requireUser } from "./auth";
import type { ActivityItem, Member, Module, Project, Role, Stats, TaskRow, User } from "./types";
import { STALE_DAYS } from "./util";

/** Same rule as attentionOf() in util.ts, for aggregates. Expects the tasks table aliased as t. */
const ATTENTION_SQL = `(t.status != 'done' AND (
  t.status = 'blocked'
  OR (t.due_date IS NOT NULL AND t.due_date < date('now','localtime'))
  OR (t.status = 'in_progress' AND t.updated_at < datetime('now','-${STALE_DAYS} days'))
  OR t.owner_id IS NULL))`;

const STATS_COLS = `
  count(t.id) total,
  coalesce(sum(t.status = 'done'), 0) done,
  coalesce(sum(t.status IN ('in_progress','blocked')), 0) open,
  coalesce(sum(t.status = 'in_review'), 0) review,
  coalesce(sum(t.status = 'not_started'), 0) pending,
  coalesce(sum(${ATTENTION_SQL}), 0) attention,
  coalesce(sum(t.id IS NOT NULL AND t.acknowledged_at IS NULL), 0) fresh`;

// ── Roles ────────────────────────────────────────────────────────────────

export function roleIn(user: User, projectId: number): Role | null {
  if (user.is_site_admin) return "admin";
  const r = db.prepare("SELECT role FROM project_members WHERE project_id = ? AND user_id = ?").get(projectId, user.id) as
    | { role: Role }
    | undefined;
  return r?.role ?? null;
}

/** Loads a project by slug for the current user, or 404s if they aren't a member. */
export async function loadProject(slug: string) {
  const user = await requireUser();
  const project = db.prepare("SELECT * FROM projects WHERE slug = ?").get(slug) as Project | undefined;
  if (!project) notFound();
  const role = roleIn(user, project.id);
  if (!role) notFound();
  return { user, project, role };
}

// ── Lists ────────────────────────────────────────────────────────────────

export type ProjectSummary = Project & Stats & { module_count: number; people: string; last_activity: string | null };

export function projectsFor(user: User): ProjectSummary[] {
  const scope = user.is_site_admin ? "1=1" : "p.id IN (SELECT project_id FROM project_members WHERE user_id = @uid)";
  return db
    .prepare(
      `SELECT p.*,
              (SELECT count(*) FROM modules m2 WHERE m2.project_id = p.id AND m2.deleted_at IS NULL) module_count,
              (SELECT group_concat(name, ', ') FROM (SELECT u.name FROM project_members pm JOIN users u ON u.id = pm.user_id
                 WHERE pm.project_id = p.id AND u.disabled_at IS NULL ORDER BY u.name)) people,
              max(t.updated_at) last_activity,
              ${STATS_COLS}
         FROM projects p
         LEFT JOIN modules m ON m.project_id = p.id AND m.deleted_at IS NULL
         LEFT JOIN tasks t ON t.module_id = m.id AND t.deleted_at IS NULL
        WHERE ${scope}
        GROUP BY p.id
        ORDER BY p.archived_at IS NOT NULL, p.sort_order, p.name`,
    )
    .all({ uid: user.id }) as ProjectSummary[];
}

export function projectStats(projectId: number): Stats {
  return db
    .prepare(
      `SELECT ${STATS_COLS} FROM modules m
         LEFT JOIN tasks t ON t.module_id = m.id AND t.deleted_at IS NULL
        WHERE m.project_id = ? AND m.deleted_at IS NULL`,
    )
    .get(projectId) as Stats;
}

export type ModuleSummary = Module &
  Stats & {
    owners: string | null;
    attention_tasks: { id: number; title: string; status: TaskRow["status"]; due_date: string | null; updated_at: string; owner_id: number | null }[];
  };

export function modulesFor(projectId: number): ModuleSummary[] {
  const mods = db
    .prepare(
      `SELECT m.*, ${STATS_COLS},
              (SELECT group_concat(name, ', ') FROM (SELECT DISTINCT u.name FROM tasks t2 JOIN users u ON u.id = t2.owner_id
                 WHERE t2.module_id = m.id AND t2.deleted_at IS NULL ORDER BY u.name)) owners
         FROM modules m
         LEFT JOIN tasks t ON t.module_id = m.id AND t.deleted_at IS NULL
        WHERE m.project_id = ? AND m.deleted_at IS NULL
        GROUP BY m.id
        ORDER BY m.sort_order, m.name`,
    )
    .all(projectId) as Omit<ModuleSummary, "attention_tasks">[];

  const attn = db
    .prepare(
      `SELECT t.id, t.module_id, t.title, t.status, t.due_date, t.updated_at, t.owner_id
         FROM tasks t JOIN modules m ON m.id = t.module_id
        WHERE m.project_id = ? AND m.deleted_at IS NULL AND t.deleted_at IS NULL AND ${ATTENTION_SQL}
        ORDER BY t.due_date IS NULL, t.due_date, t.id`,
    )
    .all(projectId) as (ModuleSummary["attention_tasks"][number] & { module_id: number })[];

  return mods.map((m) => ({ ...m, attention_tasks: attn.filter((a) => a.module_id === m.id) }));
}

export function deletedModules(projectId: number) {
  return db
    .prepare(
      `SELECT m.id, m.name, m.deleted_at,
              (SELECT count(*) FROM tasks t WHERE t.module_id = m.id AND t.deleted_with_module = 1) task_count
         FROM modules m WHERE m.project_id = ? AND m.deleted_at IS NOT NULL ORDER BY m.deleted_at DESC`,
    )
    .all(projectId) as { id: number; name: string; deleted_at: string; task_count: number }[];
}

export function moduleBySlug(projectId: number, slug: string) {
  return db.prepare("SELECT * FROM modules WHERE project_id = ? AND slug = ? AND deleted_at IS NULL").get(projectId, slug) as
    | Module
    | undefined;
}

export function tasksIn(moduleId: number, includeDeleted: boolean): TaskRow[] {
  return db
    .prepare(
      `SELECT t.*, o.name owner_name, c.name created_by_name,
              (SELECT count(*) FROM task_notes n WHERE n.task_id = t.id AND n.deleted_at IS NULL) note_count
         FROM tasks t
         LEFT JOIN users o ON o.id = t.owner_id
         LEFT JOIN users c ON c.id = t.created_by
        WHERE t.module_id = ? AND (t.deleted_at IS NULL ${includeDeleted ? "OR t.deleted_with_module = 0" : ""})
        ORDER BY t.sort_order, t.id`,
    )
    .all(moduleId) as TaskRow[];
}

export function activityFor(taskId: number): ActivityItem[] {
  const notes = db
    .prepare(
      `SELECT n.id, n.created_at at, u.name actor, n.author_id actorId, n.body, n.edited_at IS NOT NULL edited
         FROM task_notes n LEFT JOIN users u ON u.id = n.author_id
        WHERE n.task_id = ? AND n.deleted_at IS NULL`,
    )
    .all(taskId) as Omit<Extract<ActivityItem, { kind: "note" }>, "kind">[];
  const changes = db
    .prepare(
      `SELECT c.id, c.created_at at, u.name actor, c.action, c.field, c.old_value, c.new_value
         FROM task_changes c LEFT JOIN users u ON u.id = c.actor_id
        WHERE c.task_id = ?`,
    )
    .all(taskId) as Omit<Extract<ActivityItem, { kind: "change" }>, "kind">[];

  const items: ActivityItem[] = [
    ...notes.map((n) => ({ ...n, edited: Boolean(n.edited), kind: "note" as const })),
    ...changes.map((c) => ({ ...c, kind: "change" as const })),
  ];
  // Newest first; within the same second, notes before changes, then latest id first.
  return items.sort((a, b) =>
    a.at !== b.at ? (a.at < b.at ? 1 : -1) : a.kind !== b.kind ? (a.kind === "note" ? -1 : 1) : b.id - a.id,
  );
}

export function membersOf(projectId: number): Member[] {
  return db
    .prepare(
      `SELECT u.id, u.name, u.username, pm.role, u.disabled_at
         FROM project_members pm JOIN users u ON u.id = pm.user_id
        WHERE pm.project_id = ? ORDER BY pm.role, u.name`,
    )
    .all(projectId) as Member[];
}

export function allUsers() {
  return db
    .prepare(
      `SELECT u.id, u.name, u.username, u.is_site_admin, u.must_change_password, u.disabled_at, u.created_at,
              (SELECT group_concat(p.name, ', ') FROM project_members pm JOIN projects p ON p.id = pm.project_id WHERE pm.user_id = u.id) projects
         FROM users u ORDER BY u.disabled_at IS NOT NULL, u.name`,
    )
    .all() as (User & { disabled_at: string | null; created_at: string; projects: string | null })[];
}
