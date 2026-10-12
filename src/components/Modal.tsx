"use client";

import { useEffect, useRef } from "react";

/** Native <dialog>: focus trap, Esc to close and backdrop for free. */
export default function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(440px,calc(100vw-2rem))] rounded-xl border border-line bg-raised p-0 text-fg shadow-2xl backdrop:bg-black/40"
    >
      {open && (
        <div className="p-5">
          <h2 className="mb-4 text-base font-semibold">{title}</h2>
          {children}
        </div>
      )}
    </dialog>
  );
}
