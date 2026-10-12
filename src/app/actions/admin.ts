"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, tx } from "@/lib/db";
import { hashPassword, requireUser, tempPassword } from "@/lib/auth";
import { roleIn } from "@/lib/queries";
import { check, logChange, projectCtx, run, uniqueSlug, userName } from "@/lib/guard";
import { slugify } from "@/lib/util";
import type { Role } from "@/lib/types";

const refresh = () => revalidatePath("/", "layout");
const name = z.string().trim().min(1, "Name is required.").max(120);
const description = z.string().trim().max(500).optional().transform((v) => v || null);
const username = z
  .string()
  .trim()
  .min(2, "Username is too short.")
  .max(40)
  .regex(/^[a-zA-Z0-9._-]+$/, "Username can use letters, numbers, dot, dash and underscore.");
const role = z.enum(["admin", "member"]);

// ── Projects ─────────────────────────────────────────────────────────────

export async function createProject(input: { name: string; description?: string }) {
  return run(async () => {
    const user = await requireUser();
    check(user.is_site_admin, "Only the site admin can create projects.");
    const n = name.parse(input.name);
    const d = description.parse(input.description);
    const slug = uniqueSlug(slugify(n), (s) => !!db.prepare("SELECT 1 FROM projects WHERE slug = ?").get(s));
    const id = tx(() => {
      const info = db.prepare("INSERT INTO projects (name, slug, description) VALUES (?, ?, ?)").run(n, slug, d);
      const pid = Number(info.lastInsertRowid);
      db.prepare("INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'admin')").run(pid, user.id);
      return pid;
    });
    refresh();
    return { id, slug };
  });
}

export async function updateProject(projectId: number, input: { name: string; description?: string }) {
  return run(async () => {
    await projectCtx(projectId, "admin");
    db.prepare("UPDATE projects SET name = ?, description = ? WHERE id = ?").run(
      name.parse(input.name),
      description.parse(input.description),
      projectId,
    );
    refresh();
    return {};
  });
}

export async function setProjectArchived(projectId: number, archived: boolean) {
  return run(async () => {
    const user = await requireUser();
    check(user.is_site_admin, "Only the site admin can archive projects.");
    db.prepare(`UPDATE projects SET archived_at = ${archived ? "datetime('now')" : "NULL"} WHERE id = ?`).run(projectId);
    refresh();
    return {};
  });
}

// ── Modules ──────────────────────────────────────────────────────────────

const moduleSlugTaken = (projectId: number, exceptId = 0) => (s: string) =>
  !!db.prepare("SELECT 1 FROM modules WHERE project_id = ? AND slug = ? AND deleted_at IS NULL AND id != ?").get(projectId, s, exceptId);

export async function createModule(projectId: number, input: { name: string; description?: string }) {
  return run(async () => {
    await projectCtx(projectId, "admin");
    const n = name.parse(input.name);
    const slug = uniqueSlug(slugify(n), moduleSlugTaken(projectId));
    const max = db.prepare("SELECT coalesce(max(sort_order), 0) m FROM modules WHERE project_id = ?").get(projectId) as { m: number };
    db.prepare("INSERT INTO modules (project_id, name, slug, description, sort_order) VALUES (?, ?, ?, ?, ?)").run(
      projectId,
      n,
      slug,
      description.parse(input.description),
      max.m + 1,
    );
    refresh();
    return { slug };
  });
}

function getModule(moduleId: number) {
  const m = db.prepare("SELECT id, project_id, name, deleted_at FROM modules WHERE id = ?").get(moduleId) as
    | { id: number; project_id: number; name: string; deleted_at: string | null }
    | undefined;
  check(m, "Module not found.");
  return m;
}

export async function updateModule(moduleId: number, input: { name: string; description?: string }) {
  return run(async () => {
    const m = getModule(moduleId);
    await projectCtx(m.project_id, "admin");
    const n = name.parse(input.name);
    const slug = uniqueSlug(slugify(n), moduleSlugTaken(m.project_id, m.id));
    db.prepare("UPDATE modules SET name = ?, slug = ?, description = ? WHERE id = ?").run(
      n,
      slug,
      description.parse(input.description),
      moduleId,
    );
    refresh();
    return { slug };
  });
}

/** Soft-deletes the module and its live tasks together, so a restore brings both back. */
export async function deleteModule(moduleId: number) {
  return run(async () => {
    const m = getModule(moduleId);
    const { user } = await projectCtx(m.project_id, "admin");
    check(!m.deleted_at, "Already deleted.");
    tx(() => {
      const live = db.prepare("SELECT id FROM tasks WHERE module_id = ? AND deleted_at IS NULL").all(moduleId) as { id: number }[];
      db.prepare("UPDATE tasks SET deleted_at = datetime('now'), deleted_with_module = 1 WHERE module_id = ? AND deleted_at IS NULL").run(moduleId);
      for (const t of live) logChange(t.id, user.id, "deleted", "module", null, m.name);
      db.prepare("UPDATE modules SET deleted_at = datetime('now') WHERE id = ?").run(moduleId);
    });
    refresh();
    return {};
  });
}

export async function restoreModule(moduleId: number) {
  return run(async () => {
    const m = getModule(moduleId);
    const { user } = await projectCtx(m.project_id, "admin");
    check(m.deleted_at, "This module isn't deleted.");
    tx(() => {
      const cur = db.prepare("SELECT slug FROM modules WHERE id = ?").get(moduleId) as { slug: string };
      const slug = uniqueSlug(cur.slug, moduleSlugTaken(m.project_id, m.id));
      db.prepare("UPDATE modules SET deleted_at = NULL, slug = ? WHERE id = ?").run(slug, moduleId);
      const back = db.prepare("SELECT id FROM tasks WHERE module_id = ? AND deleted_with_module = 1").all(moduleId) as { id: number }[];
      db.prepare("UPDATE tasks SET deleted_at = NULL, deleted_with_module = 0 WHERE module_id = ? AND deleted_with_module = 1").run(moduleId);
      for (const t of back) logChange(t.id, user.id, "restored", "module", null, m.name);
    });
    refresh();
    return {};
  });
}

// ── Members ──────────────────────────────────────────────────────────────

const adminCount = (projectId: number) =>
  (db.prepare("SELECT count(*) c FROM project_members WHERE project_id = ? AND role = 'admin'").get(projectId) as { c: number }).c;

/** Adds an existing user, or creates a new one with a temporary password shown once to the admin. */
export async function addMember(
  projectId: number,
  input: { userId?: number; name?: string; username?: string; role: Role },
) {
  return run(async () => {
    await projectCtx(projectId, "admin");
    const r = role.parse(input.role);
    let userId = input.userId;
    let temp: string | undefined;

    if (!userId) {
      const n = name.parse(input.name);
      const un = username.parse(input.username);
      check(!db.prepare("SELECT 1 FROM users WHERE username = ?").get(un), `Username "${un}" is taken. Pick an existing user instead.`);
      temp = tempPassword();
      const info = db
        .prepare("INSERT INTO users (name, username, password_hash, must_change_password) VALUES (?, ?, ?, 1)")
        .run(n, un, await hashPassword(temp));
      userId = Number(info.lastInsertRowid);
    } else {
      check(db.prepare("SELECT 1 FROM users WHERE id = ?").get(userId), "User not found.");
    }
    db.prepare(
      "INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?) ON CONFLICT DO UPDATE SET role = excluded.role",
    ).run(projectId, userId, r);
    refresh();
    return { tempPassword: temp };
  });
}

export async function setMemberRole(projectId: number, userId: number, newRole: Role) {
  return run(async () => {
    await projectCtx(projectId, "admin");
    const r = role.parse(newRole);
    const cur = db.prepare("SELECT role FROM project_members WHERE project_id = ? AND user_id = ?").get(projectId, userId) as
      | { role: Role }
      | undefined;
    check(cur, "Not a member of this project.");
    if (cur.role === "admin" && r === "member") check(adminCount(projectId) > 1, "A project needs at least one admin.");
    db.prepare("UPDATE project_members SET role = ? WHERE project_id = ? AND user_id = ?").run(r, projectId, userId);
    refresh();
    return {};
  });
}

/** Removes someone from the project. Their open tasks become unassigned (and so show up as needing attention). */
export async function removeMember(projectId: number, userId: number) {
  return run(async () => {
    const { user } = await projectCtx(projectId, "admin");
    const cur = db.prepare("SELECT role FROM project_members WHERE project_id = ? AND user_id = ?").get(projectId, userId) as
      | { role: Role }
      | undefined;
    check(cur, "Not a member of this project.");
    if (cur.role === "admin") check(adminCount(projectId) > 1, "A project needs at least one admin.");
    tx(() => {
      const open = db
        .prepare(
          `SELECT t.id FROM tasks t JOIN modules m ON m.id = t.module_id
            WHERE m.project_id = ? AND t.owner_id = ? AND t.status != 'done' AND t.deleted_at IS NULL`,
        )
        .all(projectId, userId) as { id: number }[];
      const who = userName(userId);
      for (const t of open) {
        db.prepare("UPDATE tasks SET owner_id = NULL, updated_at = datetime('now') WHERE id = ?").run(t.id);
        logChange(t.id, user.id, "updated", "owner", who, null);
      }
      db.prepare("DELETE FROM project_members WHERE project_id = ? AND user_id = ?").run(projectId, userId);
    });
    refresh();
    return {};
  });
}

/**
 * Site admins can reset anyone. Project admins can reset people in a project they administer,
 * except site admins.
 */
export async function resetPassword(userId: number) {
  return run(async () => {
    const me = await requireUser();
    const target = db.prepare("SELECT id, is_site_admin FROM users WHERE id = ?").get(userId) as
      | { id: number; is_site_admin: number }
      | undefined;
    check(target, "User not found.");
    check(target.id !== me.id, "Use Change password for your own account.");
    if (!me.is_site_admin) {
      check(!target.is_site_admin, "Only the site admin can reset that account.");
      const shared = db.prepare("SELECT project_id FROM project_members WHERE user_id = ?").all(userId) as { project_id: number }[];
      check(shared.some((p) => roleIn(me, p.project_id) === "admin"));
    }
    const temp = tempPassword();
    const hash = await hashPassword(temp);
    tx(() => {
      db.prepare("UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?").run(hash, userId);
      db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
    });
    refresh();
    return { tempPassword: temp };
  });
}

// ── Users (site admin) ───────────────────────────────────────────────────

export async function createUser(input: { name: string; username: string; siteAdmin?: boolean }) {
  return run(async () => {
    const me = await requireUser();
    check(me.is_site_admin, "Only the site admin can create users.");
    const n = name.parse(input.name);
    const un = username.parse(input.username);
    check(!db.prepare("SELECT 1 FROM users WHERE username = ?").get(un), `Username "${un}" is taken.`);
    const temp = tempPassword();
    db.prepare("INSERT INTO users (name, username, password_hash, is_site_admin, must_change_password) VALUES (?, ?, ?, ?, 1)").run(
      n,
      un,
      await hashPassword(temp),
      input.siteAdmin ? 1 : 0,
    );
    refresh();
    return { tempPassword: temp };
  });
}

export async function setSiteAdmin(userId: number, value: boolean) {
  return run(async () => {
    const me = await requireUser();
    check(me.is_site_admin, "Only the site admin can do that.");
    check(userId !== me.id, "You can't change your own site admin role.");
    db.prepare("UPDATE users SET is_site_admin = ? WHERE id = ?").run(value ? 1 : 0, userId);
    refresh();
    return {};
  });
}

export async function setUserDisabled(userId: number, disabled: boolean) {
  return run(async () => {
    const me = await requireUser();
    check(me.is_site_admin, "Only the site admin can do that.");
    check(userId !== me.id, "You can't disable your own account.");
    db.prepare(`UPDATE users SET disabled_at = ${disabled ? "datetime('now')" : "NULL"} WHERE id = ?`).run(userId);
    if (disabled) db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
    refresh();
    return {};
  });
}
