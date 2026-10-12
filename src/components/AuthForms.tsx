"use client";

import { useActionState } from "react";
import { changePasswordAction, loginAction, setupAction, type FormState } from "@/app/actions/auth";
import { Button, ErrorText, Field, inputCls } from "./ui";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-surface p-4">
      <div className="w-full max-w-sm rounded-xl border border-line bg-raised p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2 font-semibold">
          <span className="grid size-6 place-items-center rounded bg-accent text-xs text-white">◆</span>
          Tracker
        </div>
        <h1 className="text-lg font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        <div className="mt-5">{children}</div>
      </div>
    </main>
  );
}

function useForm(action: (s: FormState, fd: FormData) => Promise<FormState>) {
  return useActionState<FormState, FormData>(action, undefined);
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useForm(loginAction);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Username">
        <input name="username" autoComplete="username" required autoFocus className={inputCls} />
      </Field>
      <Field label="Password">
        <input name="password" type="password" autoComplete="current-password" required className={inputCls} />
      </Field>
      <ErrorText>{state?.error}</ErrorText>
      <Button variant="primary" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center text-xs text-muted">Forgot your password? Ask a project admin to reset it.</p>
    </form>
  );
}

export function SetupForm() {
  const [state, action, pending] = useForm(setupAction);
  return (
    <form action={action} className="space-y-3">
      <Field label="Your name">
        <input name="name" required autoFocus className={inputCls} placeholder="Gokul" />
      </Field>
      <Field label="Username">
        <input name="username" required autoComplete="username" className={inputCls} placeholder="gokul" />
      </Field>
      <Field label="Password" hint="At least 8 characters.">
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputCls} />
      </Field>
      <ErrorText>{state?.error}</ErrorText>
      <Button variant="primary" className="w-full" disabled={pending}>
        {pending ? "Creating…" : "Create admin account"}
      </Button>
    </form>
  );
}

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const [state, action, pending] = useForm(changePasswordAction);
  return (
    <form action={action} className="space-y-3">
      <Field label={forced ? "Temporary password" : "Current password"}>
        <input name="current" type="password" required autoFocus autoComplete="current-password" className={inputCls} />
      </Field>
      <Field label="New password" hint="At least 8 characters.">
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputCls} />
      </Field>
      <Field label="Confirm new password">
        <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={inputCls} />
      </Field>
      <ErrorText>{state?.error}</ErrorText>
      <Button variant="primary" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save password"}
      </Button>
    </form>
  );
}
