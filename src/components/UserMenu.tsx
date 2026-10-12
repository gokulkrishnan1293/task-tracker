"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logoutAction } from "@/app/actions/auth";

export default function UserMenu({ name, siteAdmin }: { name: string; siteAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-surface"
        aria-expanded={open}
      >
        <span className="grid size-6 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden sm:inline">{name}</span>
        <span className="text-muted" aria-hidden>▾</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-48 overflow-hidden rounded-lg border border-line bg-raised py-1 shadow-lg">
          {siteAdmin && (
            <Link href="/admin/users" onClick={() => setOpen(false)} className="block px-3 py-1.5 hover:bg-surface">
              Users
            </Link>
          )}
          <Link href="/change-password" onClick={() => setOpen(false)} className="block px-3 py-1.5 hover:bg-surface">
            Change password
          </Link>
          <form action={logoutAction}>
            <button className="w-full px-3 py-1.5 text-left text-danger hover:bg-surface">Sign out</button>
          </form>
        </div>
      )}
    </div>
  );
}
