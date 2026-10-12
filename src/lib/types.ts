export const STATUSES = ["not_started", "in_progress", "blocked", "in_review", "done"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  blocked: "Blocked",
  in_review: "In Review",
  done: "Done",
};

export type Role = "admin" | "member";

export type User = {
  id: number;
  name: string;
  username: string;
  is_site_admin: number;
  must_change_password: number;
};

export type Project = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  archived_at: string | null;
};

export type Module = {
  id: number;
  project_id: number;
  name: string;
  slug: string;
  description: string | null;
  deleted_at: string | null;
};

export type Stats = {
  total: number;
  done: number;
  open: number; // in_progress + blocked
  review: number;
  pending: number; // not_started
  attention: number;
  fresh: number; // created by a member, not yet seen by an admin
};

export type TaskRow = {
  id: number;
  module_id: number;
  title: string;
  status: Status;
  owner_id: number | null;
  owner_name: string | null;
  due_date: string | null;
  sort_order: number;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  acknowledged_at: string | null;
  deleted_at: string | null;
  note_count: number;
  goal_id: number | null;
  goal_title: string | null;
  goal_week: string | null;
  goal_linked_at: string | null;
};

export type Attention = { reason: string } | null;

export type ActivityItem =
  | {
      kind: "note";
      id: number;
      at: string;
      actor: string | null;
      actorId: number | null;
      body: string;
      edited: boolean;
    }
  | {
      kind: "change";
      id: number;
      at: string;
      actor: string | null;
      action: string;
      field: string | null;
      old_value: string | null;
      new_value: string | null;
    };

export type Member = { id: number; name: string; username: string; role: Role; disabled_at: string | null };

/** A project weekly goal option, for pickers. */
export type GoalOption = { id: number; title: string; week_start: string };

export type GoalTask = {
  id: number;
  title: string;
  status: Status;
  owner_name: string | null;
  module_name: string;
  module_slug: string;
  goal_linked_at: string | null;
};

export type GoalSummary = GoalOption & {
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
  carried_from: number | null;
  carried_from_week: string | null;
  carried_to_week: string | null;
  total: number;
  done: number;
  tasks: GoalTask[];
};
