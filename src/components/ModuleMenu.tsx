"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { deleteModule, updateModule } from "@/app/actions/admin";
import Modal from "./Modal";
import { Button, ErrorText, Field, inputCls } from "./ui";

export default function ModuleMenu({ id, name, description, taskCount }: { id: number; name: string; description: string | null; taskCount: number }) {
  const [menu, setMenu] = useState(false);
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const openDialog = (d: "edit" | "delete") => {
    setError(undefined);
    setMenu(false);
    setDialog(d);
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setMenu((m) => !m)} className="rounded px-1.5 text-muted hover:bg-surface hover:text-fg" aria-label="Module options">
        ⋯
      </button>
      {menu && (
        <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-lg border border-line bg-raised py-1 text-sm shadow-lg">
          <button className="block w-full px-3 py-1.5 text-left hover:bg-surface" onClick={() => openDialog("edit")}>
            Rename
          </button>
          <button className="block w-full px-3 py-1.5 text-left text-danger hover:bg-surface" onClick={() => openDialog("delete")}>
            Delete
          </button>
        </div>
      )}

      <Modal open={dialog === "edit"} onClose={() => setDialog(null)} title="Edit module">
        <form
          className="space-y-3"
          action={(fd) =>
            start(async () => {
              const r = await updateModule(id, { name: String(fd.get("name")), description: String(fd.get("description") ?? "") });
              if (!r.ok) return setError(r.error);
              setDialog(null);
            })
          }
        >
          <Field label="Name">
            <input name="name" defaultValue={name} required autoFocus className={inputCls} />
          </Field>
          <Field label="Description (optional)">
            <input name="description" defaultValue={description ?? ""} className={inputCls} />
          </Field>
          <ErrorText>{error}</ErrorText>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={pending}>
              Save
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={dialog === "delete"} onClose={() => setDialog(null)} title={`Delete "${name}"?`}>
        <p className="text-sm text-muted">
          {taskCount > 0
            ? `Its ${taskCount} task${taskCount === 1 ? "" : "s"} will be deleted with it. You can restore the module and its tasks later from this project's page.`
            : "You can restore it later from this project's page."}
        </p>
        <ErrorText>{error}</ErrorText>
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={() => setDialog(null)}>Cancel</Button>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await deleteModule(id);
                if (!r.ok) return setError(r.error);
                setDialog(null);
              })
            }
          >
            Delete module
          </Button>
        </div>
      </Modal>
    </div>
  );
}
