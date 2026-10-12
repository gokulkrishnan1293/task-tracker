import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AuthCard, ChangePasswordForm } from "@/components/AuthForms";

export const metadata = { title: "Change password" };

export default async function ChangePasswordPage() {
  const user = await requireUser({ allowPasswordChange: true });
  const forced = !!user.must_change_password;
  return (
    <AuthCard
      title={forced ? `Hi ${user.name}, set your password` : "Change password"}
      subtitle={forced ? "You signed in with a temporary password. Choose your own to continue." : undefined}
    >
      <ChangePasswordForm forced={forced} />
      {!forced && (
        <Link href="/" className="mt-4 block text-center text-sm text-muted hover:text-fg">
          Cancel
        </Link>
      )}
    </AuthCard>
  );
}
