"use client";

import { useState, useTransition } from "react";
import { createUser, resetPassword, setSiteAdmin, setUserDisabled } from "@/app/actions/admin";
import { cx } from "@/lib/util";
import Modal from "./Modal";
import TempPassword from "./TempPassword";
import { Button, ErrorText, Field, inputCls } from "./ui";

type U = { id: number; name: string; username: string; is_site_admin: number; must_change_password: number; disabled_at: string | null; projects: string | null };

export default function UsersManager({ users, meId }: { users: U[]; meId: number }) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string>();
  const [temp, setTemp] = useState<{ value: string; who: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) alert(r.error);
    });

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Users</h1>
        <Button variant="primary" onClick={() => (setError(undefined), setAdding(true))}>
          + New user
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[720px] text-[13px]">
          <thead className="bg-surface text-left text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Projects</th>
              <th className="px-4 py-2 font-medium">Site admin</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={cx("border-t border-line", u.disabled_at && "opacity-50")}>
                <td className="px-4 py-2.5">
                  <p className="font-medium">
                    {u.name}
                    {u.id === meId && <span className="font-normal text-muted"> (you)</span>}
                  </p>
                  <p className="text-xs text-muted">
                    @{u.username}
                    {u.must_change_password ? " · hasn't set a password yet" : ""}
                    {u.disabled_at ? " · disabled" : ""}
                  </p>
                </td>
                <td className="px-4 py-2.5 text-muted">{u.projects ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={!!u.is_site_admin}
                    disabled={u.id === meId || pending}
                    onChange={(e) => run(() => setSiteAdmin(u.id, e.target.checked))}
                    aria-label={`Site admin: ${u.name}`}
                  />
                </td>
                <td className="px-4 py-2.5 text-right">
                  {u.id !== meId && (
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() =>
                          confirm(`Reset ${u.name}'s password?`) &&
                          start(async () => {
                            const r = await resetPassword(u.id);
                            if (!r.ok) return alert(r.error);
                            if (r.tempPassword) setTemp({ value: r.tempPassword, who: u.name });
                          })
                        }
                      >
                        Reset password
                      </Button>
                      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setUserDisabled(u.id, !u.disabled_at))}>
                        {u.disabled_at ? "Enable" : "Disable"}
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">Add people to projects from each project&apos;s Members tab. Disabled users can&apos;t sign in; their history stays.</p>

      <Modal open={adding} onClose={() => setAdding(false)} title="New user">
        <form
          className="space-y-3"
          action={(fd) =>
            start(async () => {
              const name = String(fd.get("name"));
              const r = await createUser({ name, username: String(fd.get("username")), siteAdmin: fd.get("siteAdmin") === "on" });
              if (!r.ok) return setError(r.error);
              setAdding(false);
              setTemp({ value: r.tempPassword, who: name });
            })
          }
        >
          <Field label="Name">
            <input name="name" required autoFocus className={inputCls} />
          </Field>
          <Field label="Username">
            <input name="username" required className={inputCls} autoComplete="off" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="siteAdmin" /> Site admin (can create projects and manage all users)
          </label>
          <ErrorText>{error}</ErrorText>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={pending}>
              Create user
            </Button>
          </div>
        </form>
      </Modal>
      <TempPassword value={temp?.value ?? null} who={temp?.who ?? ""} onClose={() => setTemp(null)} />
    </>
  );
}
