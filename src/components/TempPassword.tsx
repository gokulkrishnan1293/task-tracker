"use client";

import { useState } from "react";
import Modal from "./Modal";
import { Button } from "./ui";

/** Shows a temporary password once, with copy. */
export default function TempPassword({ value, who, onClose }: { value: string | null; who: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Modal open={!!value} onClose={onClose} title="Temporary password">
      <p className="text-sm text-muted">
        Send this to <span className="font-medium text-fg">{who}</span>. They&apos;ll be asked to choose their own password when they sign in. It won&apos;t be shown
        again.
      </p>
      <div className="mt-3 flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2">
        <code className="flex-1 select-all font-mono text-sm">{value}</code>
        <Button
          size="sm"
          onClick={() => {
            void navigator.clipboard?.writeText(value ?? "");
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}
