import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "./db";
import type { User } from "./types";

const COOKIE = "tt_session";
const SESSION_DAYS = 30;

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

/** Readable temporary password, e.g. "kite-4821-moss". */
export function tempPassword() {
  const words = ["kite", "moss", "reef", "dune", "fern", "lark", "pine", "cove", "mint", "opal", "sage", "wren", "jade", "tide", "flint", "ember"];
  const w = () => words[crypto.randomInt(words.length)];
  return `${w()}-${crypto.randomInt(1000, 10000)}-${w()}`;
}

export function userCount() {
  return (db.prepare("SELECT count(*) c FROM users").get() as { c: number }).c;
}

export async function createSession(userId: number) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").run(
    sha256(token),
    userId,
    expires.toISOString(),
  );
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(new Date().toISOString());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    expires,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) db.prepare("DELETE FROM sessions WHERE id = ?").run(sha256(token));
  jar.delete(COOKIE);
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.id, u.name, u.username, u.is_site_admin, u.must_change_password
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.id = ? AND s.expires_at > ? AND u.disabled_at IS NULL`,
    )
    .get(sha256(token), new Date().toISOString()) as User | undefined;
  return row ?? null;
});

/** For pages and actions. Sends people to login, or to change a temporary password first. */
export async function requireUser(opts: { allowPasswordChange?: boolean } = {}): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(userCount() === 0 ? "/setup" : "/login");
  if (user.must_change_password && !opts.allowPasswordChange) redirect("/change-password");
  return user;
}

export async function requireSiteAdmin() {
  const user = await requireUser();
  if (!user.is_site_admin) redirect("/");
  return user;
}
