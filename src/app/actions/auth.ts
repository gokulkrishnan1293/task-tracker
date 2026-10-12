"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  createSession,
  destroySession,
  getCurrentUser,
  hashPassword,
  userCount,
  verifyPassword,
} from "@/lib/auth";

export type FormState = { error?: string } | undefined;

const password = z.string().min(8, "Password must be at least 8 characters.");
const username = z
  .string()
  .trim()
  .min(2, "Username is too short.")
  .max(40)
  .regex(/^[a-zA-Z0-9._-]+$/, "Username can use letters, numbers, dot, dash and underscore.");

export async function setupAction(_: FormState, fd: FormData): Promise<FormState> {
  if (userCount() > 0) redirect("/login");
  const parsed = z
    .object({ name: z.string().trim().min(1, "Name is required."), username, password })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, username: un, password: pw } = parsed.data;
  const info = db
    .prepare("INSERT INTO users (name, username, password_hash, is_site_admin) VALUES (?, ?, ?, 1)")
    .run(name, un, await hashPassword(pw));
  await createSession(Number(info.lastInsertRowid));
  redirect("/");
}

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const un = String(fd.get("username") ?? "").trim();
  const pw = String(fd.get("password") ?? "");
  const user = db.prepare("SELECT id, password_hash, disabled_at FROM users WHERE username = ?").get(un) as
    | { id: number; password_hash: string; disabled_at: string | null }
    | undefined;
  const ok = user && !user.disabled_at && (await verifyPassword(pw, user.password_hash));
  if (!ok) {
    await new Promise((r) => setTimeout(r, 400)); // slow down guessing
    return { error: "Wrong username or password." };
  }
  await createSession(user.id);
  const next = String(fd.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function changePasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const current = String(fd.get("current") ?? "");
  const next = password.safeParse(fd.get("password"));
  if (!next.success) return { error: next.error.issues[0].message };
  if (next.data !== fd.get("confirm")) return { error: "The new passwords don't match." };
  const row = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(user.id) as { password_hash: string };
  if (!(await verifyPassword(current, row.password_hash))) return { error: "Current password is wrong." };
  if (current === next.data) return { error: "Choose a password different from the current one." };
  db.prepare("UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?").run(
    await hashPassword(next.data),
    user.id,
  );
  // Sign out other devices, keep this one.
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
  await createSession(user.id);
  redirect("/");
}
