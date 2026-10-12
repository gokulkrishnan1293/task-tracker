import path from "node:path";

/** Same default as the app (src/lib/db.ts). */
export const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data", "tracker.db");
