/**
 * Recovery tool, run on the server: create a site admin, or reset an existing user's
 * password and make them site admin.
 *   npm run create-admin -- <username> "<Full Name>"
 * Prints a temporary password, which must be changed at first login.
 */
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";

const [username, name] = process.argv.slice(2);
if (!username) {
  console.error('Usage: npm run create-admin -- <username> "<Full Name>"');
  process.exit(1);
}
const temp = crypto.randomBytes(9).toString("base64url");
const hash = bcrypt.hashSync(temp, 10);
const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username) as { id: number } | undefined;
if (existing) {
  db.prepare("UPDATE users SET password_hash = ?, is_site_admin = 1, must_change_password = 1, disabled_at = NULL WHERE id = ?").run(hash, existing.id);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(existing.id);
  console.log(`Reset "${username}" and made them site admin.`);
} else {
  db.prepare("INSERT INTO users (name, username, password_hash, is_site_admin, must_change_password) VALUES (?, ?, ?, 1, 1)").run(name ?? username, username, hash);
  console.log(`Created site admin "${username}".`);
}
console.log(`Temporary password: ${temp}`);
