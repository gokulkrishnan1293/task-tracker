import { redirect } from "next/navigation";
import { getCurrentUser, userCount } from "@/lib/auth";
import { AuthCard, LoginForm } from "@/components/AuthForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (userCount() === 0) redirect("/setup");
  if (await getCurrentUser()) redirect("/");
  const { next } = await searchParams;
  return (
    <AuthCard title="Sign in">
      <LoginForm next={next} />
    </AuthCard>
  );
}
