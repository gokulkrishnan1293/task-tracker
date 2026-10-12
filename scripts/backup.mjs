/**
 * Consistent backup of the database, safe while the app is running. Keeps the last 14.
 *   npm run backup
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DB_PATH } from "./db-path.mjs";

if (!fs.existsSync(DB_PATH)) {
  console.error(`No database at ${DB_PATH}`);
  process.exit(1);
}
const dir = path.join(path.dirname(DB_PATH), "backups");
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `tracker-${new Date().toISOString().replace(/[:.]/g, "-")}.db`);

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA busy_timeout = 5000");
db.prepare("VACUUM INTO ?").run(file); // writes a consistent, compacted copy
db.close();
console.log(`Backup written: ${file}`);

const old = fs.readdirSync(dir).filter((f) => f.endsWith(".db")).sort().slice(0, -14);
for (const f of old) fs.unlinkSync(path.join(dir, f));
