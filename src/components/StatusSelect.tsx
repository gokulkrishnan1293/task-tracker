"use client";

import type { Status } from "@/lib/types";
import { STATUSES, STATUS_LABEL } from "@/lib/types";
import { cx } from "@/lib/util";
import { STATUS_STYLE } from "./ui";

export type Person = { id: number; name: string };

export function StatusSelect({
  status,
  editable,
  isAdmin,
  onChange,
  className,
}: {
  status: Status;
  editable: boolean;
  isAdmin: boolean;
  onChange: (s: Status) => void;
  className?: string;
}) {
  const s = STATUS_STYLE[status];
  if (!editable)
    return (
      <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium", s.pill, className)}>
        {s.icon} {STATUS_LABEL[status]}
      </span>
    );
  // Members can't close tasks: they move them to In Review and an admin approves.
  const options = STATUSES.filter((x) => isAdmin || x !== "done");
  return (
    <select
      defaultValue={status}
      onChange={(e) => onChange(e.target.value as Status)}
      className={cx(className ? "" : "w-full", "cursor-pointer rounded-full px-2 py-1 text-xs font-medium outline-none", s.pill, className)}
    >
      {options.map((x) => (
        <option key={x} value={x}>
          {STATUS_STYLE[x].icon} {STATUS_LABEL[x]}
        </option>
      ))}
    </select>
  );
}
