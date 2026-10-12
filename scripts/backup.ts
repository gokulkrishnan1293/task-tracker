/** Online, consistent SQLite backup (safe while the app is running). Keeps the last 14. */
import fs from "node:fs";
import path from "node:path";
import { db } from "../src/lib/db";

const dir = path.join(process.cwd(), "data", "backups");
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `tracker-${new Date().toISOString().replace(/[:.]/g, "-")}.db`);

db.backup(file).then(() => {
  console.log(`Backup written: ${file}`);
  const old = fs.readdirSync(dir).filter((f) => f.endsWith(".db")).sort().slice(0, -14);
  old.forEach((f) => fs.unlinkSync(path.join(dir, f)));
});
