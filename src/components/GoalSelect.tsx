"use client";

import type { GoalOption } from "@/lib/types";
import { weekName, weekRange } from "@/lib/util";

/**
 * Goal picker grouped by week. `extra` keeps a task's current goal selectable even
 * when it's from an older week than the options list covers.
 */
export default function GoalSelect({
  goals,
  value,
  onChange,
  extra,
  className,
  noneLabel = "No goal",
  ...rest
}: {
  goals: GoalOption[];
  value: string;
  onChange: (v: string) => void;
  extra?: GoalOption | null;
  className?: string;
  noneLabel?: string;
} & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange">) {
  const all = extra && !goals.some((g) => g.id === extra.id) ? [extra, ...goals] : goals;
  const weeks = [...new Set(all.map((g) => g.week_start))].sort();
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={className} {...rest}>
      <option value="">{noneLabel}</option>
      {weeks.map((w) => (
        <optgroup key={w} label={`${weekName(w)} · ${weekRange(w)}`}>
          {all
            .filter((g) => g.week_start === w)
            .map((g) => (
              <option key={g.id} value={g.id}>
                ◎ {g.title}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}
