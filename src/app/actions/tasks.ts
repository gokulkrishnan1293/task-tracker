"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SQLInputValue } from "node:sqlite";
import { db, tx } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { roleIn } from "@/lib/queries";
import { check, isProjectMember, logChange, moduleName, run, taskCtx, userName } from "@/lib/guard";
import { STATUSES, STATUS_LABEL } from "@/lib/types";

const refresh = () => revalidatePath("/", "layout");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date.");
const title = z.string().trim().min(1, "Title can't be empty.").max(500);

// ── Create ───────────────────────────────────────────────────────────────

export async function createTask(input: { moduleId: number; title: string; ownerId?: number | null; dueDate?: string | null }) {
  return run(async () => {
    const user = await requireUser();
    const mod = db.prepare("SELECT id, project_id FROM modules WHERE id = ? AND deleted_at IS NULL").get(input.moduleId) as
      | { id: number; project_id: number }
      | undefined;
    check(mod, "Module not found.");
    const role = roleIn(user, mod.project_id);
    check(role);

    const t = title.parse(input.title);
    const due = input.dueDate ? date.parse(input.dueDate) : null;
    // Members always own what they create; admins can pick anyone in the project, or nobody.
    let owner: number | null = user.id;
    if (role === "admin") {
      owner = input.ownerId ?? null;
      if (owner != null) check(isProjectMember(mod.project_id, owner) || owner === user.id, "That person isn't in this project.");
    }

    const id = tx(() => {
      const max = db.prepare("SELECT coalesce(max(sort_order), 0) m FROM tasks WHERE module_id = ?").get(mod.id) as { m: number };
      const info = db
        .prepare(
          `INSERT INTO tasks (module_id, title, owner_id, due_date, sort_order, created_by, acknowledged_at)
           VALUES (?, ?, ?, ?, ?, ?, ${role === "admin" ? "datetime('now')" : "NULL"})`,
        )
        .run(mod.id, t, owner, due, max.m + 1, user.id);
      const taskId = Number(info.lastInsertRowid);
      logChange(taskId, user.id, "created");
      return taskId;
    });
    refresh();
    return { id };
  });
}

// ── Update ───────────────────────────────────────────────────────────────

const patchSchema = z
  .object({
    title,
    status: z.enum(STATUSES),
    ownerId: z.number().int().nullable(),
    dueDate: date.nullable(),
    moduleId: z.number().int(),
  })
  .partial();

export type TaskPatch = z.infer<typeof patchSchema>;

export async function updateTask(taskId: number, raw: TaskPatch) {
  return run(async () => {
    const { user, role, projectId, task } = await taskCtx(taskId);
    const patch = patchSchema.parse(raw);
    check(!task.deleted_at, "This task is deleted. Restore it first.");

    if (role === "member") {
      check(task.owner_id === user.id, "You can only edit tasks assigned to you.");
      check(task.status !== "done", "Only an admin can reopen a closed task.");
      check(patch.status !== "done", "Only an admin can close a task. Move it to In Review instead.");
      check(patch.moduleId === undefined || patch.moduleId === task.module_id, "Only an admin can move a task to another module.");
      check(
        patch.ownerId === undefined || patch.ownerId === user.id || patch.ownerId === null,
        "Only an admin can reassign a task. You can unassign yourself.",
      );
    }
    if (patch.ownerId != null && patch.ownerId !== task.owner_id) {
      check(isProjectMember(projectId, patch.ownerId), "That person isn't in this project.");
    }
    if (patch.moduleId !== undefined && patch.moduleId !== task.module_id) {
      const target = db.prepare("SELECT project_id FROM modules WHERE id = ? AND deleted_at IS NULL").get(patch.moduleId) as
        | { project_id: number }
        | undefined;
      check(target?.project_id === projectId, "Pick a module in this project.");
    }

    tx(() => {
      const sets: string[] = [];
      const vals: SQLInputValue[] = [];
      const set = (col: string, v: SQLInputValue) => (sets.push(`${col} = ?`), vals.push(v));

      if (patch.title !== undefined && patch.title !== task.title) {
        set("title", patch.title);
        logChange(taskId, user.id, "updated", "title", task.title, patch.title);
      }
      if (patch.status !== undefined && patch.status !== task.status) {
        set("status", patch.status);
        if (patch.status === "done") sets.push("completed_at = datetime('now')");
        if (task.status === "done") sets.push("completed_at = NULL");
        logChange(taskId, user.id, "updated", "status", STATUS_LABEL[task.status], STATUS_LABEL[patch.status]);
      }
      if (patch.ownerId !== undefined && patch.ownerId !== task.owner_id) {
        set("owner_id", patch.ownerId);
        logChange(taskId, user.id, "updated", "owner", userName(task.owner_id), userName(patch.ownerId));
      }
      if (patch.dueDate !== undefined && patch.dueDate !== task.due_date) {
        set("due_date", patch.dueDate);
        logChange(taskId, user.id, "updated", "due_date", task.due_date, patch.dueDate);
      }
      if (patch.moduleId !== undefined && patch.moduleId !== task.module_id) {
        set("module_id", patch.moduleId);
        logChange(taskId, user.id, "moved", "module", moduleName(task.module_id), moduleName(patch.moduleId));
      }
      if (!sets.length) return;
      sets.push("updated_at = datetime('now')");
      // An admin touching a member-created task has seen it.
      if (role === "admin") sets.push("acknowledged_at = coalesce(acknowledged_at, datetime('now'))");
      db.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`).run(...vals, taskId);
    });
    refresh();
    return {};
  });
}

/** Admin review: send an In Review task back to In Progress with a note explaining why. */
export async function sendBack(taskId: number, reason: string) {
  return run(async () => {
    const { user, role, task } = await taskCtx(taskId);
    check(role === "admin", "Only an admin can review tasks.");
    check(task.status === "in_review", "This task isn't waiting for review.");
    const body = z.string().trim().min(1, "Add a note saying what needs to change.").parse(reason);
    tx(() => {
      db.prepare("INSERT INTO task_notes (task_id, author_id, body) VALUES (?, ?, ?)").run(taskId, user.id, body);
      db.prepare("UPDATE tasks SET status = 'in_progress', updated_at = datetime('now') WHERE id = ?").run(taskId);
      logChange(taskId, user.id, "sent_back", "status", STATUS_LABEL.in_review, STATUS_LABEL.in_progress);
    });
    refresh();
    return {};
  });
}

// ── Delete / restore ─────────────────────────────────────────────────────

export async function deleteTask(taskId: number) {
  return run(async () => {
    const { user, role, task } = await taskCtx(taskId);
    check(role === "admin" || task.owner_id === user.id, "You can only delete tasks assigned to you.");
    check(!task.deleted_at, "Already deleted.");
    tx(() => {
      db.prepare("UPDATE tasks SET deleted_at = datetime('now'), deleted_with_module = 0 WHERE id = ?").run(taskId);
      logChange(taskId, user.id, "deleted");
    });
    refresh();
    return {};
  });
}

export async function restoreTask(taskId: number) {
  return run(async () => {
    const { user, role, task } = await taskCtx(taskId);
    check(role === "admin", "Only an admin can restore tasks.");
    check(task.deleted_at, "This task isn't deleted.");
    tx(() => {
      db.prepare("UPDATE tasks SET deleted_at = NULL, updated_at = datetime('now') WHERE id = ?").run(taskId);
      logChange(taskId, user.id, "restored");
    });
    refresh();
    return {};
  });
}

/** Clears the "New" badge once an admin has opened a member-created task. */
export async function acknowledgeTask(taskId: number) {
  return run(async () => {
    const { role, task } = await taskCtx(taskId);
    if (role !== "admin" || task.acknowledged_at) return {};
    db.prepare("UPDATE tasks SET acknowledged_at = datetime('now') WHERE id = ?").run(taskId);
    refresh();
    return {};
  });
}

// ── Notes ────────────────────────────────────────────────────────────────

const noteBody = z.string().trim().min(1, "Note is empty.").max(10_000);

export async function addNote(taskId: number, body: string) {
  return run(async () => {
    const { user, task } = await taskCtx(taskId);
    check(!task.deleted_at, "This task is deleted.");
    const text = noteBody.parse(body);
    tx(() => {
      db.prepare("INSERT INTO task_notes (task_id, author_id, body) VALUES (?, ?, ?)").run(taskId, user.id, text);
      db.prepare("UPDATE tasks SET updated_at = datetime('now') WHERE id = ?").run(taskId);
    });
    refresh();
    return {};
  });
}

function noteCtxQuery(noteId: number) {
  const note = db.prepare("SELECT id, task_id, author_id, body FROM task_notes WHERE id = ? AND deleted_at IS NULL").get(noteId) as
    | { id: number; task_id: number; author_id: number | null; body: string }
    | undefined;
  check(note, "Note not found.");
  return note;
}

export async function editNote(noteId: number, body: string) {
  return run(async () => {
    const note = noteCtxQuery(noteId);
    const { user } = await taskCtx(note.task_id);
    check(note.author_id === user.id, "You can only edit your own notes.");
    const text = noteBody.parse(body);
    if (text === note.body) return {};
    tx(() => {
      db.prepare("UPDATE task_notes SET body = ?, edited_at = datetime('now') WHERE id = ?").run(text, noteId);
      logChange(note.task_id, user.id, "note_edited", "note", note.body, text);
    });
    refresh();
    return {};
  });
}

export async function deleteNote(noteId: number) {
  return run(async () => {
    const note = noteCtxQuery(noteId);
    const { user, role } = await taskCtx(note.task_id);
    check(note.author_id === user.id || role === "admin", "You can only delete your own notes.");
    tx(() => {
      db.prepare("UPDATE task_notes SET deleted_at = datetime('now') WHERE id = ?").run(noteId);
      logChange(note.task_id, user.id, "note_deleted", "note", note.body, null);
    });
    refresh();
    return {};
  });
}

