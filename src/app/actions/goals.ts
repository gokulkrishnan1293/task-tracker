"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, tx } from "@/lib/db";
import { check, goalTitle, logChange, projectCtx, run } from "@/lib/guard";
import { addDays, isWeekKey } from "@/lib/util";

const refresh = () => revalidatePath("/", "layout");
const title = z.string().trim().min(1, "Give the goal a title.").max(200);
const week = z.string().refine(isWeekKey, "Pick a week.");

type GoalRow = { id: number; project_id: number; title: string; week_start: string; created_by: number | null; deleted_at: string | null };

function getGoal(goalId: number) {
  const g = db.prepare("SELECT id, project_id, title, week_start, created_by, deleted_at FROM goals WHERE id = ?").get(goalId) as
    | GoalRow
    | undefined;
  check(g && !g.deleted_at, "Goal not found.");
  return g;
}

/** Anyone in the project can create a goal. The creator or an admin can change it. */
async function canManage(g: GoalRow) {
  const { user, role } = await projectCtx(g.project_id);
  check(role === "admin" || g.created_by === user.id, "Only the person who created this goal, or an admin, can change it.");
  return user;
}

export async function createGoal(projectId: number, input: { title: string; weekStart: string }) {
  return run(async () => {
    const { user } = await projectCtx(projectId);
    const t = title.parse(input.title);
    const w = week.parse(input.weekStart);
    const max = db.prepare("SELECT coalesce(max(sort_order), 0) m FROM goals WHERE project_id = ? AND week_start = ?").get(projectId, w) as {
      m: number;
    };
    const info = db
      .prepare("INSERT INTO goals (project_id, week_start, title, sort_order, created_by) VALUES (?, ?, ?, ?, ?)")
      .run(projectId, w, t, max.m + 1, user.id);
    refresh();
    return { id: Number(info.lastInsertRowid) };
  });
}

export async function renameGoal(goalId: number, newTitle: string) {
  return run(async () => {
    const g = getGoal(goalId);
    await canManage(g);
    db.prepare("UPDATE goals SET title = ? WHERE id = ?").run(title.parse(newTitle), goalId);
    refresh();
    return {};
  });
}

/** Soft-deletes the goal and unlinks its tasks (logged on each task). */
export async function deleteGoal(goalId: number) {
  return run(async () => {
    const g = getGoal(goalId);
    const user = await canManage(g);
    const name = goalTitle(goalId);
    tx(() => {
      const linked = db.prepare("SELECT id FROM tasks WHERE goal_id = ?").all(goalId) as { id: number }[];
      db.prepare("UPDATE tasks SET goal_id = NULL, goal_linked_at = NULL WHERE goal_id = ?").run(goalId);
      for (const t of linked) logChange(t.id, user.id, "updated", "goal", name, null);
      db.prepare("UPDATE goals SET deleted_at = datetime('now') WHERE id = ?").run(goalId);
    });
    refresh();
    return {};
  });
}

/**
 * Continues a goal into the following week: creates the same goal there and moves its
 * unfinished tasks to it. Done tasks stay credited to the original week.
 */
export async function carryForwardGoal(goalId: number) {
  return run(async () => {
    const g = getGoal(goalId);
    const user = await canManage(g);
    check(
      !db.prepare("SELECT 1 FROM goals WHERE carried_from = ? AND deleted_at IS NULL").get(goalId),
      "This goal has already been carried forward.",
    );
    const nextWeek = addDays(g.week_start, 7);
    const fromName = goalTitle(goalId);

    const result = tx(() => {
      const max = db.prepare("SELECT coalesce(max(sort_order), 0) m FROM goals WHERE project_id = ? AND week_start = ?").get(g.project_id, nextWeek) as {
        m: number;
      };
      const info = db
        .prepare("INSERT INTO goals (project_id, week_start, title, sort_order, created_by, carried_from) VALUES (?, ?, ?, ?, ?, ?)")
        .run(g.project_id, nextWeek, g.title, max.m + 1, user.id, goalId);
      const newId = Number(info.lastInsertRowid);
      const toName = goalTitle(newId);
      const open = db.prepare("SELECT id FROM tasks WHERE goal_id = ? AND status != 'done' AND deleted_at IS NULL").all(goalId) as { id: number }[];
      for (const t of open) {
        db.prepare("UPDATE tasks SET goal_id = ?, goal_linked_at = datetime('now') WHERE id = ?").run(newId, t.id);
        logChange(t.id, user.id, "carried", "goal", fromName, toName);
      }
      return { id: newId, moved: open.length, weekStart: nextWeek };
    });
    refresh();
    return result;
  });
}
