"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createModule, setProjectArchived, updateProject } from "@/app/actions/admin";
import type { Project } from "@/lib/types";
import Modal from "./Modal";
import { Button, ErrorText, Field, inputCls } from "./ui";

export default function ProjectToolbar({ project, siteAdmin, showNewModule }: { project: Project; siteAdmin: boolean; showNewModule: boolean }) {
  const [dialog, setDialog] = useState<"module" | "edit" | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const router = useRouter();
  const open = (d: "module" | "edit") => (setError(undefined), setDialog(d));

  return (
    <div className="flex gap-2">
      <Button variant="ghost" onClick={() => open("edit")}>
        Settings
      </Button>
      {showNewModule && (
        <Button variant="primary" onClick={() => open("module")}>
          + New module
        </Button>
      )}

      <Modal open={dialog === "module"} onClose={() => setDialog(null)} title="New module">
        <form
          className="space-y-3"
          action={(fd) =>
            start(async () => {
              const r = await createModule(project.id, { name: String(fd.get("name")), description: String(fd.get("description") ?? "") });
              if (!r.ok) return setError(r.error);
              setDialog(null);
            })
          }
        >
          <Field label="Name">
            <input name="name" required autoFocus className={inputCls} placeholder="Extraction Agent" />
          </Field>
          <Field label="Description (optional)">
            <input name="description" className={inputCls} />
          </Field>
          <ErrorText>{error}</ErrorText>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={pending}>
              Create module
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={dialog === "edit"} onClose={() => setDialog(null)} title="Project settings">
        <form
          className="space-y-3"
          action={(fd) =>
            start(async () => {
              const r = await updateProject(project.id, { name: String(fd.get("name")), description: String(fd.get("description") ?? "") });
              if (!r.ok) return setError(r.error);
              setDialog(null);
            })
          }
        >
          <Field label="Name">
            <input name="name" defaultValue={project.name} required className={inputCls} />
          </Field>
          <Field label="Description (optional)">
            <input name="description" defaultValue={project.description ?? ""} className={inputCls} />
          </Field>
          <ErrorText>{error}</ErrorText>
          <div className="flex items-center justify-between gap-2 pt-1">
            {siteAdmin ? (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await setProjectArchived(project.id, !project.archived_at);
                    if (!r.ok) return setError(r.error);
                    setDialog(null);
                    if (!project.archived_at) router.push("/");
                  })
                }
              >
                {project.archived_at ? "Unarchive project" : "Archive project"}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button variant="primary" disabled={pending}>
                Save
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
