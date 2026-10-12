import type { Attention, TaskRow } from "./types";

export const STALE_DAYS = 7;

const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const localToday = () => ymd(new Date());

/** SQLite datetime('now') strings are UTC without a zone marker. */
export const parseUtc = (s: string) => new Date(s.includes("T") ? s : s.replace(" ", "T") + "Z");

const DAY = 86_400_000;

export function daysOverdue(due: string, today = localToday()) {
  return Math.round((Date.parse(today) - Date.parse(due)) / DAY);
}

/**
 * Why a task needs attention, or null. Mirrors ATTENTION_SQL in queries.ts:
 * blocked, overdue, in progress with no update for STALE_DAYS, or unassigned.
 */
export function attentionOf(t: Pick<TaskRow, "status" | "due_date" | "updated_at" | "owner_id">, now = new Date()): Attention {
  if (t.status === "done") return null;
  if (t.status === "blocked") return { reason: "Blocked" };
  const today = ymd(now);
  if (t.due_date && t.due_date < today) return { reason: `Overdue ${daysOverdue(t.due_date, today)}d` };
  if (t.status === "in_progress") {
    const idle = Math.floor((now.getTime() - parseUtc(t.updated_at).getTime()) / DAY);
    if (idle >= STALE_DAYS) return { reason: `No update ${idle}d` };
  }
  if (t.owner_id == null) return { reason: "Unassigned" };
  return null;
}

export function timeAgo(s: string, now = new Date()) {
  const sec = Math.max(0, (now.getTime() - parseUtc(s).getTime()) / 1000);
  if (sec < 60) return "just now";
  const min = sec / 60;
  if (min < 60) return `${Math.floor(min)}m ago`;
  const h = min / 60;
  if (h < 24) return `${Math.floor(h)}h ago`;
  const d = h / 24;
  if (d < 7) return `${Math.floor(d)}d ago`;
  return formatDate(ymd(parseUtc(s)));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function formatDate(d: string | null, withYear = false) {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  const thisYear = new Date().getFullYear();
  return `${day} ${MONTHS[m - 1]}${withYear || y !== thisYear ? ` ${y}` : ""}`;
}

export function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "item"
  );
}

export const pct = (done: number, total: number) => (total ? Math.round((done / total) * 100) : 0);

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

// ── Weeks (Monday start, local time) ─────────────────────────────────────

const parseYmd = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export function addDays(day: string, n: number) {
  const d = parseYmd(day);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

/** Monday of the week containing `day` (yyyy-mm-dd), defaulting to today. */
export function weekStart(day = localToday()) {
  const d = parseYmd(day);
  const back = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - back);
  return ymd(d);
}

export const isWeekKey = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && weekStart(s) === s;

/** "12–18 Oct", or "29 Sep – 5 Oct" across months. */
export function weekRange(ws: string) {
  const a = parseYmd(ws);
  const b = parseYmd(addDays(ws, 6));
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${MONTHS[b.getMonth()]}`
    : `${a.getDate()} ${MONTHS[a.getMonth()]} – ${b.getDate()} ${MONTHS[b.getMonth()]}`;
}

export function weekName(ws: string, today = localToday()) {
  const cur = weekStart(today);
  if (ws === cur) return "This week";
  if (ws === addDays(cur, -7)) return "Last week";
  if (ws === addDays(cur, 7)) return "Next week";
  return `Week of ${formatDate(ws)}`;
}
