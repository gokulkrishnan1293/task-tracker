# Tracker

Project → module → task tracker with roles, review flow, notes and full change history.
One Next.js service with a single SQLite file.

## Run on your server with pm2

```bash
npm ci                 # also builds the better-sqlite3 native module for your server
npm run build
pm2 start ecosystem.config.js
pm2 save               # keep it running across reboots (run `pm2 startup` once if you haven't)
```

Open `http://<server>:3000`. **The first visit asks you to create the site admin account.**

- **Port:** change `args: "start -p 3000"` in `ecosystem.config.js`.
- **Database:** `data/tracker.db`, created on first start. Override it with `DB_PATH`.
- **Keep `instances: 1`.** SQLite has one writer; cluster mode would run several processes against it.
- **HTTPS:** if it's behind a reverse proxy with HTTPS, set `COOKIE_SECURE: "true"` in the pm2 env.

## Updating

```bash
git pull && npm ci && npm run build && pm2 reload task-tracker
```

The schema is created automatically and safely on start; nothing to migrate.

## Backups

```bash
npm run backup        # consistent snapshot into data/backups/, keeps the last 14
```

It's safe while the app is running. To run it daily with cron:

```
0 2 * * * cd /path/to/task-tracker && npm run backup >> logs/backup.log 2>&1
```

## Locked out?

On the server:

```bash
npm run create-admin -- gokul "Gokul"
```

This resets that user's password (or creates the user), makes them site admin, and prints a temporary password.

## How it works

**Screens:** projects → module cards → module task table. Click a row to open the side panel. Use ↑/↓ (or J/K) to step through tasks, N to add a note, Esc to close. The open task is in the URL, so links can be shared.

**Statuses:** Not Started → In Progress → In Review → Done, plus Blocked.

**Needs attention:** a task needs attention if it's blocked, past its due date, in progress with no update for 7 days, or unassigned.

**Roles (per project):**

| | Admin | Member |
|---|---|---|
| See all modules and tasks, add notes | ✓ | ✓ |
| Create tasks | ✓ (any owner) | ✓ (owned by themselves) |
| Edit / delete a task | any | their own |
| Move to In Review | any | their own |
| Unassign | any | themselves |
| Reassign, move module, close (Done), approve or send back, reopen | ✓ | — |
| Create, rename, delete modules; restore deleted items | ✓ | — |
| Add people, change roles, reset passwords | ✓ | — |

The **site admin** also creates projects and manages users (Users page in the account menu).
Tasks a member adds show a **New** badge to admins until an admin opens them.

**History:** every change records who made it and when, in `task_changes`. Notes are kept per task. Deletes are soft: admins can tick "Show deleted" to restore a task, and deleted modules can be restored with their tasks from the project page.

**Passwords:** stored as bcrypt hashes. New users and resets get a temporary password, shown once, and must change it at first sign-in. Sessions last 30 days, in an httpOnly cookie.

## Code layout

```
src/lib/db.ts              connection, WAL, schema
src/lib/auth.ts            sessions, password hashing, requireUser
src/lib/queries.ts         reads: card stats, task lists, activity, roles
src/lib/guard.ts           permission checks, change logging
src/app/actions/           server actions (tasks.ts, admin.ts, auth.ts) - all writes and rules
src/app/p/[slug]/...       project, members, module pages
src/components/TaskBoard.tsx / TaskPanel.tsx   table + side panel
scripts/                   backup, create-admin
ecosystem.config.js        pm2
```
