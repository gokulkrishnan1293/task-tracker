"use client";

import { useState, useTransition } from "react";
import { addMember, removeMember, resetPassword, setMemberRole } from "@/app/actions/admin";
import type { Member, Role } from "@/lib/types";
import { cx } from "@/lib/util";
import Modal from "./Modal";
import TempPassword from "./TempPassword";
import { Button, ErrorText, Field, inputBase, inputCls } from "./ui";

export default function MembersManager({
  projectId,
  members,
  others,
  isAdmin,
  meId,
}: {
  projectId: number;
  members: Member[];
  others: { id: number; name: string; username: string }[];
  isAdmin: boolean;
  meId: number;
}) {
  const [adding, setAdding] = useState(false);
  const [mode, setMode] = useState<"new" | "existing">(others.length ? "existing" : "new");
  const [error, setError] = useState<string>();
  const [temp, setTemp] = useState<{ value: string; who: string } | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) alert(r.error);
    });

  return (
    <div className="max-w-3xl">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted">
          <b className="font-medium text-fg">Admins</b> manage modules and members, reassign tasks and close them after review.{" "}
          <b className="font-medium text-fg">Members</b> add tasks for themselves and work on their own.
        </p>
        {isAdmin && (
          <Button variant="primary" className="ml-4 shrink-0" onClick={() => (setError(undefined), setAdding(true))}>
            + Add person
          </Button>
        )}
      </div>

      <ul className="divide-y divide-line rounded-lg border border-line">
        {members.map((m) => (
          <li key={m.id} className={cx("flex items-center gap-3 px-4 py-3", m.disabled_at && "opacity-50")}>
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
              {m.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {m.name}
                {m.id === meId && <span className="font-normal text-muted"> (you)</span>}
                {m.disabled_at && <span className="ml-2 text-xs font-normal text-danger">disabled</span>}
              </p>
              <p className="truncate text-xs text-muted">@{m.username}</p>
            </div>
            {isAdmin ? (
              <>
                <select
                  defaultValue={m.role}
                  disabled={pending}
                  onChange={(e) => run(() => setMemberRole(projectId, m.id, e.target.value as Role))}
                  className={cx(inputBase, "w-28")}
                >
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                </select>
                {m.id !== meId && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() =>
                        confirm(`Reset ${m.name}'s password? They'll be signed out.`) &&
                        start(async () => {
                          const r = await resetPassword(m.id);
                          if (!r.ok) return alert(r.error);
                          if (r.tempPassword) setTemp({ value: r.tempPassword, who: m.name });
                        })
                      }
                    >
                      Reset password
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="hover:text-danger"
                      disabled={pending}
                      onClick={() =>
                        confirm(`Remove ${m.name} from this project? Their open tasks become unassigned.`) && run(() => removeMember(projectId, m.id))
                      }
                    >
                      Remove
                    </Button>
                  </>
                )}
              </>
            ) : (
              <span className="rounded-full bg-surface px-2 py-0.5 text-xs capitalize text-muted">{m.role}</span>
            )}
          </li>
        ))}
      </ul>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add person to project">
        <form
          className="space-y-3"
          action={(fd) =>
            start(async () => {
              const role = String(fd.get("role")) as Role;
              const r =
                mode === "existing"
                  ? await addMember(projectId, { userId: Number(fd.get("userId")), role })
                  : await addMember(projectId, { name: String(fd.get("name")), username: String(fd.get("username")), role });
              if (!r.ok) return setError(r.error);
              setAdding(false);
              if (r.tempPassword) setTemp({ value: r.tempPassword, who: String(fd.get("name")) });
            })
          }
        >
          {others.length > 0 && (
            <div className="flex gap-1 rounded-lg bg-surface p-1 text-sm">
              {(["existing", "new"] as const).map((k) => (
                <button
                  type="button"
                  key={k}
                  onClick={() => setMode(k)}
                  className={cx("flex-1 rounded-md px-2 py-1", mode === k ? "bg-raised shadow-sm" : "text-muted")}
                >
                  {k === "existing" ? "Existing user" : "New user"}
                </button>
              ))}
            </div>
          )}
          {mode === "existing" ? (
            <Field label="Person">
              <select name="userId" required className={inputCls}>
                {others.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} (@{u.username})
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <>
              <Field label="Name">
                <input name="name" required autoFocus className={inputCls} placeholder="Dhruv" />
              </Field>
              <Field label="Username" hint="Used to sign in. You'll get a temporary password to send them.">
                <input name="username" required className={inputCls} placeholder="dhruv" autoComplete="off" />
              </Field>
            </>
          )}
          <Field label="Role">
            <select name="role" defaultValue="member" className={inputCls}>
              <option value="member">Member: adds and works on their own tasks</option>
              <option value="admin">Admin: manages the project and closes tasks</option>
            </select>
          </Field>
          <ErrorText>{error}</ErrorText>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={pending}>
              Add
            </Button>
          </div>
        </form>
      </Modal>

      <TempPassword value={temp?.value ?? null} who={temp?.who ?? ""} onClose={() => setTemp(null)} />
    </div>
  );
}
