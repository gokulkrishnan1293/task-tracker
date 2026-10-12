import Link from "next/link";
import type { Status } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";
import { cx, pct } from "@/lib/util";

export const STATUS_STYLE: Record<Status, { pill: string; dot: string; icon: string }> = {
  not_started: { pill: "bg-pending-soft text-muted", dot: "bg-pending", icon: "○" },
  in_progress: { pill: "bg-open-soft text-open", dot: "bg-open", icon: "●" },
  blocked: { pill: "bg-danger-soft text-danger", dot: "bg-danger", icon: "⊘" },
  in_review: { pill: "bg-review-soft text-review", dot: "bg-review", icon: "◐" },
  done: { pill: "bg-done-soft text-done", dot: "bg-done", icon: "✓" },
};

export function StatusPill({ status, className }: { status: Status; className?: string }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", s.pill, className)}>
      <span aria-hidden>{s.icon}</span>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Progress({ done, total, className }: { done: number; total: number; className?: string }) {
  const p = pct(done, total);
  return (
    <div className={cx("h-1.5 w-full overflow-hidden rounded-full bg-line", className)} role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-done transition-[width]" style={{ width: `${p}%` }} />
    </div>
  );
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-sm",
        variant === "primary" && "bg-accent text-white hover:brightness-110",
        variant === "secondary" && "border border-line bg-raised hover:bg-surface",
        variant === "ghost" && "text-muted hover:bg-surface hover:text-fg",
        variant === "danger" && "bg-danger text-white hover:brightness-110",
        className,
      )}
    />
  );
}

/** Base input look without width; use inputCls inside forms (full width). */
const skin =
  "rounded-md border border-line bg-raised px-2.5 text-sm outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20";
export const inputBase = `h-8 ${skin}`;
export const inputCls = `${inputBase} w-full`;
export const textareaCls = `w-full py-2 ${skin}`;

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function ErrorText({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{children}</p>;
}

/** Big number + label, used on cards. */
export function Stat({ n, label, tone }: { n: number; label: string; tone?: "done" | "open" | "review" | "pending" | "danger" }) {
  const color = { done: "text-done", open: "text-open", review: "text-review", pending: "text-muted", danger: "text-danger" }[tone ?? "pending"];
  return (
    <div className="min-w-0">
      <div className={cx("tabular text-lg font-semibold leading-tight", n === 0 ? "text-muted/60" : color)}>{n}</div>
      <div className="text-[11px] tracking-wide text-muted">{label}</div>
    </div>
  );
}

export function Crumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="flex min-w-0 items-center gap-1.5 text-sm" aria-label="Breadcrumb">
      {items.map((c, i) => (
        <span key={i} className="flex min-w-0 items-center gap-1.5">
          {i > 0 && <span className="text-muted/60">/</span>}
          {c.href ? (
            <Link href={c.href} className="truncate text-muted hover:text-fg">
              {c.label}
            </Link>
          ) : (
            <span className="truncate font-medium">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}
