import { redirect } from "next/navigation";
import { userCount } from "@/lib/auth";
import { AuthCard, SetupForm } from "@/components/AuthForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set up" };

export default function SetupPage() {
  if (userCount() > 0) redirect("/login");
  return (
    <AuthCard title="Welcome" subtitle="Create the site admin account. You'll use it to create projects and add people.">
      <SetupForm />
    </AuthCard>
  );
}
