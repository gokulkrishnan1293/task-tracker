"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createProject } from "@/app/actions/admin";
import Modal from "./Modal";
import { Button, ErrorText, Field, inputCls } from "./ui";

export default function NewProjectButton() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        + New project
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New project">
        <form
          className="space-y-3"
          action={(fd) =>
            start(async () => {
              const r = await createProject({ name: String(fd.get("name")), description: String(fd.get("description") ?? "") });
              if (!r.ok) return setError(r.error);
              setOpen(false);
              router.push(`/p/${r.slug}`);
            })
          }
        >
          <Field label="Name">
            <input name="name" required autoFocus className={inputCls} placeholder="CLAIRE" />
          </Field>
          <Field label="Description (optional)">
            <input name="description" className={inputCls} placeholder="Claim extraction quality" />
          </Field>
          <ErrorText>{error}</ErrorText>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={pending}>
              Create project
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
